# 批次 8：审计和监控实现

## 概述

批次 8 实现了完整的审计和监控功能，包括登录日志、操作日志、敏感数据脱敏和审计查询接口。

## 实现的功能

### 1. 核心审计模块（`libs/audit`）

#### 1.1 审计装饰器

**文件**: `libs/audit/src/decorators/audit.decorator.ts`

```typescript
@Audit({ title: '用户管理', operationType: OperationType.CREATE })
@Post()
async create() {}
```

- 标记需要记录操作日志的接口
- 支持配置是否记录请求参数和响应结果

#### 1.2 审计拦截器

**文件**: `libs/audit/src/interceptors/audit.interceptor.ts`

- 自动拦截带 `@Audit()` 装饰器的接口
- 记录操作日志：
  - 模块标题、请求方法
  - 操作人用户ID、请求URL
  - 操作IP、请求参数（脱敏后）
  - 操作状态、错误消息、耗时

#### 1.3 登录日志服务

**文件**: `libs/audit/src/services/login-log.service.ts`

核心方法：
- `logSuccess()` - 记录登录成功
- `logFailure()` - 记录登录失败
- `logLogout()` - 记录登出

#### 1.4 操作日志服务

**文件**: `libs/audit/src/services/operation-log.service.ts`

核心方法：
- `log()` - 记录操作日志
  - 自动捕获请求上下文
  - 记录操作耗时
  - 区分成功/失败状态

#### 1.5 敏感数据脱敏服务

**文件**: `libs/audit/src/services/sensitive-data.service.ts`

脱敏策略：
- **完全移除**: password, token, secret, privateKey 等
- **部分脱敏**: phone, email, idCard（保留前后2位，中间用*代替）
- 递归处理嵌套对象和数组

示例：
```typescript
// 输入
{
  username: 'admin',
  password: '123456',
  phone: '13800138000'
}

// 输出
{
  username: 'admin',
  password: '***',
  phone: '13******00'
}
```

### 2. 审计查询模块（`apps/gateway/src/modules/system/audit`）

#### 2.1 登录日志查询

**控制器**: `LoginLogController`
**服务**: `AuditQueryService`

API 端点：
- `GET /system/login-log` - 查询登录日志列表
- `DELETE /system/login-log/:infoId` - 删除单条日志
- `DELETE /system/login-log` - 批量删除日志
- `DELETE /system/login-log/clear/all` - 清空所有日志

查询条件：
- 登录账号（模糊匹配）
- 登录IP（模糊匹配）
- 登录状态（0=成功, 1=失败）
- 时间范围（开始时间、结束时间）
- 分页（page, pageSize）

#### 2.2 操作日志查询

**控制器**: `OperationLogController`
**服务**: `AuditQueryService`

API 端点：
- `GET /system/operation-log` - 查询操作日志列表
- `DELETE /system/operation-log/:operId` - 删除单条日志
- `DELETE /system/operation-log` - 批量删除日志
- `DELETE /system/operation-log/clear/all` - 清空所有日志

查询条件：
- 模块标题（模糊匹配）
- 操作人用户ID
- 操作状态（0=成功, 1=失败）
- 时间范围（开始时间、结束时间）
- 分页（page, pageSize）

### 3. 认证网关模块（`apps/gateway/src/modules/auth`）

#### 3.1 登录接口

**文件**: `AuthGatewayController`

```typescript
POST /auth/login
```

功能：
- 调用认证服务进行用户身份验证
- 自动记录登录成功/失败日志
- 记录客户端IP和User-Agent
- 返回访问令牌和刷新令牌

#### 3.2 登出接口

```typescript
POST /auth/logout
```

功能：
- 记录登出日志
- 撤销会话（待实现）

#### 3.3 刷新Token接口

```typescript
POST /auth/refresh
```

功能：
- 验证并刷新访问令牌
- 保持会话连续性

### 4. 权限种子更新

**文件**: `libs/permission/src/seeds/permissions.seed.ts`

新增权限：

**登录日志**:
- `system:loginLog:view` - 登录日志查看
- `system:loginLog:remove` - 登录日志删除
- `system:loginLog:export` - 登录日志导出

**操作日志**:
- `system:operLog:view` - 操作日志查看
- `system:operLog:remove` - 操作日志删除
- `system:operLog:export` - 操作日志导出

## 架构集成

### 全局拦截器配置

**文件**: `libs/core/src/core.module.ts`

拦截器执行顺序：
1. **AuditInterceptor** - 审计日志记录（记录操作日志）
2. **ResponseInterceptor** - 响应格式化（统一响应格式）

### 模块依赖关系

```
CoreModule (全局)
  ├── AuditModule (全局审计服务)
  │   ├── LoginLogService
  │   ├── OperationLogService
  │   ├── SensitiveDataService
  │   └── AuditInterceptor
  └── ...

AuthGatewayModule
  ├── AuthModule
  └── AuditModule (登录日志)

SystemModule
  └── AuditQueryModule (审计查询API)
      └── DatabaseModule
```

## 使用指南

### 1. 记录登录日志

登录日志由 `AuthGatewayController` 自动记录，无需手动调用。

### 2. 记录操作日志

使用 `@Audit()` 装饰器标记需要审计的接口：

```typescript
import { Audit, OperationType } from '@app/audit';

@Controller('system/user')
export class UserController {
  // 自动记录操作日志
  @Post()
  @Audit({ title: '用户管理', operationType: OperationType.CREATE })
  async create(@Body() dto: CreateUserDto) {
    // 业务逻辑
  }

  // 不记录请求参数（用于大文件上传等场景）
  @Post('import')
  @Audit({
    title: '用户导入',
    operationType: OperationType.IMPORT,
    recordParams: false,
  })
  async import(@Body() file: Buffer) {
    // 业务逻辑
  }
}
```

### 3. 查询审计日志

#### 登录日志查询

```bash
# 查询所有登录日志
GET /system/login-log?page=1&pageSize=10

# 查询失败的登录记录
GET /system/login-log?status=1&page=1&pageSize=10

# 按用户名查询
GET /system/login-log?userName=admin&page=1&pageSize=10

# 按时间范围查询
GET /system/login-log?startTime=2025-01-01&endTime=2025-01-31
```

#### 操作日志查询

```bash
# 查询所有操作日志
GET /system/operation-log?page=1&pageSize=10

# 查询某个用户的操作
GET /system/operation-log?operUserId=1&page=1&pageSize=10

# 查询失败的操作
GET /system/operation-log?status=1&page=1&pageSize=10

# 按模块查询
GET /system/operation-log?title=用户管理&page=1&pageSize=10
```

### 4. 删除审计日志

```bash
# 删除单条登录日志
DELETE /system/login-log/:infoId

# 批量删除登录日志
DELETE /system/login-log
Body: { "infoIds": ["1", "2", "3"] }

# 清空所有登录日志（高风险操作）
DELETE /system/login-log/clear/all

# 操作日志同理
DELETE /system/operation-log/:operId
DELETE /system/operation-log
DELETE /system/operation-log/clear/all
```

## 数据脱敏策略

### 完全移除的字段

以下字段会被替换为 `***`：
- password, oldPassword, newPassword, confirmPassword
- token, accessToken, refreshToken, authorization
- secret, privateKey, apiKey

### 部分脱敏的字段

以下字段会保留前后各2位，中间用*代替：
- phone, mobile（手机号）
- email（邮箱）
- idCard（身份证）
- bankCard（银行卡号）

### 递归脱敏

脱敏服务会递归处理：
- 嵌套对象
- 数组
- 复杂数据结构

## 最佳实践

### 1. 敏感操作必须审计

高风险操作应使用 `@Audit()` 装饰器：
- 用户/角色/权限的增删改
- 密码重置/修改
- 权限分配/撤销
- 数据导入/导出
- 系统配置修改

### 2. 合理选择审计粒度

```typescript
// ✅ 推荐：只记录写操作
@Audit({ title: '用户管理', operationType: OperationType.CREATE })
@Post()
async create() {}

// ❌ 不推荐：记录所有读操作（会产生大量日志）
@Audit({ title: '用户管理', operationType: OperationType.QUERY })
@Get()
async list() {}
```

### 3. 大数据量操作关闭参数记录

```typescript
// 关闭参数记录，避免日志过大
@Audit({
  title: '用户导入',
  operationType: OperationType.IMPORT,
  recordParams: false,
})
@Post('import')
async import(@Body() data: LargeDataDto) {}
```

### 4. 日志定期清理

建议策略：
- 登录日志保留 3-6 个月
- 操作日志保留 1-2 年
- 可以定期归档到冷存储

## 安全考虑

### 1. 日志访问权限

- 只有系统管理员可以查看审计日志
- 使用 `@Permission()` 保护所有审计查询接口
- 普通用户不能访问其他用户的审计信息

### 2. 日志不可篡改

- 日志记录失败不应阻断业务流程
- 日志只能追加，不能修改
- 删除日志需要高级权限并记录删除操作

### 3. 敏感数据保护

- 所有日志参数都经过脱敏
- 不记录明文密码、Token、密钥
- IP 地址和 User-Agent 用于安全分析

## 性能优化

### 1. 异步日志记录

日志记录使用 `void` 调用，不阻塞主流程：

```typescript
void this.operationLogService.log(context);
```

### 2. 日志记录失败处理

日志服务内部 try-catch，记录失败只打印错误，不抛出异常：

```typescript
try {
  await this.prisma.operLog.create({ data });
} catch (error) {
  this.logger.error('Failed to log operation', error);
  // 不抛出异常，不影响业务
}
```

### 3. 查询优化

- 日志表添加索引：userName, loginTime, operUserId, operTime
- 分页查询，避免全表扫描
- 支持时间范围查询，提高查询效率

## 验收清单

✅ 登录日志 - 成功/失败/登出都自动记录  
✅ 操作日志 - @Audit 装饰器自动记录操作  
✅ 敏感数据脱敏 - 密码、Token等字段自动脱敏  
✅ 审计查询接口 - 支持分页、筛选、删除  
✅ 权限保护 - 所有审计接口都有权限控制  
✅ 全局拦截器 - 自动拦截并记录操作  
✅ 错误处理 - 日志记录失败不影响业务  
✅ 性能优化 - 异步记录、索引优化  

## 下一步建议

1. **日志导出功能** - 支持导出 Excel/CSV 格式
2. **日志归档** - 定期归档旧日志到冷存储
3. **日志分析** - 统计登录失败次数、操作频率等
4. **异常告警** - 检测异常操作模式并告警
5. **审计报表** - 生成审计报表和可视化图表

## 相关文档

- [RBAC 实现文档](./b-rbac-implementation.md) - 批次 8 详细说明
- [批次 7 完成总结](../../.claude/projects/d--project-nest-new/memory/batch-7-permission-tools-completed.md)
- [批次 2 认证模块](../../.claude/projects/d--project-nest-new/memory/batch-2-auth-completed.md)

---

**实施时间**: 2025-01-24  
**状态**: ✅ 已完成
