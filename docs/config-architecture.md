# 配置模块架构说明

## 设计原则

### 1. 统一性
- 所有配置域使用相同的函数式风格
- 避免混用多种编程范式

### 2. 简洁性
- 核心代码不超过 500 行
- 每个配置域独立且清晰

### 3. 类型安全
- 完全的 TypeScript 类型推导
- 运行时类型校验

### 4. 灵活性
- 支持环境差异化配置
- 支持本地配置覆盖

## 核心架构

```
libs/config/src/
├── core/                      # 核心工具
│   ├── types.ts              # 类型定义
│   ├── define-domain.ts      # 配置域定义器
│   ├── config-loader.ts      # YAML 加载器
│   ├── validate.ts           # 配置编译和缓存
│   └── parsers.ts            # 通用解析器
├── domains/                   # 配置域（每个域一个文件）
│   ├── app.domain.ts
│   ├── auth.domain.ts
│   ├── database.domain.ts
│   ├── redis.domain.ts
│   ├── logger.domain.ts
│   ├── swagger.domain.ts
│   ├── throttler.domain.ts
│   ├── api-decrypt.domain.ts
│   └── index.ts              # 域注册表
├── config.module.ts           # NestJS 模块
└── index.ts                   # 公共 API
```

## 配置域定义模式

### 标准模板

```typescript
import { asBoolean, asObject, asString, asStrictInteger, defineConfigDomain } from '../core/index.js';

// 1. 定义接口（描述配置结构）
export interface MyFeatureConfig {
  enabled: boolean;
  apiKey: string;
  timeout: number;
}

// 2. 定义配置域
export const myFeatureDomain = defineConfigDomain<MyFeatureConfig>({
  namespace: 'my-feature',  // 对应 YAML 中的顶层键
  parse(raw): MyFeatureConfig {
    const value = asObject(raw, 'my-feature');
    return {
      enabled: asBoolean(value.enabled, 'my-feature.enabled', true),
      apiKey: asString(value['api-key'], 'my-feature.api-key'),
      timeout: asStrictInteger(value.timeout, 'my-feature.timeout', 5000, 1),
    };
  },
});

// 3. 导出注入令牌
export const myFeatureConfig = myFeatureDomain.token;
```

### 可选的验证逻辑

```typescript
export const myFeatureDomain = defineConfigDomain<MyFeatureConfig>({
  namespace: 'my-feature',
  parse(raw): MyFeatureConfig {
    // ... parse logic
  },
  validate(config, context): void {
    // 自定义验证逻辑
    if (context.environment === 'production' && config.apiKey === 'default-key') {
      throw new Error('my-feature: 生产环境必须配置真实 API 密钥');
    }
  },
});
```

## 解析器工具

### 基础解析器

| 函数 | 用途 | 示例 |
|------|------|------|
| `asString(value, path, fallback?)` | 字符串解析 | `asString(value.host, 'redis.host', '127.0.0.1')` |
| `asBoolean(value, path, fallback?)` | 布尔值解析 | `asBoolean(value.enabled, 'redis.enabled', false)` |
| `asInteger(value, path, fallback, min)` | 整数解析（宽松） | `asInteger(value.port, 'app.port', 3000, 1)` |
| `asStrictInteger(value, path, fallback, min, max?)` | 整数解析（严格） | `asStrictInteger(value.ttl, 'redis.ttl', 60000, 1, 2147483647)` |
| `asPositiveInteger(value, path, fallback)` | 正整数解析 | `asPositiveInteger(value.maxFiles, 'logger.max-files', 15)` |
| `asEnum(value, path, allowed, fallback?)` | 枚举解析 | `asEnum(value.level, 'logger.level', LOG_LEVELS, 'info')` |
| `asObject(value, path, fallback?)` | 对象解析 | `asObject(raw, 'redis')` |

### 可选值解析器

| 函数 | 用途 | 示例 |
|------|------|------|
| `asOptionalString(value, path)` | 可选字符串 | `asOptionalString(value.username, 'redis.username')` |
| `asList(value, path, fallback?)` | 字符串数组 | `asList(value.origins, 'cors.origins')` |
| `asOptionalList(value, path)` | 可选数组 | `asOptionalList(value.tags, 'app.tags')` |

### 解析器特点

- **自动 trim**: 字符串自动去除首尾空格
- **类型转换**: 支持 `number` 转 `string`，`string` 转 `number`
- **缺省值**: 支持配置缺失时使用默认值
- **错误提示**: 解析失败时显示完整的配置路径

## YAML 配置加载

### 加载顺序

```
1. config/default.yaml           # 基线配置
2. config/{NODE_ENV}.yaml        # 环境差异配置
3. config/{NODE_ENV}.local.yaml  # 本地敏感配置
```

后者覆盖前者，使用深度合并（deep merge）。

### 配置键命名规范

- **YAML 中**: 使用 `kebab-case`
  ```yaml
  auth:
    access-token-secret: xxx
    refresh-token-ttl: 1800
  ```

- **TypeScript 中**: 使用 `camelCase`
  ```typescript
  interface AuthConfig {
    accessTokenSecret: string;
    refreshTokenTtl: number;
  }
  ```

- **映射**: 在 `parse()` 中手动映射
  ```typescript
  accessTokenSecret: asString(value['access-token-secret'], 'auth.access-token-secret')
  ```

## 配置注入

### 在服务中注入

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { authConfig, type AuthConfig } from '@app/config';

@Injectable()
export class TokenService {
  constructor(
    @Inject(authConfig.KEY) private readonly config: AuthConfig,
  ) {}

  getAccessTokenTtl(): number {
    return this.config.accessTokenTtl;
  }
}
```

### 在模块中注入

```typescript
import { Module } from '@nestjs/common';
import { authConfig, type AuthConfig } from '@app/config';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [authConfig.KEY],
      useFactory: (config: AuthConfig) => ({
        secret: config.accessTokenSecret,
        signOptions: {
          expiresIn: `${config.accessTokenTtl}s`,
        },
      }),
    }),
  ],
})
export class AuthModule {}
```

## 配置验证流程

### 启动时验证

```
1. loadConfigSource()          # 加载并合并 YAML 文件
2. compileConfig(domains)      # 编译所有配置域
   └─> 遍历每个域:
       ├─> domain.parse()      # 解析原始值
       └─> domain.validate()   # 可选验证
3. 缓存编译结果
4. 注册到 NestJS ConfigModule
```

### 验证失败示例

```
配置校验失败：
  - auth.access-token-secret: 必须是非空字符串
  - redis.port: 必须小于等于 65535
  - logger: 控制台与文件输出至少启用一个
```

## 添加新配置域

### 步骤 1: 创建域文件

**文件**: `libs/config/src/domains/email.domain.ts`

```typescript
import { asBoolean, asObject, asString, asStrictInteger, defineConfigDomain } from '../core/index.js';

export interface EmailConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  from: string;
}

export const emailDomain = defineConfigDomain<EmailConfig>({
  namespace: 'email',
  parse(raw): EmailConfig {
    const value = asObject(raw, 'email');
    return {
      enabled: asBoolean(value.enabled, 'email.enabled', false),
      host: asString(value.host, 'email.host', 'localhost'),
      port: asStrictInteger(value.port, 'email.port', 25, 1, 65535),
      secure: asBoolean(value.secure, 'email.secure', false),
      from: asString(value.from, 'email.from', 'noreply@example.com'),
    };
  },
});

export const emailConfig = emailDomain.token;
```

### 步骤 2: 注册到域列表

**文件**: `libs/config/src/domains/index.ts`

```typescript
import { emailConfig, emailDomain } from './email.domain.js';

export const DOMAINS = [
  appDomain,
  // ... 其他域
  emailDomain,  // 添加到这里
] as const;

export { emailConfig };  // 导出注入令牌
export type { EmailConfig } from './email.domain.js';  // 导出类型
```

### 步骤 3: 添加 YAML 配置

**文件**: `config/default.yaml`

```yaml
email:
  enabled: false
  host: localhost
  port: 25
  secure: false
  from: noreply@example.com
```

### 步骤 4: 使用配置

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { emailConfig, type EmailConfig } from '@app/config';

@Injectable()
export class EmailService {
  constructor(
    @Inject(emailConfig.KEY) private readonly config: EmailConfig,
  ) {}

  async sendEmail() {
    if (!this.config.enabled) {
      throw new Error('Email service is disabled');
    }
    // 使用 this.config.host, this.config.port 等
  }
}
```

## 最佳实践

### ✅ 推荐做法

1. **配置域独立**: 每个域一个文件，职责单一
2. **接口定义**: 使用 `interface` 而非 `class`
3. **默认值**: 合理设置默认值，减少配置负担
4. **路径完整**: 错误信息包含完整的配置路径
5. **文档注释**: 为每个配置项添加 JSDoc 注释
6. **环境隔离**: 生产环境使用 `.local.yaml`

### ❌ 避免做法

1. ❌ 在 parse 中使用 class decorator（已废弃）
2. ❌ 在 parse 中使用 async 函数（同步解析）
3. ❌ 在配置中存储运行时状态
4. ❌ 在不同域之间引用（保持独立）
5. ❌ 硬编码敏感信息
6. ❌ 使用复杂的嵌套结构

## 配置模块特性

### 已实现

- ✅ YAML 文件加载和合并
- ✅ 环境差异化配置
- ✅ 类型安全的配置注入
- ✅ 启动时配置验证
- ✅ 配置缓存和性能优化
- ✅ 详细的错误提示
- ✅ 深度合并支持

### 未实现（可扩展）

- ⏳ 配置热重载
- ⏳ 配置加密存储
- ⏳ 配置中心集成（Consul/Nacos）
- ⏳ 环境变量覆盖
- ⏳ 配置变更审计
- ⏳ 配置版本管理

## 故障排查

### 配置加载失败

**症状**: 应用启动时报 "缺少配置基线层"

**原因**: 找不到 `config/default.yaml`

**解决**:
- 确认工作目录是项目根目录
- 确认 `config/default.yaml` 文件存在

### 配置验证失败

**症状**: 应用启动时报 "配置校验失败"

**原因**: 配置项类型不匹配或超出范围

**解决**:
- 查看错误信息中的配置路径
- 检查对应的 YAML 配置
- 参考配置文档检查类型和范围

### 配置注入失败

**症状**: 运行时报 "配置域尚未编译"

**原因**: AppConfigModule 未正确导入

**解决**:
- 确认 AppModule 导入了 AppConfigModule.forRoot()
- 确认导入顺序（ConfigModule 应该优先）

## 性能考虑

### 配置缓存

- 配置只在应用启动时加载一次
- 编译结果缓存在内存中
- 注入时直接返回缓存的配置对象

### 内存占用

- 单个配置域: ~1KB
- 所有配置域: ~10KB
- 可忽略不计

### 启动时间

- YAML 解析: ~5ms
- 配置编译: ~10ms
- 对启动时间影响极小

## 相关文档

- [配置指南](./configuration-guide.md) - 用户使用文档
- [配置设置总结](./config-setup-summary.md) - 实施记录
- [配置迁移文档](./config-migration-from-env.md) - 从环境变量迁移

---

**最后更新**: 2025-01-24  
**版本**: 2.0（简化版）
