# 配置指南

## 概述

本项目使用分层 YAML 配置系统，支持环境差异化配置和本地敏感信息保护。

## 配置文件结构

```
config/
├── default.yaml                    # 基线配置（所有环境共享，入库）
├── development.yaml                # 开发环境差异配置（入库）
├── production.yaml                 # 生产环境差异配置（入库）
├── production.local.yaml           # 生产环境本地配置（不入库，包含密钥）
└── production.local.yaml.example   # 本地配置模板（入库）
```

## 配置优先级

配置加载顺序（后者覆盖前者）：

1. `default.yaml` - 基线配置
2. `{NODE_ENV}.yaml` - 环境差异配置（如 `production.yaml`）
3. `{NODE_ENV}.local.yaml` - 本地敏感配置（如 `production.local.yaml`）

## 配置域

### 1. 应用配置（app）

```yaml
app:
  # HTTP 服务端口
  port: 3000
  # 全局 API 前缀
  api-prefix: api
```

### 2. 认证配置（auth）⚠️

```yaml
auth:
  # JWT 访问令牌密钥（生产环境必须覆盖）
  access-token-secret: YOUR_SECRET_HERE
  # JWT 刷新令牌密钥（必须与访问令牌密钥不同）
  refresh-token-secret: YOUR_SECRET_HERE
  # 访问令牌有效期（秒）- 建议 15分钟到1小时
  access-token-ttl: 1800
  # 刷新令牌有效期（秒）- 建议 7天到30天
  refresh-token-ttl: 604800
  # JWT 签发者
  issuer: nest-admin
  # JWT 受众
  audience: nest-admin
  # 是否启用刷新令牌轮换
  # true：每次刷新都换发新的刷新令牌，旧令牌立即失效；旧令牌被重复使用会撤销整个会话
  # 依赖 Redis（redis.enabled 必须为 true），否则启动直接报错
  refresh-token-rotation: true
```

**刷新令牌轮换与会话状态的副作用**：

- 会话状态存在 Redis，两个 key、TTL 都等于 `refresh-token-ttl`：
  - `<key-prefix>:data:auth:session:<sessionId>` —— 会话存活标记，`AuthGuard` 每次请求校验
  - `<key-prefix>:data:auth:refresh:<sessionId>` —— 当前有效 jti，仅在轮换开启时写入
- **Redis 是认证路径的硬依赖**：`redis.enabled: false` 时无法登录（会话无法登记）。
  轮换开启且 Redis 关闭时启动直接报错；轮换关闭时登录仍会写会话标记，Redis 不可用同样登录失败。
- 前端必须串行刷新（同一时刻只发一个 `/auth/refresh`），否则后到的请求会拿着已作废的令牌被判定为重放，导致整个会话被撤销。
- 从 `false` 切到 `true` 后，切换前签发的刷新令牌没有 Redis 记录，会全部失效，用户需要重新登录。
- `POST /auth/logout` 只撤销当前会话：refresh token 与 access token 同时立即失效，其他设备的登录不受影响；重复调用幂等。
- `POST /auth/logout` 是公开接口（不需要有效 access token）：token 过期后前端通常已清掉本地令牌，
  此时必须在请求体里带 `{ "refreshToken": "..." }` 才能定位并撤销会话；两个令牌都拿不到时接口返回成功但不撤销任何会话。

**⚠️ 安全提醒**:
- 默认密钥仅用于开发环境
- 生产环境必须在 `production.local.yaml` 中覆盖
- 生成强随机密钥：`openssl rand -base64 64`

### 3. 数据库配置（database）

```yaml
database:
  url: postgresql://USER:PASSWORD@localhost:5432/DATABASE?schema=public
  pool:
    max: 10                    # 连接池最大连接数
    idle-timeout: 10000        # 空闲连接回收时间（毫秒）
    connect-timeout: 5000      # 建立连接超时（毫秒）
  log-queries: false           # 是否打印 SQL 日志
```

### 4. Redis 配置（redis）

```yaml
redis:
  enabled: true                # 总开关
  host: 127.0.0.1
  port: 6379
  db: 0
  key-prefix: nest-admin       # 应用/环境隔离前缀
  ttl: 60000                   # 默认缓存 TTL（毫秒）
  connect-timeout: 5000
  command-timeout: 2000
  retry-delay: 1000
  commands-queue-max-length: 1000
  tls: false
  # 可选 ACL 用户（密码放在 local.yaml）
  # username: default
  # password: your-password
```

### 5. 日志配置（logger）

```yaml
logger:
  level: info                  # trace/debug/info/warn/error/fatal
  console:
    enabled: true
    pretty: true               # false 时输出 JSON
  file:
    enabled: true
    directory: logs/gateway
    size-mb: 20
    frequency: daily           # hourly/daily/weekly
    max-files: 15
```

### 6. Swagger 配置（swagger）

```yaml
swagger:
  enabled: true                # 生产环境建议关闭
  path: docs
  title: Nest Admin API
  description: Nest Admin 接口文档
  version: 1.0.0
```

### 7. 限流配置（throttler）

```yaml
throttler:
  enabled: true
  ttl: 60000                   # 计数有效期（毫秒）
  limit: 100                   # 有效期内允许的请求数
  # block-duration: 60000      # 超限封禁时长（可选）
```

### 8. API 加解密配置（api-decrypt）

```yaml
api-decrypt:
  enabled: true
  header-flag: encrypt-key
  private-key: YOUR_RSA_PRIVATE_KEY_BASE64
  public-key: YOUR_RSA_PUBLIC_KEY_BASE64
```

**生成 RSA 密钥对**:
```bash
# 生成私钥
openssl genrsa -out private.pem 1024

# 生成公钥
openssl rsa -in private.pem -pubout -out public.pem

# 转换为 Base64
openssl rsa -in private.pem -outform DER -out private.der && base64 -w 0 private.der
openssl rsa -in private.pem -pubout -outform DER -out public.der && base64 -w 0 public.der
```

## 生产环境配置

### 1. 创建本地配置文件

```bash
cd config
cp production.local.yaml.example production.local.yaml
```

### 2. 配置密钥

编辑 `production.local.yaml`：

```yaml
# 数据库连接（生产环境真实凭据）
database:
  url: postgresql://prod_user:strong_password@db.example.com:5432/prod_db?schema=public

# Redis 连接
redis:
  password: redis_strong_password

# JWT 密钥（必须配置强随机密钥）
auth:
  access-token-secret: <使用 openssl rand -base64 64 生成>
  refresh-token-secret: <使用 openssl rand -base64 64 生成>
  # 可选：缩短访问令牌有效期
  access-token-ttl: 900  # 15分钟

# API 加解密密钥
api-decrypt:
  private-key: YOUR_PRODUCTION_RSA_PRIVATE_KEY
  public-key: YOUR_PRODUCTION_RSA_PUBLIC_KEY
```

### 3. 配置环境变量

```bash
export NODE_ENV=production
```

### 4. 验证配置

启动应用时会自动验证所有配置域：

```bash
npm run start:prod
```

如果配置有误，应用会在启动时报错并显示具体的验证错误。

## 开发环境配置

开发环境使用默认配置即可启动，无需创建 `development.local.yaml`。

如需覆盖某些配置，创建 `config/development.local.yaml`：

```yaml
# 开发环境本地配置
database:
  url: postgresql://dev:dev@localhost:5432/nest_admin_dev?schema=public

# 开发环境启用 SQL 日志
database:
  log-queries: true

# 开发环境彩色日志
logger:
  console:
    pretty: true
```

## 配置最佳实践

### ✅ 应该做的

1. **使用强随机密钥**
   ```bash
   openssl rand -base64 64
   ```

2. **分离敏感信息**
   - 密钥、密码放在 `.local.yaml` 文件
   - `.local.yaml` 文件不入库（已在 `.gitignore`）

3. **环境隔离**
   - 生产环境使用独立的数据库和 Redis
   - 使用不同的 `key-prefix` 隔离缓存

4. **最小权限原则**
   - 数据库用户只授予必要的权限
   - Redis 使用 ACL 限制命令

5. **监控和告警**
   - 生产环境使用 JSON 日志格式
   - 配置日志采集和告警

### ❌ 不应该做的

1. **不要提交敏感信息**
   - ❌ 不要把真实密钥提交到 `default.yaml` 或 `production.yaml`
   - ❌ 不要把 `.local.yaml` 文件提交到代码仓库

2. **不要使用弱密钥**
   - ❌ 不要使用默认密钥用于生产环境
   - ❌ 不要使用简单的字符串如 "secret123"

3. **不要混用环境**
   - ❌ 不要在开发环境使用生产数据库
   - ❌ 不要在生产环境启用调试日志

## 配置验证

配置在应用启动时会自动验证，包括：

- **类型检查**: 确保配置项类型正确
- **必填项检查**: 确保必填配置项不为空
- **格式验证**: 验证端口号、URL 等格式
- **范围检查**: 验证数值在合理范围内

验证失败会抛出详细的错误信息：

```
Configuration validation failed for domain 'auth':
  - access-token-secret must be a string
  - access-token-ttl must be at least 60
```

## 添加新配置域

1. **创建配置域文件**

在 `libs/config/src/domains/` 创建新文件：

```typescript
// libs/config/src/domains/my-feature.domain.ts
import { IsString, IsInt, Min } from 'class-validator';
import { defineConfigDomain } from '../core/define-domain.js';
import { integerParser } from '../core/parsers.js';

export class MyFeatureConfig {
  @IsString()
  apiKey!: string;

  @IsInt()
  @Min(1)
  timeout!: number;
}

export const myFeatureDomain = defineConfigDomain({
  name: 'my-feature',
  schema: MyFeatureConfig,
  defaults: {
    apiKey: 'default-key',
    timeout: 5000,
  },
  parsers: {
    timeout: integerParser,
  },
});

export const myFeatureConfig = myFeatureDomain.token;
```

2. **注册配置域**

在 `libs/config/src/domains/index.ts` 中注册：

```typescript
import { myFeatureConfig, myFeatureDomain } from './my-feature.domain.js';

export const DOMAINS = [
  // ... 其他域
  myFeatureDomain,
] as const;

export { myFeatureConfig };
export type { MyFeatureConfig } from './my-feature.domain.js';
```

3. **添加配置到 YAML**

在 `config/default.yaml` 中添加：

```yaml
my-feature:
  api-key: default-key
  timeout: 5000
```

4. **使用配置**

在服务中注入：

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { myFeatureConfig, type MyFeatureConfig } from '@app/config';

@Injectable()
export class MyService {
  constructor(
    @Inject(myFeatureConfig.KEY) private readonly config: MyFeatureConfig,
  ) {}

  doSomething() {
    console.log(this.config.apiKey);
    console.log(this.config.timeout);
  }
}
```

## 故障排查

### 配置加载失败

**问题**: 应用启动时报配置验证错误

**解决**:
1. 检查 YAML 文件语法是否正确
2. 确认所有必填项已配置
3. 验证配置项类型是否匹配
4. 查看详细的验证错误信息

### JWT 验证失败

**问题**: 登录后访问接口返回 401

**解决**:
1. 确认 JWT 密钥在所有实例中一致
2. 检查 `issuer` 和 `audience` 配置
3. 验证令牌是否过期
4. 检查令牌格式是否正确

### 数据库连接失败

**问题**: 应用无法连接数据库

**解决**:
1. 验证数据库 URL 格式
2. 确认数据库用户名和密码
3. 检查网络连接和防火墙
4. 验证数据库是否启动

## 参考资料

- [NestJS Configuration](https://docs.nestjs.com/techniques/configuration)
- [class-validator](https://github.com/typestack/class-validator)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- [OpenSSL Commands](https://www.openssl.org/docs/man1.1.1/man1/)

---

**最后更新**: 2025-01-24
