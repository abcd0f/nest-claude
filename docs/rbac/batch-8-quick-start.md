# 批次 8 快速启动指南

## 实施完成

批次 8 已完成所有核心功能的实现，包括：

✅ 审计模块（`libs/audit`）  
✅ 登录日志服务  
✅ 操作日志服务  
✅ 敏感数据脱敏  
✅ 审计拦截器（全局）  
✅ 审计查询API  
✅ 认证网关  
✅ 权限种子更新  

## 待执行步骤

### 1. 同步权限种子

添加了 6 个新的审计权限，需要同步到数据库：

```bash
npm run permission:sync
```

这将添加以下权限：
- `system:loginLog:view` - 登录日志查看
- `system:loginLog:remove` - 登录日志删除
- `system:loginLog:export` - 登录日志导出
- `system:operLog:view` - 操作日志查看
- `system:operLog:remove` - 操作日志删除
- `system:operLog:export` - 操作日志导出

### 2. 为超级管理员分配权限

登录系统后，为 `superadmin` 角色分配新增的审计权限。

### 3. 测试登录日志

```bash
# 1. 登录
POST /auth/login
{
  "username": "admin",
  "password": "Admin@123456"
}

# 2. 查看登录日志
GET /system/login-log?page=1&pageSize=10
```

### 4. 测试操作日志

在任何标记了 `@Audit()` 的接口执行操作后，查询操作日志：

```bash
GET /system/operation-log?page=1&pageSize=10
```

### 5. 验证敏感数据脱敏

查看操作日志的 `operParam` 字段，确认密码等敏感信息已被脱敏。

## 新增文件清单

### 审计模块（libs/audit）

```
libs/audit/
├── src/
│   ├── audit.module.ts                          # 审计模块
│   ├── index.ts                                 # 导出入口
│   ├── enums/
│   │   ├── operation-type.enum.ts               # 操作类型枚举
│   │   └── index.ts
│   ├── types/
│   │   ├── audit-context.type.ts                # 审计上下文类型
│   │   └── index.ts
│   ├── decorators/
│   │   ├── audit.decorator.ts                   # @Audit() 装饰器
│   │   └── index.ts
│   ├── services/
│   │   ├── login-log.service.ts                 # 登录日志服务
│   │   ├── operation-log.service.ts             # 操作日志服务
│   │   ├── sensitive-data.service.ts            # 敏感数据脱敏
│   │   └── index.ts
│   ├── interceptors/
│   │   ├── audit.interceptor.ts                 # 审计拦截器
│   │   └── index.ts
│   └── dto/
│       ├── login-log-query.dto.ts               # 登录日志查询DTO
│       ├── login-log-response.dto.ts            # 登录日志响应DTO
│       ├── operation-log-query.dto.ts           # 操作日志查询DTO
│       ├── operation-log-response.dto.ts        # 操作日志响应DTO
│       └── index.ts
├── package.json
└── tsconfig.json
```

### 审计查询模块（apps/gateway）

```
apps/gateway/src/modules/
├── auth/
│   ├── auth-gateway.controller.ts               # 认证控制器
│   └── auth-gateway.module.ts                   # 认证网关模块
└── system/audit/
    ├── audit.module.ts                          # 审计查询模块
    ├── services/
    │   └── audit-query.service.ts               # 审计查询服务
    └── controllers/
        ├── login-log.controller.ts              # 登录日志控制器
        └── operation-log.controller.ts          # 操作日志控制器
```

### 配置更新

```
- tsconfig.json                                  # 添加 @app/audit 路径映射
- libs/core/src/core.module.ts                   # 注册全局审计拦截器
- apps/gateway/src/app.module.ts                 # 导入审计和认证模块
- apps/gateway/src/modules/system/system.module.ts  # 导入审计查询模块
- libs/permission/src/seeds/permissions.seed.ts  # 添加 6 个审计权限
```

### 文档

```
- docs/rbac/batch-8-audit-implementation.md      # 完整实施文档
- docs/rbac/batch-8-quick-start.md               # 快速启动指南（本文件）
- memory/batch-8-audit-completed.md              # 项目记忆
```

## API 端点清单

### 认证接口（`/auth`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/auth/login` | 公开 | 用户登录 |
| POST | `/auth/logout` | 认证 | 用户登出 |
| POST | `/auth/refresh` | 公开 | 刷新Token |

### 登录日志（`/system/login-log`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/system/login-log` | `system:loginLog:view` | 查询登录日志 |
| DELETE | `/system/login-log/:infoId` | `system:loginLog:remove` | 删除单条日志 |
| DELETE | `/system/login-log` | `system:loginLog:remove` | 批量删除 |
| DELETE | `/system/login-log/clear/all` | `system:loginLog:remove` | 清空所有 |

### 操作日志（`/system/operation-log`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/system/operation-log` | `system:operLog:view` | 查询操作日志 |
| DELETE | `/system/operation-log/:operId` | `system:operLog:remove` | 删除单条日志 |
| DELETE | `/system/operation-log` | `system:operLog:remove` | 批量删除 |
| DELETE | `/system/operation-log/clear/all` | `system:operLog:remove` | 清空所有 |

## 使用示例

### 在 Controller 中添加审计

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { Audit, OperationType } from '@app/audit';
import { Permission } from '@app/permission';

@Controller('system/user')
export class UserController {
  // 自动记录操作日志
  @Post()
  @Permission('system:user:add')
  @Audit({ title: '用户管理', operationType: OperationType.CREATE })
  async create(@Body() dto: CreateUserDto) {
    // 业务逻辑
  }

  // 大文件上传，不记录参数
  @Post('import')
  @Permission('system:user:import')
  @Audit({
    title: '用户导入',
    operationType: OperationType.IMPORT,
    recordParams: false,  // 不记录请求参数
  })
  async import(@Body() file: Buffer) {
    // 业务逻辑
  }
}
```

### 查询审计日志

```typescript
// 登录日志查询
const response = await fetch('/system/login-log?userName=admin&status=0&page=1&pageSize=10');

// 操作日志查询
const response = await fetch('/system/operation-log?title=用户管理&operUserId=1&page=1&pageSize=10');
```

## 配置建议

### 日志保留策略

- **登录日志**: 保留 3-6 个月
- **操作日志**: 保留 1-2 年
- **定期归档**: 可以迁移到冷存储

### 需要审计的操作

✅ 必须审计：
- 用户/角色/权限的增删改
- 密码重置/修改
- 权限分配/撤销
- 数据导入/导出
- 系统配置修改

❌ 不建议审计：
- 频繁的查询操作
- 健康检查接口
- 静态资源访问

### 性能优化

1. **异步记录**: 日志记录不阻塞主流程
2. **数据库索引**: 已在日志表添加索引
3. **分页查询**: 避免全表扫描
4. **定期清理**: 避免日志表过大

## 故障排查

### 日志没有记录

1. 检查是否添加了 `@Audit()` 装饰器
2. 检查 `CoreModule` 是否注册了 `AuditInterceptor`
3. 查看应用日志，确认是否有错误

### 敏感数据未脱敏

1. 检查字段名是否在脱敏列表中
2. 查看 `SensitiveDataService` 的配置
3. 可以自定义脱敏规则

### 登录日志没有记录

1. 检查 `AuthGatewayController` 是否正确集成
2. 确认 `LoginLogService` 是否正确注入
3. 查看数据库是否有连接错误

## 下一步工作

批次 9 的工作内容：

1. **前端集成测试**
   - 前端菜单管理页面联调
   - 前端角色管理页面联调
   - 前端用户管理页面联调
   - 前端权限按钮显示联调

2. **完整业务流程 E2E 测试**
   - 用户登录 → 查看审计日志
   - 创建用户 → 分配角色 → 查看操作日志
   - 修改权限 → 验证审计记录

3. **并发测试**
   - 角色授权并发测试
   - 权限缓存失效测试

4. **越权测试**
   - IDOR 测试
   - 垂直越权测试
   - 水平越权测试

5. **性能测试**
   - 权限查询性能
   - 缓存命中率
   - 审计日志写入性能

## 参考文档

- [完整实施文档](./batch-8-audit-implementation.md)
- [RBAC 实现文档](./b-rbac-implementation.md)
- [批次 7 完成总结](../../.claude/projects/d--project-nest-new/memory/batch-7-permission-tools-completed.md)

---

**实施日期**: 2025-01-24  
**状态**: ✅ 实施完成，待测试验证
