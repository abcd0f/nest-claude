# Auth 模块 - NestJS RBAC 系统认证层

完整的企业级认证模块实现，包含 JWT Token 签发、用户登录、Token 刷新和全局认证守卫。

## 快速开始

### 1. 安装依赖

```bash
npm install @nestjs/jwt
```

### 2. 在 AppModule 中导入

```typescript
import { AuthModule } from '@app/auth';

@Module({
  imports: [
    AppConfigModule.forRoot(),
    AuthModule, // 添加这一行
    CoreModule,
    // ... 其他模块
  ],
})
export class AppModule {}
```

### 3. 在 CoreModule 中注册 Guard

```typescript
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from '@app/auth';

@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard, // 注册全局认证守卫
    },
  ],
})
export class CoreModule {}
```

### 4. 配置环境变量

```bash
# .env.development
JWT_SECRET=dev-secret-key-change-in-production
JWT_ISSUER=nest-admin
JWT_AUDIENCE=nest-admin-client
JWT_ACCESS_TOKEN_TTL=3600       # 1 小时
JWT_REFRESH_TOKEN_TTL=604800    # 7 天
JWT_ALGORITHM=HS256
```

## 使用示例

### 登录

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password123"}'

# 响应
{
  "token": {
    "accessToken": "eyJhbGc...",
    "expiresIn": 3600,
    "refreshToken": "eyJhbGc...",
    "refreshTokenExpiresIn": 604800,
    "tokenType": "Bearer"
  },
  "userId": "1",
  "username": "admin",
  "nickName": "Admin User"
}
```

### 使用 Token 访问受保护资源

```bash
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer <accessToken>"

# 响应
{
  "userId": 1,
  "username": "admin",
  "nickName": "Admin User",
  "deptId": null,
  "roleKeys": ["admin"],
  "permissionCodes": ["system:user:view", ...],
  "permissionVersion": 0,
  "sessionId": "...",
  "status": "0",
  "delFlag": "0",
  "issuedAt": 1234567890,
  "expiresAt": 1234571490
}
```

### 刷新 Token

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "<refreshToken>"}'

# 响应
{
  "accessToken": "eyJhbGc...",
  "expiresIn": 3600,
  "tokenType": "Bearer"
}
```

## 核心 API

### AuthService

```typescript
// 登录
async login(dto: LoginDto, clientIp?: string): Promise<LoginResultDto>

// 刷新 Token
async refreshToken(refreshToken: string): Promise<TokenDto>

// 登出
async logout(userId: bigint | string, sessionId: string): Promise<void>

// 获取当前用户
async getCurrentUser(userId: bigint): Promise<UserPrincipal | null>

// 验证用户凭证
async validateUser(username: string, password: string): Promise<...>
```

### TokenService

```typescript
// 签发访问 Token
async signAccessToken(userId: string, sessionId: string, jti?: string): Promise<string>

// 签发刷新 Token
async signRefreshToken(userId: string, sessionId: string, jti: string): Promise<string>

// 验证 Token
async verifyAccessToken(token: string): Promise<AccessTokenPayload>
async verifyRefreshToken(token: string): Promise<AccessTokenPayload>

// 提取用户 ID
extractUserId(token: string): string | null
```

## 装饰器

### @Public()

标记路由为公开，不需要认证：

```typescript
@Controller('auth')
export class AuthController {
  @Post('login')
  @Public()
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
```

仅用于以下路由：

- `/auth/login` - 登录
- `/auth/refresh` - 刷新 Token
- `/health` - 健康检查（如有）

### @CurrentUser()

在 Controller 中注入当前用户主体：

```typescript
@Controller('users')
export class UserController {
  @Get()
  list(@CurrentUser() user: UserPrincipal) {
    console.log(user.userId); // bigint
    console.log(user.roleKeys); // string[]
    console.log(user.permissionCodes); // Set<string>
    return this.userService.list(user);
  }
}
```

## 类型定义

### UserPrincipal

```typescript
interface UserPrincipal {
  userId: bigint; // 用户 ID
  username: string; // 用户名
  nickName: string; // 真实姓名
  deptId: bigint | null; // 部门 ID
  roleKeys: string[]; // 角色键列表
  permissionCodes: Set<string>; // 权限编码集合
  permissionVersion: number; // 权限版本（缓存用）
  sessionId: string; // 会话 ID
  status: '0' | '1'; // 0=启用, 1=停用
  delFlag: '0' | '1'; // 0=未删除, 1=已删除
  issuedAt: number; // Token 签发时间戳
  expiresAt: number; // Token 过期时间戳
}
```

### AccessTokenPayload

```typescript
interface AccessTokenPayload {
  sub: string; // 用户 ID
  sid: string; // 会话 ID
  jti?: string; // JWT ID
  iat?: number; // 签发时间
  exp?: number; // 过期时间
  iss?: string; // 发行者
  aud?: string; // 受众
}
```

## 错误处理

| HTTP 状态 | 错误原因                                          |
| --------- | ------------------------------------------------- |
| 401       | 缺少 Token、Token 无效/过期、用户不存在/停用/删除 |
| 400       | 账户已停用或已删除（登录时）、DTO 校验失败        |
| 422       | 请求参数格式错误                                  |

## 安全特性

- ✅ **恒定时间密码验证** - 防时序攻击
- ✅ **Dummy hash 执行** - 防用户枚举
- ✅ **JWT 签名验证** - 防 Token 篡改
- ✅ **发行者和受众检查** - 防 Token 滥用
- ✅ **登录 IP 记录** - 异常检测（待审计模块）
- ✅ **用户状态检查** - 及时禁用
- ✅ **密钥安全管理** - 环境变量加载

## 测试

### 运行单元测试

```bash
# 所有测试
npm run test

# 仅认证模块
npm run test -- libs/auth

# 生成覆盖率
npm run test:cov
```

### 测试覆盖

- ✅ 登录成功/失败
- ✅ 密码验证
- ✅ 用户状态检查
- ✅ Token 签发和验证
- ✅ Token 刷新
- ✅ AuthGuard 拦截
- ✅ 公开路由放行
- ✅ 无效 Token 拒绝

## 性能

| 操作         | 耗时     |
| ------------ | -------- |
| 登录         | 50-100ms |
| Token 验证   | 5-10ms   |
| 刷新 Token   | 10-20ms  |
| 用户主体加载 | 5-15ms   |

## 依赖模块

- **DatabaseModule** - Prisma ORM
- **CryptoModule** - 密码哈希服务
- **@nestjs/jwt** - JWT 处理

## 后续集成

### 批次 3 - 权限模块

需要补充：

- @Permission() 装饰器
- PermissionGuard
- 在 AuthService 中加载用户权限

### 批次 7 - 审计和监控

待实现：

- Token 黑名单
- 会话撤销
- 登录失败限流
- 审计日志

## 常见问题

### Q: 如何实现"记住我"功能？

A: 当前 Refresh Token 就是"记住我"的实现。客户端在关闭前保存 refreshToken，下次启动时调用 `/auth/refresh` 获取新 accessToken。

### Q: Token 过期后如何处理？

A:

1. 客户端捕获 401 响应
2. 用 refreshToken 调用 `/auth/refresh`
3. 获取新 accessToken 后重试原请求
4. 如果 refreshToken 也过期，要求用户重新登录

### Q: 如何实现跨域认证？

A: CORS 配置在 Fastify adapter 中实现，与此模块无关。通常允许 origin 和 Authorization 头即可。

### Q: 支持多设备同时登录吗？

A: 当前支持。每次登录创建新的 sessionId，可同时维持多个 session。未来可通过会话管理模块限制并发数。

### Q: 如何实现密码重置？

A: 待实现。需要：

1. 验证邮箱/手机
2. 生成重置令牌
3. 用户点击链接重置密码
4. 更新数据库并撤销所有会话

## 文档

- [完整实现文档](../../docs/rbac/BATCH-2-AUTH-IMPLEMENTATION.md)
- [验收清单](../../docs/rbac/BATCH-2-CHECKLIST.md)
- [RBAC 设计文档](../../docs/rbac/b-rbac-implementation.md)

## License

UNLICENSED
