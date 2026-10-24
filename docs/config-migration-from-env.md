# 从环境变量迁移到 YAML 配置

## 变更概述

项目已从环境变量配置迁移到 YAML 配置系统。所有配置现在统一在 `config/` 目录管理。

## 主要变更

### 1. JWT 配置

**之前（环境变量）**:
```bash
JWT_SECRET=your-secret
JWT_ACCESS_TOKEN_TTL=3600
JWT_REFRESH_TOKEN_TTL=604800
JWT_ISSUER=nest-admin
JWT_AUDIENCE=nest-admin-client
JWT_ALGORITHM=HS256
```

**现在（YAML 配置）**:
```yaml
# config/default.yaml
auth:
  access-token-secret: CHANGE_ME_IN_PRODUCTION_ACCESS_TOKEN_SECRET
  refresh-token-secret: CHANGE_ME_IN_PRODUCTION_REFRESH_TOKEN_SECRET
  access-token-ttl: 1800
  refresh-token-ttl: 604800
  issuer: nest-admin
  audience: nest-admin
  refresh-token-rotation: true
  password-reset-token-ttl: 1800
```

### 2. 生产环境密钥管理

**之前**: 在 `.env.production` 或环境变量中设置

**现在**: 在 `config/production.local.yaml` 中设置

```yaml
# config/production.local.yaml（不入库）
auth:
  access-token-secret: <openssl rand -base64 64 生成>
  refresh-token-secret: <openssl rand -base64 64 生成>
  access-token-ttl: 900  # 可选：缩短为15分钟
```

### 3. 配置注入方式

**之前（TokenService）**:
```typescript
constructor(
  @Inject('TOKEN_CONFIG') private readonly config: TokenConfig,
) {}
```

**现在（TokenService）**:
```typescript
import { authConfig, type AuthConfig } from '@app/config';

constructor(
  @Inject(authConfig.KEY) private readonly config: AuthConfig,
) {}
```

## 迁移步骤

### 开发环境

1. **删除环境变量文件**（如果存在）
   ```bash
   rm .env.development  # 不再需要
   ```

2. **使用默认配置启动**
   ```bash
   npm run start:dev
   ```
   
   开发环境默认配置已经可用，无需额外配置。

### 生产环境

1. **创建本地配置文件**
   ```bash
   cd config
   cp production.local.yaml.example production.local.yaml
   ```

2. **生成强随机密钥**
   ```bash
   # 生成访问令牌密钥
   openssl rand -base64 64
   
   # 生成刷新令牌密钥（必须不同）
   openssl rand -base64 64
   ```

3. **编辑 production.local.yaml**
   ```yaml
   database:
     url: postgresql://user:pass@host:5432/db?schema=public

   redis:
     password: your-redis-password

   auth:
     access-token-secret: <第一个生成的密钥>
     refresh-token-secret: <第二个生成的密钥>
   ```

4. **删除旧的环境变量**
   ```bash
   # 不再需要这些环境变量
   unset JWT_SECRET
   unset JWT_ACCESS_TOKEN_TTL
   unset JWT_REFRESH_TOKEN_TTL
   # ...
   ```

5. **启动应用**
   ```bash
   export NODE_ENV=production
   npm run start:prod
   ```

## 配置对照表

| 旧环境变量 | 新 YAML 配置 | 说明 |
|-----------|-------------|------|
| `JWT_SECRET` | `auth.access-token-secret` | 访问令牌密钥 |
| - | `auth.refresh-token-secret` | 刷新令牌密钥（新增） |
| `JWT_ACCESS_TOKEN_TTL` | `auth.access-token-ttl` | 访问令牌有效期（秒） |
| `JWT_REFRESH_TOKEN_TTL` | `auth.refresh-token-ttl` | 刷新令牌有效期（秒） |
| `JWT_ISSUER` | `auth.issuer` | JWT 签发者 |
| `JWT_AUDIENCE` | `auth.audience` | JWT 受众 |
| `JWT_ALGORITHM` | - | 已移除（固定使用 HS256） |
| - | `auth.refresh-token-rotation` | 令牌轮换（新增） |
| - | `auth.password-reset-token-ttl` | 密码重置令牌有效期（新增） |

## 新功能

### 1. 刷新令牌独立密钥

访问令牌和刷新令牌现在使用不同的密钥，提高安全性：

```yaml
auth:
  access-token-secret: ACCESS_SECRET_HERE
  refresh-token-secret: REFRESH_SECRET_HERE  # 必须不同
```

### 2. 刷新令牌轮换

每次刷新令牌时自动废弃旧令牌：

```yaml
auth:
  refresh-token-rotation: true  # 推荐启用
```

### 3. 密码重置令牌配置

独立配置密码重置令牌的有效期：

```yaml
auth:
  password-reset-token-ttl: 1800  # 30分钟
```

## 优势

### ✅ 相比环境变量的优势

1. **分层配置**: 基线配置、环境差异、本地敏感信息分离
2. **类型安全**: 启动时自动验证配置类型和格式
3. **版本控制**: 基线配置入库，本地敏感信息不入库
4. **易于管理**: 所有配置集中在 `config/` 目录
5. **环境隔离**: 通过文件名自然隔离不同环境
6. **热重载**: 开发环境支持配置热重载（可选）

### 🔐 安全性提升

1. **双密钥系统**: 访问令牌和刷新令牌使用不同密钥
2. **令牌轮换**: 自动废弃旧的刷新令牌
3. **密钥生成**: 提供标准的密钥生成命令
4. **本地文件保护**: `.local.yaml` 文件不入库

## 故障排查

### 问题：应用启动时报配置验证错误

**原因**: 缺少必需的配置项或配置类型错误

**解决**:
1. 检查 `config/default.yaml` 是否存在 `auth` 配置域
2. 如果是生产环境，确认 `config/production.local.yaml` 已创建并配置密钥
3. 查看详细的错误信息，根据提示修改配置

### 问题：JWT 验证失败

**原因**: 密钥配置不一致或未正确加载

**解决**:
1. 确认所有实例使用相同的 `production.local.yaml` 配置
2. 验证 `NODE_ENV` 环境变量设置正确
3. 重启应用以加载新配置

### 问题：找不到配置文件

**原因**: 配置文件路径不正确或文件不存在

**解决**:
1. 确认工作目录在项目根目录
2. 检查 `config/` 目录是否存在
3. 验证文件名是否正确（如 `production.local.yaml` 不是 `production.local.yml`）

## 回滚方案

如果需要临时回滚到环境变量配置：

1. **修改 AuthModule**

```typescript
// libs/auth/src/auth.module.ts
JwtModule.registerAsync({
  useFactory: () => ({
    secret: process.env.JWT_SECRET || 'fallback-secret',
    signOptions: {
      expiresIn: process.env.JWT_ACCESS_TOKEN_TTL || '3600s',
      issuer: process.env.JWT_ISSUER || 'nest-admin',
      audience: process.env.JWT_AUDIENCE || 'nest-admin',
    },
  }),
})
```

2. **修改 TokenService**

```typescript
// libs/auth/src/services/token.service.ts
constructor(
  private readonly jwtService: JwtService,
) {}

// 使用 process.env 读取配置
```

3. **设置环境变量并重启**

但建议尽快适应新的 YAML 配置系统，它提供了更好的管理性和安全性。

## 参考资料

- [完整配置指南](./configuration-guide.md)
- [批次 8 实施文档](./rbac/batch-8-audit-implementation.md)
- [RBAC 实现文档](./rbac/b-rbac-implementation.md)

---

**迁移完成日期**: 2025-01-24  
**影响范围**: 认证模块、配置模块
