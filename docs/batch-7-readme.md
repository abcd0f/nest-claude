# 批次 7：权限种子和运维工具

## 概述

批次 7 实现了权限目录管理和诊断工具，包括：

1. **权限种子文件** - 代码化的权限定义
2. **权限同步命令** - 自动同步权限到数据库
3. **权限诊断工具** - 检查权限健康状态
4. **权限管理 API** - HTTP 接口进行权限管理
5. **超级管理员初始化** - 创建第一个管理员账号
6. **数据库备份/恢复** - 安全的数据库操作

## 实现的功能

### 1. 权限种子文件

**位置**: `libs/permission/src/seeds/permissions.seed.ts`

所有系统权限在代码中集中定义，包括：
- 用户管理权限（8个）
- 角色管理权限（7个）
- 菜单管理权限（4个）
- 部门管理权限（5个）
- 职位管理权限（5个）
- 权限管理权限（6个）

**权限命名规范**:
```
<module>:<resource>:<action>

例如：
- system:user:view     # 用户查看
- system:role:add      # 角色新增
- system:menu:edit     # 菜单编辑
```

### 2. 权限同步服务

**位置**: `libs/permission/src/services/permission-sync.service.ts`

提供以下功能：
- `syncPermissions()` - 同步权限种子到数据库
- `checkPermissions()` - 诊断权限健康状态
- `cleanupOrphanPermissions()` - 清理孤儿权限
- `fixInvalidMenuBindings()` - 修复无效的菜单绑定

### 3. CLI 命令

**位置**: `scripts/permission-sync.ts`

#### 同步权限
```bash
npm run permission:sync
```
- 创建不存在的权限
- 更新已存在权限的信息
- 标记孤儿权限（数据库中存在但种子中不存在）

#### 检查权限
```bash
npm run permission:check
```
检查项：
- 总权限数、启用/停用权限数
- 未绑定菜单的权限
- 孤儿权限（没有任何角色使用）
- 重复编码
- 无效的菜单绑定

#### 清理孤儿权限
```bash
npm run permission:cleanup
```
删除没有任何角色使用且未绑定菜单的权限。

**⚠️ 警告**: 此操作不可逆，请谨慎使用！

#### 修复无效绑定
```bash
npm run permission:fix
```
将绑定了不存在菜单的权限解除绑定。

### 4. 权限管理 API

**位置**: `apps/gateway/src/modules/system/permission/`

#### API 端点

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/system/permission/check` | `system:permission:check` | 权限诊断检查 |
| POST | `/system/permission/sync` | `system:permission:sync` | 同步权限种子 |
| DELETE | `/system/permission/orphans` | `system:permission:cleanup` | 清理孤儿权限 |
| POST | `/system/permission/fix-bindings` | `system:permission:fix` | 修复无效绑定 |
| POST | `/system/permission/cache/clear` | `system:permission:cache` | 清除权限缓存 |
| GET | `/system/permission/seeds` | `system:permission:view` | 获取权限种子 |

#### 使用示例

```bash
# 检查权限健康状态
curl -X GET http://localhost:3000/system/permission/check \
  -H "Authorization: Bearer <token>"

# 同步权限种子
curl -X POST http://localhost:3000/system/permission/sync \
  -H "Authorization: Bearer <token>"

# 清除权限缓存
curl -X POST http://localhost:3000/system/permission/cache/clear \
  -H "Authorization: Bearer <token>"
```

### 5. 超级管理员初始化

**位置**: `scripts/bootstrap-superadmin.ts`

```bash
npm run bootstrap:superadmin
```

创建系统的第一个超级管理员账号：
- 用户名: `admin`
- 密码: `Admin@123456`
- 角色: `superadmin`
- 数据范围: 全部数据

**特性**:
- 检查是否已存在超级管理员
- 自动创建 `superadmin` 角色
- 用户名冲突检测
- 密码使用 Argon2 加密

**⚠️ 重要**: 首次登录后请立即修改密码！

### 6. 数据库备份和恢复

#### 备份数据库

**位置**: `scripts/db-backup.sh`

```bash
# 默认备份
npm run db:backup

# 指定备份名称
bash scripts/db-backup.sh pre-migration
```

备份文件保存在 `backups/` 目录，格式：`{name}_{timestamp}.sql.gz`

**特性**:
- 自动压缩（gzip）
- 自动清理（保留最近 10 个备份）
- 从 `.env` 读取数据库连接

#### 恢复数据库

**位置**: `scripts/db-restore.sh`

```bash
npm run db:restore backups/pre-migration_20250124_120000.sql.gz
```

**特性**:
- 恢复前自动创建当前数据库备份
- 需要确认操作（输入 'yes'）
- 自动解压缩

**⚠️ 警告**: 恢复操作会替换所有数据库内容！

## 架构设计

### 保留角色常量

**位置**: `libs/permission/src/constants/reserved-roles.ts`

```typescript
export const RESERVED_ROLES = {
  SUPER_ADMIN: 'superadmin',
} as const;

export function isSuperAdmin(roleKeys: readonly string[]): boolean {
  return roleKeys.includes(RESERVED_ROLES.SUPER_ADMIN);
}
```

超级管理员特权：
1. PermissionGuard 检测到该角色时，直接放行
2. DataScopeService 检测到该角色时，返回全部数据
3. 不能删除该角色
4. 必须保留至少一个拥有该角色的启用用户

### 权限种子类型

**位置**: `libs/permission/src/types/permission-seed.type.ts`

- `PermissionSeedDefinition` - 权限种子定义
- `PermissionSyncResult` - 同步结果
- `PermissionCheckResult` - 诊断结果

### 同步策略

1. **创建**: 种子中存在但数据库中不存在
2. **更新**: 种子和数据库都存在，但信息不一致
3. **跳过**: 种子和数据库都存在，且信息一致
4. **孤儿**: 数据库中存在但种子中不存在（仅标记，不自动删除）

### 缓存管理

权限缓存基于用户权限版本号：
- 缓存键格式: `user:perms:{userId}:{version}`
- TTL: 1 小时
- 角色权限变更时，递增相关用户的版本号
- 提供手动清除所有缓存的 API

## 使用流程

### 新增权限流程

1. 在 `permissions.seed.ts` 中添加权限定义
2. 在 Controller 中使用 `@Permission()` 装饰器
3. 运行 `npm run permission:sync` 同步到数据库
4. 在角色管理中分配权限给角色

### 定期维护流程

1. 运行 `npm run permission:check` 检查健康状态
2. 查看未使用的权限（孤儿权限）
3. 确认后运行 `npm run permission:cleanup` 清理
4. 如有无效绑定，运行 `npm run permission:fix` 修复

### 数据库维护流程

1. **变更前**: 运行 `bash scripts/db-backup.sh pre-change` 备份
2. **执行变更**: 进行数据库迁移或修改
3. **验证**: 检查数据是否正确
4. **回滚（如需要）**: 运行 `bash scripts/db-restore.sh backups/pre-change_*.sql.gz`

## 配置

### 环境变量

备份/恢复脚本从 `.env` 读取数据库连接：

```env
DATABASE_URL=postgresql://user:password@host:port/database
```

### 权限种子配置

在 `permissions.seed.ts` 中修改权限定义。权限编码必须唯一。

### 超级管理员配置

在 `scripts/bootstrap-superadmin.ts` 中修改默认配置：

```typescript
const DEFAULT_SUPERADMIN = {
  username: 'admin',
  password: 'Admin@123456',
  realName: '超级管理员',
  email: 'admin@example.com',
};
```

## 测试

### 手动测试清单

- [ ] 运行 `npm run permission:sync` 成功同步权限
- [ ] 运行 `npm run permission:check` 查看诊断结果
- [ ] 调用 API `/system/permission/check` 返回正确结果
- [ ] 调用 API `/system/permission/sync` 成功同步
- [ ] 调用 API `/system/permission/cache/clear` 清除缓存
- [ ] 运行 `npm run bootstrap:superadmin` 创建管理员
- [ ] 使用超级管理员账号登录成功
- [ ] 超级管理员可以访问所有受保护的端点
- [ ] 数据库备份成功创建 `.sql.gz` 文件
- [ ] 数据库恢复成功还原数据

## 验收标准

✅ **权限种子**:
- 所有系统权限在代码中定义
- 权限编码遵循命名规范
- 包含完整的权限说明

✅ **同步功能**:
- 可以同步权限到数据库
- 可以检测孤儿权限
- 可以检测重复编码
- 可以检测无效绑定

✅ **CLI 命令**:
- 所有命令可以正常执行
- 命令输出清晰易懂
- 错误处理完善

✅ **管理 API**:
- 所有 API 端点可访问
- 需要相应权限才能调用
- 返回结果格式正确

✅ **超级管理员**:
- 可以创建第一个管理员
- 管理员拥有所有权限
- 不能重复创建

✅ **备份恢复**:
- 备份文件正确压缩
- 自动清理旧备份
- 恢复前自动备份
- 恢复操作需要确认

## 下一步

批次 8：审计和监控
- 实现操作日志
- 实现权限变更审计
- 实现登录日志
- 配置日志脱敏

## 相关文档

- [RBAC 权限架构实施设计](../rbac/b-rbac-implementation.md)
- [批次 5：系统管理模块](../memory/batch-5-system-management-completed.md)
- [权限模型建议](../memory/nest-rbac-strategy.md)
