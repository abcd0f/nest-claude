# 配置系统设置总结

## 最近更新

### ✅ 配置模块统一简化（2025-01-24）

**改进内容**:
- 统一所有配置域为函数式 parse 风格
- 移除 class-validator 依赖混用
- 简化配置域定义，降低复杂度
- 保持所有配置项和功能不变

**改进前**: 混用两种风格
- 旧风格: class + decorator + schema/defaults/parsers
- 新风格: interface + parse 函数

**改进后**: 统一为新风格
- 所有域使用 `interface` 定义类型
- 所有域使用 `parse(raw)` 函数解析
- 使用 `asString`、`asInteger` 等工具函数
- 代码更简洁、易读、易维护

## 已完成的工作

### ✅ 1. 创建 Auth 配置域

**文件**: `libs/config/src/domains/auth.domain.ts`

定义了完整的认证配置结构（已简化为函数式风格）：
- 访问令牌密钥和刷新令牌密钥（分离）
- Token 有效期配置
- JWT 签发者和受众
- 刷新令牌轮换开关
- 密码重置令牌有效期

### ✅ 2. 注册配置域

**文件**: `libs/config/src/domains/index.ts`

将 `authDomain` 注册到配置系统，导出 `authConfig` 注入令牌和 `AuthConfig` 类型。

### ✅ 3. 更新 YAML 配置文件

**default.yaml** - 添加 auth 配置段：
```yaml
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

**production.yaml** - 添加安全提醒注释

**production.local.yaml.example** - 创建生产环境配置模板

### ✅ 4. 更新 AuthModule

**文件**: `libs/auth/src/auth.module.ts`

从环境变量迁移到 YAML 配置：
- 使用 `authConfig.KEY` 注入配置
- 简化模块 providers 配置
- 移除手动创建的 TOKEN_CONFIG

### ✅ 5. 更新 TokenService

**文件**: `libs/auth/src/services/token.service.ts`

- 使用 `@Inject(authConfig.KEY)` 注入配置
- 移除 `TokenConfig` 接口（使用 `AuthConfig`）
- 分离访问令牌和刷新令牌密钥
- 更新所有 Token 签发和验证方法

### ✅ 6. 创建配置文档

- [配置指南](./configuration-guide.md) - 完整的配置说明
- [配置迁移文档](./config-migration-from-env.md) - 从环境变量迁移指南
- [配置设置总结](./config-setup-summary.md) - 本文档

## 配置结构

```
config/
├── default.yaml                    # 所有环境共享的基线配置
│   ├── app                        # 应用配置（端口、前缀）
│   ├── auth                       # 认证配置（JWT）⭐ 新增
│   ├── database                   # 数据库配置
│   ├── redis                      # Redis 配置
│   ├── logger                     # 日志配置
│   ├── swagger                    # API 文档配置
│   ├── throttler                  # 限流配置
│   └── api-decrypt                # API 加解密配置
├── development.yaml               # 开发环境差异配置
├── production.yaml                # 生产环境差异配置
├── production.local.yaml          # 生产环境敏感配置（不入库）
└── production.local.yaml.example  # 生产环境配置模板

libs/config/src/domains/
├── app.domain.ts
├── auth.domain.ts                 # ⭐ 新增
├── database.domain.ts
├── redis.domain.ts
├── logger.domain.ts
├── swagger.domain.ts
├── throttler.domain.ts
├── api-decrypt.domain.ts
└── index.ts                       # 注册所有配置域
```

## 使用方式

### 在服务中注入配置

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { authConfig, type AuthConfig } from '@app/config';

@Injectable()
export class MyService {
  constructor(
    @Inject(authConfig.KEY) private readonly config: AuthConfig,
  ) {}

  doSomething() {
    console.log('Access token TTL:', this.config.accessTokenTtl);
    console.log('Issuer:', this.config.issuer);
  }
}
```

### 在模块中使用配置

```typescript
import { Module } from '@nestjs/common';
import { authConfig, type AuthConfig } from '@app/config';

@Module({
  imports: [
    SomeModule.forRootAsync({
      inject: [authConfig.KEY],
      useFactory: (config: AuthConfig) => ({
        secret: config.accessTokenSecret,
        // ...
      }),
    }),
  ],
})
export class MyModule {}
```

## 生产环境部署

### 1. 生成密钥

```bash
# 访问令牌密钥
openssl rand -base64 64

# 刷新令牌密钥（必须不同）
openssl rand -base64 64
```

### 2. 创建本地配置

```bash
cd config
cp production.local.yaml.example production.local.yaml
```

### 3. 编辑配置文件

```yaml
# config/production.local.yaml
database:
  url: postgresql://user:pass@host:5432/db?schema=public

redis:
  password: your-redis-password

auth:
  access-token-secret: <第一个生成的密钥>
  refresh-token-secret: <第二个生成的密钥>
  access-token-ttl: 900  # 可选：缩短为15分钟

api-decrypt:
  private-key: YOUR_RSA_PRIVATE_KEY
  public-key: YOUR_RSA_PUBLIC_KEY
```

### 4. 启动应用

```bash
export NODE_ENV=production
npm run start:prod
```

## 配置验证

应用启动时会自动验证所有配置：

✅ **类型检查**: 确保配置项类型正确
✅ **必填项**: 确保必填配置不为空
✅ **格式验证**: 验证 URL、端口号等格式
✅ **范围检查**: 验证数值在合理范围内

验证失败会显示详细错误：

```
Configuration validation failed for domain 'auth':
  - access-token-secret must be a string
  - access-token-ttl must be at least 60
```

## 安全最佳实践

### ✅ 应该做的

1. **使用强随机密钥**
   ```bash
   openssl rand -base64 64
   ```

2. **分离访问和刷新令牌密钥**
   ```yaml
   auth:
     access-token-secret: SECRET_1
     refresh-token-secret: SECRET_2  # 必须不同
   ```

3. **启用令牌轮换**
   ```yaml
   auth:
     refresh-token-rotation: true
   ```

4. **本地配置不入库**
   - `production.local.yaml` 已在 `.gitignore`
   - 只提交 `.example` 文件作为模板

5. **缩短生产环境 Token 有效期**
   ```yaml
   auth:
     access-token-ttl: 900  # 15分钟
   ```

### ❌ 不应该做的

1. ❌ 使用默认密钥用于生产环境
2. ❌ 提交 `.local.yaml` 文件到代码仓库
3. ❌ 访问和刷新令牌使用相同密钥
4. ❌ 使用弱密钥如 "secret123"
5. ❌ 在代码中硬编码密钥

## 配置对照

### JWT 配置对照

| 配置项 | 默认值 | 生产建议 | 说明 |
|-------|--------|---------|------|
| `access-token-ttl` | 1800秒（30分钟） | 900秒（15分钟） | 访问令牌有效期 |
| `refresh-token-ttl` | 604800秒（7天） | 2592000秒（30天） | 刷新令牌有效期 |
| `refresh-token-rotation` | true | true | 启用令牌轮换 |
| `password-reset-token-ttl` | 1800秒（30分钟） | 1800秒 | 密码重置令牌 |

## 新增功能

### 1. 双密钥系统 🔐

访问令牌和刷新令牌使用不同的密钥，即使访问令牌泄露，攻击者也无法伪造刷新令牌。

### 2. 令牌轮换 🔄

每次刷新令牌时自动废弃旧令牌，防止令牌重放攻击。

### 3. 密码重置令牌 📧

独立的密码重置令牌配置，可以设置更短的有效期。

### 4. 配置验证 ✅

启动时自动验证所有配置项，及早发现配置错误。

## 测试验证

### 开发环境测试

```bash
# 启动开发环境
npm run start:dev

# 验证配置加载
# 应用启动时会显示配置验证结果
```

### 生产环境测试

```bash
# 设置环境变量
export NODE_ENV=production

# 启动应用
npm run start:prod

# 测试登录
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123456"}'

# 验证 Token
curl http://localhost/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 故障排查

### 配置加载失败

**检查清单**:
- [ ] YAML 文件语法正确
- [ ] 配置文件路径正确（`config/` 目录）
- [ ] 所有必填项已配置
- [ ] 配置项类型匹配

### JWT 验证失败

**检查清单**:
- [ ] 密钥在所有实例一致
- [ ] `issuer` 和 `audience` 配置正确
- [ ] Token 未过期
- [ ] Token 格式正确（Bearer + 空格 + Token）

### 生产环境密钥未生效

**检查清单**:
- [ ] `production.local.yaml` 文件存在
- [ ] `NODE_ENV=production` 已设置
- [ ] 文件名正确（`.yaml` 不是 `.yml`）
- [ ] 密钥格式正确（无换行符）

## 下一步

### 可选优化

1. **配置热重载** - 开发环境支持配置热重载
2. **配置加密** - 对敏感配置项加密存储
3. **配置中心** - 集成 Consul 或 Nacos
4. **环境变量覆盖** - 支持环境变量覆盖 YAML 配置
5. **配置审计** - 记录配置变更历史

### 后续批次

批次 9 的工作可以继续进行：
- 前端集成测试
- E2E 测试
- 并发测试
- 越权测试
- 性能测试

## 参考文档

- [完整配置指南](./configuration-guide.md)
- [配置迁移文档](./config-migration-from-env.md)
- [批次 8 实施文档](./rbac/batch-8-audit-implementation.md)
- [RBAC 实现文档](./rbac/b-rbac-implementation.md)

---

**完成日期**: 2025-01-24  
**状态**: ✅ 已完成并可用  
**影响范围**: 认证模块、配置模块
