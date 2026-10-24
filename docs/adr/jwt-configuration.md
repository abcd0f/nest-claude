# JWT 配置设计决策记录（ADR）

**标题:** JWT 认证实现的配置策略

**状态:** 批准

**批次:** 0（环境准备）

---

## 问题

NestJS 12 + Fastify 应用需要实现 JWT 认证机制。需要确定：

1. JWT 签名算法和密钥管理策略
2. Token 有效期设置（Access Token 和 Refresh Token）
3. Issuer、Audience 等声明的配置
4. 密钥在开发、测试、生产环境的不同处理方式

---

## 背景

- 项目使用 `@nestjs/jwt` 和 `@nestjs/config` 管理配置
- 支持 Bearer Token 认证方式
- 需要支持 Refresh Token 机制以改善用户体验
- 所有 ID 使用 BigInt，需要在 JWT claim 中使用字符串表示

---

## 决策

### 1. JWT 算法选择

**决策**: 使用 HS256（HMAC SHA-256） 对称加密

**原因**:
- ✅ 适合单一服务提供者场景
- ✅ 性能好，不需要公钥分发
- ✅ NestJS JWT 原生支持
- ❌ 若未来有多个微服务需验签，需切换为 RS256

**配置示例**:
```ts
JwtModule.registerAsync({
  useFactory: (config: AuthConfig) => ({
    secret: config.accessTokenSecret,
    signOptions: {
      algorithm: 'HS256',
      expiresIn: config.accessTokenTtl,
    },
  }),
})
```

### 2. 密钥管理

| 环境 | 密钥来源 | 长度要求 | 轮换策略 |
|------|---------|---------|---------|
| 开发 | `.env.development` | >= 32 字符 | 可选 |
| 测试 | `.env.test` | >= 32 字符 | 每次测试 |
| 生产 | 环境变量 / Secret Manager | >= 64 字符 | 每 90 天或按需 |

**规则**:
- 密钥从不硬编码在代码中
- 密钥长度至少 32 字符（256 位）
- 生产密钥通过 CI/CD pipeline 注入
- 密钥泄露时需执行 Token 撤销流程

### 3. Token 有效期

#### Access Token

- **默认值**: 15 分钟（900 秒）
- **范围**: 5-60 分钟
- **原因**:
  - 足够完成大多数用户操作
  - 泄露风险时间窗口有限
  - 频繁过期会增加刷新调用

```ts
export interface AuthConfig {
  accessTokenSecret: string;
  accessTokenTtl: string | number; // e.g., '15m' or 900
  issuer: string;
  audience: string;
}
```

#### Refresh Token

- **默认值**: 7 天（604,800 秒）
- **存储**: 数据库中保存 bcrypt 哈希
- **传输**: 仅在登录响应中返回一次
- **轮换**: 每次使用后废弃旧 Token，签发新 Token

### 4. JWT Claims 设计

#### Payload 结构

```ts
interface AccessTokenPayload {
  // 标准 Claims
  sub: string;      // User ID (BigInt 转字符串)
  iat: number;      // Issued At
  exp: number;      // Expiration Time
  iss: string;      // Issuer (e.g., 'nest-admin')
  aud: string;      // Audience (e.g., 'nest-admin-client')

  // 自定义 Claims
  sid: string;      // Session ID (用于 Token 撤销)
  ver: number;      // Permission Version (权限缓存版本)
}
```

**设计原因**:
- ✅ 最小化 payload 大小（减少网络传输）
- ✅ `sub` 存储用户 ID，遵循 JWT 标准
- ✅ `sid` 支持会话级别的 Token 撤销
- ✅ `ver` 支持权限缓存失效机制
- ❌ 不在 Token 中存储权限或角色列表（可能过期且泄露信息）

### 5. Issuer 和 Audience

```ts
// 推荐配置
{
  issuer: 'nest-admin-api',      // 发行者标识
  audience: 'nest-admin-client', // 受众标识（client app）
}
```

**验证规则**:
- `iss` 必须匹配配置的 issuer
- `aud` 必须匹配配置的 audience
- 不匹配时拒绝 Token（401）

### 6. Token 校验流程

```ts
AuthGuard.canActivate():
  1. 提取 Authorization: Bearer <token>
  2. 调用 JwtService.verifyAsync(token)
     - 验证签名
     - 验证有效期
     - 验证 iss/aud
  3. 解析 payload 获取 userId 和 sessionId
  4. 查询数据库验证：
     - 用户存在且启用
     - Session 未撤销
     - Permission Version 匹配
  5. 设置 request.user = UserPrincipal
```

### 7. 刷新 Token 流程

```ts
POST /auth/refresh
Content-Type: application/json
{
  "refreshToken": "..."
}

Response:
{
  "accessToken": "...",
  "refreshToken": "...",  // 新 Token
  "expiresIn": 900,
}
```

**细节**:
- Refresh Token 在数据库存储哈希值
- 每次刷新：
  1. 验证旧 refresh token
  2. 检测重放（同一旧 token 多次使用）
  3. 废弃旧 token（标记为已使用）
  4. 签发新 access + refresh token 对
  5. 如检测到重放，撤销整个 session 家族

### 8. Token 撤销机制

#### Logout 时

```ts
POST /auth/logout
Authorization: Bearer <accessToken>

// 后端操作
1. 解析 JWT 获取 sessionId
2. 从 auth_session 表删除该 session
3. 清理相关的 refresh token
4. 记录登出审计
```

#### 高风险操作

```ts
// 密码重置、角色变更、用户禁用时
1. 查询用户的所有 session
2. 批量删除 session 记录
3. 强制用户重新登录
```

### 9. 错误处理

| 场景 | 错误码 | 消息 | 说明 |
|------|-------|------|------|
| 缺少 Bearer Token | 401 | Missing authentication token | 非公开接口必须有 Token |
| 签名无效 | 401 | Invalid token signature | Token 被篡改 |
| Token 过期 | 401 | Token expired | 需要刷新或重新登录 |
| iss/aud 不匹配 | 401 | Invalid issuer/audience | Token 来源错误 |
| Session 已撤销 | 401 | Session revoked | 用户已登出或被禁用 |
| 用户不存在/已停用 | 401 | User not found or disabled | 用户被删除或禁用 |

---

## 实现步骤

### Phase 1: 基础配置（批次0）

- [ ] 创建 `AuthConfig` 接口
- [ ] 配置 `JwtModule.registerAsync()`
- [ ] 实现密钥注入和验证
- [ ] 编写配置测试

### Phase 2: 认证实现（批次2）

- [ ] 实现 `AuthGuard` - Token 校验
- [ ] 实现 `TokenService` - JWT 签发/验证
- [ ] 实现登录流程
- [ ] 实现 Refresh Token 支持

### Phase 3: 会话管理（批次2）

- [ ] 创建 `AuthSession` 表
- [ ] 实现 Session 撤销
- [ ] 实现密码重置后的 Token 撤销
- [ ] 实现登出

---

## 环境配置示例

### .env.development
```env
JWT_ACCESS_TOKEN_SECRET=your-dev-secret-key-min-32-chars-here
JWT_ACCESS_TOKEN_TTL=15m
JWT_REFRESH_TOKEN_SECRET=your-refresh-secret-key
JWT_REFRESH_TOKEN_TTL=7d
JWT_ISSUER=nest-admin-api
JWT_AUDIENCE=nest-admin-client
```

### .env.production
```
# 通过 CI/CD 或 Secret Manager 注入
# 不在 git 中存储
```

---

## 安全考量

1. **密钥存储**
   - ❌ 不在代码仓库中
   - ✅ 使用环境变量或 Secret Manager

2. **HTTPS 强制**
   - Token 只能通过 HTTPS 传输
   - 防止中间人攻击

3. **XSS 防护**
   - Token 存储在内存或 secure HttpOnly Cookie
   - 不在 localStorage（防 XSS 泄露）

4. **CORS 配置**
   - 明确允许的源白名单
   - 不使用 `*` 通配符

5. **Token 时间同步**
   - 服务器时间必须准确
   - 定期 NTP 同步

---

## 参考资源

- [RFC 7519 - JSON Web Token (JWT)](https://tools.ietf.org/html/rfc7519)
- [NestJS JWT Documentation](https://docs.nestjs.com/security/authentication)
- [@nestjs/jwt GitHub](https://github.com/nestjs/jwt)
- [OWASP: JSON Web Token Best Practices](https://owasp.org/www-project-web-security-testing-guide/)

---

**制定日期**: 2025-01-17  
**批准者**: 系统架构团队  
**下次评审**: 批次2 完成后
