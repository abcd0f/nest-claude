# 批次 7 快速参考

## 命令速查

### 权限管理命令

```bash
# 同步权限种子到数据库
npm run permission:sync

# 检查权限健康状态
npm run permission:check

# 清理孤儿权限
npm run permission:cleanup

# 修复无效的菜单绑定
npm run permission:fix
```

### 超级管理员

```bash
# 创建超级管理员
npm run bootstrap:superadmin

# 默认凭据
# 用户名: admin
# 密码: Admin@123456
```

### 数据库备份恢复

```bash
# 备份数据库
npm run db:backup
bash scripts/db-backup.sh pre-migration

# 恢复数据库
npm run db:restore backups/backup_20250124_120000.sql.gz
```

## API 端点速查

### 权限管理 API

```bash
# 基础 URL
BASE_URL=http://localhost:3000

# 权限诊断检查
GET /system/permission/check
权限: system:permission:check

# 同步权限种子
POST /system/permission/sync
权限: system:permission:sync

# 清理孤儿权限
DELETE /system/permission/orphans
权限: system:permission:cleanup

# 修复无效绑定
POST /system/permission/fix-bindings
权限: system:permission:fix

# 清除权限缓存
POST /system/permission/cache/clear
权限: system:permission:cache

# 获取权限种子定义
GET /system/permission/seeds
权限: system:permission:view
```

### 使用 curl 示例

```bash
# 设置 token
TOKEN="your_jwt_token"

# 检查权限
curl -X GET "$BASE_URL/system/permission/check" \
  -H "Authorization: Bearer $TOKEN"

# 同步权限
curl -X POST "$BASE_URL/system/permission/sync" \
  -H "Authorization: Bearer $TOKEN"

# 清除缓存
curl -X POST "$BASE_URL/system/permission/cache/clear" \
  -H "Authorization: Bearer $TOKEN"
```

## 权限编码规范

### 命名格式

```
<module>:<resource>:<action>

module:   系统模块（system, business, report）
resource: 资源名称（user, role, dept, menu, post, permission）
action:   操作动作（view, add, edit, remove, resetPwd, assign, scope, export, import, check, sync, cleanup, fix, cache）
```

### 示例

```typescript
// 用户管理
'system:user:view'      // 查看用户
'system:user:add'       // 新增用户
'system:user:edit'      // 编辑用户
'system:user:remove'    // 删除用户
'system:user:resetPwd'  // 重置密码
'system:user:assign'    // 分配角色/职位

// 角色管理
'system:role:view'      // 查看角色
'system:role:add'       // 新增角色
'system:role:edit'      // 编辑角色
'system:role:remove'    // 删除角色
'system:role:assign'    // 菜单授权
'system:role:scope'     // 数据范围设置

// 权限管理
'system:permission:view'    // 查看权限
'system:permission:check'   // 权限诊断
'system:permission:sync'    // 权限同步
'system:permission:cleanup' // 权限清理
'system:permission:fix'     // 权限修复
'system:permission:cache'   // 缓存管理
```

## 文件位置速查

### 核心文件

```
libs/permission/src/
  ├── constants/
  │   └── reserved-roles.ts              # 保留角色常量
  ├── seeds/
  │   └── permissions.seed.ts            # 权限种子定义（35个权限）
  ├── services/
  │   ├── permission-sync.service.ts     # 权限同步服务
  │   ├── data-scope.service.ts          # 数据范围服务
  │   └── permission.service.ts          # 权限服务
  └── types/
      └── permission-seed.type.ts        # 权限种子类型定义

apps/gateway/src/modules/system/permission/
  ├── permission-management.controller.ts  # 权限管理控制器
  └── permission-management.module.ts      # 权限管理模块

scripts/
  ├── permission-sync.ts                 # 权限同步CLI
  ├── bootstrap-superadmin.ts            # 超级管理员初始化
  ├── db-backup.sh                       # 数据库备份脚本
  └── db-restore.sh                      # 数据库恢复脚本

docs/
  ├── batch-7-readme.md                  # 批次7完整文档
  └── batch-7-quick-reference.md         # 快速参考（本文件）
```

## 常见问题

### Q: 如何添加新权限？

1. 在 `libs/permission/src/seeds/permissions.seed.ts` 中添加权限定义
2. 运行 `npm run permission:sync` 同步到数据库
3. 在角色管理中分配权限给角色
4. 在 Controller 中使用 `@Permission('your:permission:code')`

### Q: 如何查看哪些权限未被使用？

```bash
npm run permission:check
```

查看输出中的 "Orphan Permissions" 部分。

### Q: 权限缓存何时失效？

- 自动失效：用户角色变更、角色权限变更时自动递增版本号
- 手动失效：调用 `POST /system/permission/cache/clear` API

### Q: 超级管理员初始化失败？

检查：
1. 数据库连接是否正常
2. 用户名 "admin" 是否已被占用
3. 是否已存在活跃的超级管理员

### Q: 数据库备份文件在哪里？

```
项目根目录/backups/
格式: {name}_{timestamp}.sql.gz
```

### Q: 如何回滚到之前的状态？

```bash
# 1. 查看可用备份
ls -lh backups/

# 2. 恢复指定备份
npm run db:restore backups/backup_YYYYMMDD_HHMMSS.sql.gz
```

## 工作流程

### 日常开发流程

```
1. 定义权限
   编辑 permissions.seed.ts

2. 同步权限
   npm run permission:sync

3. 使用权限
   @Permission('system:resource:action')

4. 测试权限
   使用具有该权限的角色测试
```

### 部署前检查

```bash
# 1. 检查权限健康
npm run permission:check

# 2. 备份数据库
bash scripts/db-backup.sh pre-deploy

# 3. 同步权限
npm run permission:sync

# 4. 验证权限
# 测试关键功能的权限控制
```

### 定期维护

```bash
# 每周/每月执行

# 1. 检查权限状态
npm run permission:check

# 2. 清理孤儿权限（如有必要）
npm run permission:cleanup

# 3. 修复无效绑定（如有）
npm run permission:fix

# 4. 清理旧备份
# 自动保留最近 10 个备份
```

## 环境变量

### .env 配置

```env
# 数据库连接（备份/恢复脚本需要）
DATABASE_URL=postgresql://user:password@host:port/database

# 示例
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nest_admin
```

## 权限种子统计

### 当前权限清单

- **总计**: 35 个权限
- **用户管理**: 8 个
- **角色管理**: 7 个
- **菜单管理**: 4 个
- **部门管理**: 5 个
- **职位管理**: 5 个
- **权限管理**: 6 个

### 标准操作动作

- `view` - 查看/查询
- `add` - 新增
- `edit` - 编辑
- `remove` - 删除
- `export` - 导出
- `import` - 导入
- `resetPwd` - 重置密码
- `assign` - 分配（角色、职位、权限）
- `scope` - 数据范围设置
- `check` - 诊断检查
- `sync` - 同步
- `cleanup` - 清理
- `fix` - 修复
- `cache` - 缓存管理

## 安全注意事项

### ⚠️ 危险操作

以下操作不可逆，执行前请确认：

1. **清理孤儿权限**
   ```bash
   npm run permission:cleanup
   ```
   - 会永久删除未使用的权限
   - 建议先运行 `permission:check` 查看

2. **恢复数据库**
   ```bash
   npm run db:restore <file>
   ```
   - 会替换所有数据库内容
   - 恢复前会自动创建当前数据库备份

### 🔒 安全建议

1. **超级管理员密码**
   - 首次登录后立即修改密码
   - 使用强密码（至少 12 位，包含大小写字母、数字、特殊字符）
   - 定期更换密码

2. **权限最小化**
   - 不要给普通用户分配超级管理员角色
   - 按需分配具体权限
   - 定期审查用户权限

3. **数据库备份**
   - 定期备份（每日/每周）
   - 在执行重要操作前备份
   - 测试恢复流程

4. **权限管理 API**
   - 仅授权给系统管理员
   - 记录所有权限变更操作
   - 监控异常权限操作

## 故障排查

### 权限同步失败

```bash
# 检查数据库连接
npm run db:studio

# 查看详细错误
npm run permission:sync

# 检查权限种子定义
# 确保没有重复的 code
```

### 超级管理员无法创建

```bash
# 检查是否已存在
npm run permission:check

# 查看用户名是否被占用
# 登录数据库查询 sys_user 表
```

### 备份脚本无法执行

```bash
# 检查脚本权限
chmod +x scripts/db-backup.sh scripts/db-restore.sh

# 检查 .env 文件
cat .env | grep DATABASE_URL

# 检查 pg_dump 是否安装
pg_dump --version
```

## 更新记录

- 2025-01-24: 批次 7 完成，实现权限种子和运维工具
