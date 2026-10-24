# Permission Module

企业级 RBAC 权限控制模块，提供基于装饰器的权限声明和判定能力。

## 功能特性

- 🔒 **装饰器权限声明**: 使用 `@Permission` 装饰器声明路由权限
- 🔄 **灵活的判定模式**: 支持 AND/OR 模式，满足复杂权限需求
- ⚡ **高性能缓存**: 基于用户权限版本号的智能缓存机制
- 🛡️ **超级管理员**: 自动通过所有权限检查
- 🎭 **角色兜底**: 支持角色作为权限的兜底机制
- 📊 **完整的测试覆盖**: 单元测试覆盖率 > 80%

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 导入模块

```typescript
import { Module } from '@nestjs/common';
import { PermissionModule } from '@app/permission';
import { AuthModule } from '@app/auth';

@Module({
  imports: [
    AuthModule,        // 必须先导入 AuthModule
    PermissionModule,  // 然后导入 PermissionModule
  ],
})
export class AppModule {}
```

### 3. 注册全局守卫

在 `CoreModule` 中注册全局守卫：

```typescript
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from '@app/auth';
import { PermissionGuard } from '@app/permission';

@Module({
  providers: [
    // 守卫执行顺序很重要
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
})
export class CoreModule {}
```

### 4. 使用装饰器

```typescript
import { Controller, Get, Post } from '@nestjs/common';
import { Permission, Mode } from '@app/permission';

@Controller('users')
export class UserController {
  // 单个权限
  @Get()
  @Permission('system:user:view')
  findAll() {
    return [];
  }

  // 多个权限（AND 模式）
  @Post()
  @Permission(['system:user:add', 'system:user:view'])
  create() {
    return { id: 1 };
  }

  // OR 模式
  @Post('save')
  @Permission({ value: ['system:user:add', 'system:user:edit'], mode: Mode.OR })
  save() {
    return { id: 1 };
  }

  // 带角色兜底
  @Delete(':id')
  @Permission({ value: 'system:user:remove', role: 'admin' })
  remove() {
    return { success: true };
  }
}
```

## API 文档

### 装饰器

#### `@Permission(input: PermissionInput)`

声明路由需要的权限。

**参数类型**:

```typescript
type PermissionInput =
  | string                              // 单个权限
  | string[]                            // 权限数组（默认 AND）
  | {
      value: string | string[];         // 权限值
      mode?: Mode;                      // AND/OR 模式
      role?: string;                    // 角色兜底
    };
```

**示例**:

```typescript
// 1. 单个权限
@Permission('system:user:view')

// 2. 多个权限（AND 模式）
@Permission(['system:user:view', 'system:user:edit'])

// 3. OR 模式
@Permission({ value: ['system:user:add', 'system:user:edit'], mode: Mode.OR })

// 4. 带角色兜底
@Permission({ value: 'system:user:remove', role: 'admin' })
```

### 服务

#### `PermissionService`

权限解析和缓存服务。

**方法**:

```typescript
class PermissionService {
  // 解析用户权限（带缓存）
  resolveUserPermissions(userId: bigint): Promise<Set<string>>;

  // 失效用户权限缓存
  invalidateUserPermissions(userIds: bigint[]): Promise<void>;

  // 失效角色权限缓存
  invalidateRolePermissions(roleId: bigint): Promise<void>;

  // 清除所有缓存
  clearAllCache(): void;
}
```

**使用示例**:

```typescript
import { PermissionService } from '@app/permission';

@Injectable()
export class RoleService {
  constructor(private readonly permissionService: PermissionService) {}

  async updateRolePermissions(roleId: bigint, permissionIds: bigint[]) {
    // 更新角色权限...

    // 失效该角色所有用户的权限缓存
    await this.permissionService.invalidateRolePermissions(roleId);
  }
}
```

### 守卫

#### `PermissionGuard`

权限判定守卫，自动注册为全局守卫。

**执行流程**:

1. 读取 `@Permission` 元数据
2. 获取当前用户（从 `request.user`）
3. 检查超级管理员
4. 检查角色兜底
5. 解析用户权限
6. 判定权限（AND/OR 模式）
7. 返回结果或抛出异常

**错误响应**:

- `401 Unauthorized`: 用户未认证
- `403 Forbidden`: 权限不足

## 权限判定逻辑

### AND 模式（默认）

用户必须拥有**所有**指定的权限：

```typescript
@Permission(['system:user:view', 'system:user:edit'])
// 用户必须同时拥有 view 和 edit 权限
```

### OR 模式

用户只需拥有**至少一个**指定的权限：

```typescript
@Permission({ value: ['system:user:add', 'system:user:edit'], mode: Mode.OR })
// 用户拥有 add 或 edit 权限之一即可
```

### 角色兜底

用户拥有指定角色**或**满足权限要求即可：

```typescript
@Permission({ value: 'system:user:remove', role: 'admin' })
// 用户拥有 admin 角色 或 remove 权限即可
```

### 超级管理员

拥有 `roleKey = 'superadmin'` 角色的用户自动通过所有权限检查。

## 缓存机制

### 缓存键设计

```
user:perms:{userId}:{permissionVersion}
```

示例: `user:perms:1:5`

### 缓存流程

1. 用户访问受保护路由
2. PermissionGuard 调用 `PermissionService.resolveUserPermissions(userId)`
3. 检查缓存 `user:perms:{userId}:{version}`
4. 缓存命中 → 直接返回
5. 缓存未命中 → 查询数据库 → 缓存结果（TTL 1小时）

### 缓存失效

**用户角色变更时**:
```typescript
await permissionService.invalidateUserPermissions([userId]);
```

**角色权限变更时**:
```typescript
await permissionService.invalidateRolePermissions(roleId);
```

缓存失效原理：递增用户的 `permissionVersion` 字段，旧缓存键自动失效。

## 权限编码规范

遵循 `<module>:<resource>:<action>` 格式：

```typescript
// ✅ 正确
'system:user:view'
'system:user:add'
'system:user:edit'
'system:user:remove'
'system:role:assign'

// ❌ 错误
'viewUser'
'USER_VIEW'
'system-user-view'
```

**标准动作**:

| 动作 | 说明 |
|------|------|
| `view` | 查看/查询 |
| `add` | 新增 |
| `edit` | 编辑 |
| `remove` | 删除 |
| `export` | 导出 |
| `import` | 导入 |
| `resetPwd` | 重置密码 |
| `assign` | 分配（角色、部门等） |
| `scope` | 数据范围设置 |

## 测试

### 运行测试

```bash
# 单元测试
pnpm test libs/permission

# 测试覆盖率
pnpm test:cov libs/permission

# 监听模式
pnpm test:watch libs/permission
```

### 测试文件

- `permission.service.spec.ts` - PermissionService 单元测试
- `permission.guard.spec.ts` - PermissionGuard 单元测试
- `permission.decorator.spec.ts` - Permission 装饰器单元测试

## 故障排查

### 权限变更后仍无法访问

**原因**: 权限缓存未失效

**解决**:
1. 检查是否调用了 `invalidateUserPermissions` 或 `invalidateRolePermissions`
2. 检查用户的 `permissionVersion` 是否递增
3. 手动清除缓存: `permissionService.clearAllCache()`

### 所有用户都可以访问受保护路由

**原因**: 未注册 PermissionGuard 或装饰器使用错误

**解决**:
1. 检查 `CoreModule` 是否注册了 `PermissionGuard`
2. 检查守卫注册顺序: `AuthGuard` 必须在 `PermissionGuard` 之前
3. 检查装饰器是否正确导入: `import { Permission } from '@app/permission'`

### 超级管理员也被拒绝

**原因**: 角色键不匹配或角色未启用

**解决**:
1. 检查用户的角色键是否为 `'superadmin'`（精确匹配）
2. 检查角色状态: `status='0'`, `delFlag='0'`
3. 检查用户状态: `status='0'`, `delFlag='0'`

## 架构设计

### 模块依赖

```
PermissionModule
  ├── DatabaseModule (Prisma 数据库访问)
  └── (隐式依赖) AuthModule (UserPrincipal 类型)
```

### 守卫执行顺序

```
HTTP Request
    ↓
ThrottlerGuard (限流)
    ↓
AuthGuard (JWT 验证 → 设置 request.user)
    ↓
PermissionGuard (读取 @Permission → 权限判定)
    ↓
Controller Handler
```

### 数据查询路径

```
User (用户)
  ↓
UserRole (用户-角色关联)
  ↓
Role (角色)
  ↓
RolePermission (角色-权限关联)
  ↓
Permission (权限)
```

## 最佳实践

### 1. 权限粒度

合理设计权限粒度，避免过细或过粗。

### 2. 避免硬编码

将权限编码定义为常量：

```typescript
export const PERMISSIONS = {
  USER: {
    VIEW: 'system:user:view',
    ADD: 'system:user:add',
    EDIT: 'system:user:edit',
    REMOVE: 'system:user:remove',
  },
} as const;
```

### 3. 文档化

为每个受保护的路由添加注释说明权限要求。

### 4. 测试覆盖

每个受保护的路由都应该有对应的权限测试。

### 5. 及时失效缓存

权限变更后及时调用失效方法，确保权限立即生效。

## 相关文档

- [批次 3 完成总结](../../docs/rbac/batch-3-completion-summary.md)
- [批次 3 使用示例](../../docs/rbac/batch-3-permission-usage-example.md)
- [RBAC 实施设计](../../docs/rbac/b-rbac-implementation.md)

## 许可证

MIT
