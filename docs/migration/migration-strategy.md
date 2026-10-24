# 批次1：数据库迁移策略

**状态**: 进行中  
**批次**: 1（数据库迁移）  
**预计时间**: 2-3天

---

## 一、迁移目标

将现有的基于 `Menu.perms` 的权限体系迁移到独立的 `Permission` 表，实现：

1. 权限编码独立存储和管理
2. 角色通过 `RolePermission` 关联权限
3. 用户权限缓存版本机制
4. 数据范围枚举值重新映射

---

## 二、Schema 变更清单

### 2.1 新增模型

#### Permission（权限表）

```prisma
model Permission {
  permissionId BigInt   @id @default(autoincrement())
  code         String   @unique @db.VarChar(128)
  name         String   @db.VarChar(100)
  resource     String?  @db.VarChar(100)
  action       String?  @db.VarChar(64)
  menuId       BigInt?  @unique
  status       String   @default("0") @db.Char(1)
  remark       String?  @db.VarChar(500)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

**字段说明**:
- `code`: 全局唯一权限编码（如：system:user:view）
- `menuId`: 可选，与 C/F 类型菜单一对一绑定
- `resource/action`: 可选，用于权限管理界面分组

#### RolePermission（角色-权限关联表）

```prisma
model RolePermission {
  roleId       BigInt
  permissionId BigInt
  
  @@id([roleId, permissionId])
  @@index([permissionId])
}
```

### 2.2 修改现有模型

#### User 表
- **新增字段**: `permissionVersion Int @default(0)`
- **用途**: 权限缓存失效控制

#### Role 表
- **修改字段**: `dataScope` 注释更新
- **旧值映射**:
  ```
  旧值 1 → 新值 1 (ALL - 全部数据)
  旧值 2 → 新值 5 (CUSTOM - 自定义部门)
  旧值 3 → 新值 2 (DEPT - 本部门)
  旧值 4 → 新值 3 (DEPT_AND_CHILD - 本部门及以下)
  旧值 5 → 新值 4 (SELF - 仅本人)
  旧值 6 → ⚠️ 需人工决策（无直接对应）
  ```

#### Menu 表
- **新增关系**: `permission Permission?` 反向关联

---

## 三、迁移前数据盘点

### 3.1 需要执行的检查查询

```sql
-- 1. 统计所有菜单的 perms 分布
SELECT 
  menu_type,
  COUNT(*) as total,
  COUNT(perms) as has_perms,
  COUNT(*) - COUNT(perms) as no_perms
FROM sys_menu
GROUP BY menu_type;

-- 2. 检查重复的权限编码
SELECT 
  perms,
  COUNT(*) as count,
  STRING_AGG(menu_id::text, ', ') as menu_ids
FROM sys_menu
WHERE perms IS NOT NULL AND perms != ''
GROUP BY perms
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- 3. 检查权限编码格式
SELECT 
  menu_id,
  menu_name,
  perms
FROM sys_menu
WHERE perms IS NOT NULL 
  AND perms != ''
  AND perms !~ '^[a-z]+:[a-z]+:[a-z]+$';

-- 4. 统计角色的 dataScope 值分布
SELECT 
  data_scope,
  COUNT(*) as count,
  STRING_AGG(role_name, ', ') as roles
FROM sys_role
WHERE del_flag = '0'
GROUP BY data_scope
ORDER BY data_scope;

-- 5. 检查孤儿关联
-- 5.1 RoleMenu 中引用不存在的菜单
SELECT rm.role_id, rm.menu_id
FROM sys_role_menu rm
LEFT JOIN sys_menu m ON rm.menu_id = m.menu_id
WHERE m.menu_id IS NULL;

-- 5.2 RoleMenu 中引用不存在的角色
SELECT rm.role_id, rm.menu_id
FROM sys_role_menu rm
LEFT JOIN sys_role r ON rm.role_id = r.role_id
WHERE r.role_id IS NULL;

-- 6. 统计用户权限分布
SELECT 
  COUNT(DISTINCT u.user_id) as total_users,
  COUNT(DISTINCT CASE WHEN ur.role_id IS NOT NULL THEN u.user_id END) as users_with_roles,
  COUNT(DISTINCT ur.role_id) as total_role_assignments
FROM sys_user u
LEFT JOIN sys_user_role ur ON u.user_id = ur.user_id
WHERE u.del_flag = '0' AND u.status = '0';
```

### 3.2 盘点报告模板

创建文件: `docs/migration/data-audit-report.md`

```markdown
# 数据迁移盘点报告

## 执行时间
[执行日期时间]

## 1. 菜单权限统计
| 菜单类型 | 总数 | 有权限编码 | 无权限编码 |
|---------|------|----------|----------|
| M (目录) | X    | X        | X        |
| C (菜单) | X    | X        | X        |
| F (按钮) | X    | X        | X        |

## 2. 重复权限编码
| 权限编码 | 出现次数 | 关联菜单ID |
|---------|---------|-----------|
| ...     | ...     | ...       |

**处理方案**: [描述如何处理重复编码]

## 3. 非法权限编码格式
| 菜单ID | 菜单名称 | 权限编码 | 问题 |
|-------|---------|---------|------|
| ...   | ...     | ...     | ...  |

## 4. 角色数据范围分布
| dataScope 值 | 数量 | 角色列表 |
|-------------|------|---------|
| 1           | X    | ...     |
| 2           | X    | ...     |
| ...         | ...  | ...     |

**迁移映射**:
- [列出具体的映射决策]

## 5. 孤儿关联
- RoleMenu 孤儿: X 条
- 其他孤儿: X 条

**清理方案**: [描述清理策略]

## 6. 风险评估
- [ ] 是否存在需要人工决策的数据
- [ ] 是否存在不可自动迁移的情况
- [ ] 备份策略是否就绪

## 7. 下一步行动
1. [行动项1]
2. [行动项2]
```

---

## 四、迁移脚本设计

### 4.1 迁移步骤

```typescript
// prisma/migrations/scripts/migrate-permissions.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migratePermissions() {
  console.log('开始迁移权限数据...');

  await prisma.$transaction(async (tx) => {
    // 1. 从 Menu.perms 生成 Permission 记录
    console.log('步骤 1: 创建权限记录...');
    const menusWithPerms = await tx.menu.findMany({
      where: {
        perms: { not: null },
        menuType: { in: ['C', 'F'] },
      },
      select: {
        menuId: true,
        menuName: true,
        perms: true,
        status: true,
      },
    });

    // 按 perms 去重（处理重复编码）
    const uniquePerms = new Map<string, typeof menusWithPerms[0]>();
    for (const menu of menusWithPerms) {
      const perms = menu.perms!.trim();
      if (!uniquePerms.has(perms)) {
        uniquePerms.set(perms, menu);
      } else {
        console.warn(`重复权限编码: ${perms}, 菜单: ${menu.menuId}`);
      }
    }

    // 批量创建权限
    const permissions = Array.from(uniquePerms.values()).map((menu) => {
      const perms = menu.perms!.trim();
      const parts = perms.split(':');
      return {
        code: perms,
        name: menu.menuName,
        resource: parts[1] || null,
        action: parts[2] || null,
        menuId: menu.menuId,
        status: menu.status,
      };
    });

    await tx.permission.createMany({
      data: permissions,
      skipDuplicates: true,
    });

    console.log(`创建了 ${permissions.length} 条权限记录`);

    // 2. 根据 RoleMenu 反推 RolePermission
    console.log('步骤 2: 创建角色权限关联...');
    const roleMenus = await tx.roleMenu.findMany({
      include: {
        menu: {
          include: {
            permission: {
              select: { permissionId: true },
            },
          },
        },
      },
    });

    const rolePermissions = roleMenus
      .filter((rm) => rm.menu.permission)
      .map((rm) => ({
        roleId: rm.roleId,
        permissionId: rm.menu.permission!.permissionId,
      }));

    // 去重
    const uniqueRolePerms = Array.from(
      new Set(rolePermissions.map((rp) => `${rp.roleId}-${rp.permissionId}`))
    ).map((key) => {
      const [roleId, permissionId] = key.split('-').map(BigInt);
      return { roleId, permissionId };
    });

    await tx.rolePermission.createMany({
      data: uniqueRolePerms,
      skipDuplicates: true,
    });

    console.log(`创建了 ${uniqueRolePerms.length} 条角色权限关联`);

    // 3. 迁移 dataScope 值（如果需要）
    console.log('步骤 3: 迁移数据范围值...');
    const dataScopeMapping: Record<string, string> = {
      '1': '1', // ALL -> ALL
      '2': '5', // 自定义 -> CUSTOM
      '3': '2', // 本部门 -> DEPT
      '4': '3', // 本部门及以下 -> DEPT_AND_CHILD
      '5': '4', // 本人 -> SELF
      // '6': '?', // 需人工决策
    };

    for (const [oldValue, newValue] of Object.entries(dataScopeMapping)) {
      await tx.role.updateMany({
        where: { dataScope: oldValue },
        data: { dataScope: newValue },
      });
    }

    console.log('数据范围值迁移完成');
  });

  console.log('权限数据迁移完成！');
}

// 执行迁移
migratePermissions()
  .catch((error) => {
    console.error('迁移失败:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

### 4.2 回滚脚本

```typescript
// prisma/migrations/scripts/rollback-permissions.ts

async function rollbackPermissions() {
  console.log('开始回滚权限迁移...');

  await prisma.$transaction(async (tx) => {
    // 1. 删除所有 RolePermission 记录
    const deletedRolePerms = await tx.rolePermission.deleteMany();
    console.log(`删除了 ${deletedRolePerms.count} 条角色权限关联`);

    // 2. 删除所有 Permission 记录
    const deletedPerms = await tx.permission.deleteMany();
    console.log(`删除了 ${deletedPerms.count} 条权限记录`);

    // 3. 回滚 dataScope 值
    const reverseMapping: Record<string, string> = {
      '1': '1',
      '5': '2',
      '2': '3',
      '3': '4',
      '4': '5',
    };

    for (const [newValue, oldValue] of Object.entries(reverseMapping)) {
      await tx.role.updateMany({
        where: { dataScope: newValue },
        data: { dataScope: oldValue },
      });
    }

    // 4. 重置用户权限版本号
    await tx.user.updateMany({
      data: { permissionVersion: 0 },
    });
  });

  console.log('权限迁移已回滚！');
}
```

---

## 五、执行计划

### Phase 1: 准备阶段（0.5天）

1. ✅ 更新 Prisma schema
2. ⏳ 执行数据盘点查询
3. ⏳ 填写盘点报告
4. ⏳ 与业务方确认 dataScope 映射
5. ⏳ 与业务方确认重复权限编码处理方案

### Phase 2: 迁移脚本开发（1天）

1. ⏳ 编写迁移脚本
2. ⏳ 编写回滚脚本
3. ⏳ 本地测试环境验证
4. ⏳ 编写验证查询

### Phase 3: 测试环境执行（0.5天）

1. ⏳ 备份测试环境数据库
2. ⏳ 执行 Prisma migration
3. ⏳ 执行数据迁移脚本
4. ⏳ 验证数据完整性
5. ⏳ 执行回滚测试

### Phase 4: 生产环境准备（0.5-1天）

1. ⏳ 编写生产迁移检查清单
2. ⏳ 准备维护公告
3. ⏳ 确定迁移时间窗口
4. ⏳ 准备应急预案

---

## 六、验证清单

### 6.1 数据完整性验证

```sql
-- 验证1: 权限记录数量
SELECT COUNT(*) FROM sys_permission;

-- 验证2: 每个有 perms 的 C/F 菜单都有对应的权限
SELECT m.menu_id, m.menu_name, m.perms
FROM sys_menu m
LEFT JOIN sys_permission p ON m.menu_id = p.menu_id
WHERE m.perms IS NOT NULL 
  AND m.perms != ''
  AND m.menu_type IN ('C', 'F')
  AND p.permission_id IS NULL;

-- 验证3: RolePermission 数量合理
SELECT COUNT(*) FROM sys_role_permission;

-- 验证4: 每个角色的权限数量
SELECT 
  r.role_id,
  r.role_name,
  COUNT(rp.permission_id) as permission_count
FROM sys_role r
LEFT JOIN sys_role_permission rp ON r.role_id = rp.role_id
WHERE r.del_flag = '0' AND r.status = '0'
GROUP BY r.role_id, r.role_name
ORDER BY permission_count DESC;

-- 验证5: dataScope 值迁移
SELECT data_scope, COUNT(*) 
FROM sys_role 
GROUP BY data_scope;
```

### 6.2 功能验证

- [ ] 用户登录后权限查询正常
- [ ] 角色授权菜单后权限同步正常
- [ ] 菜单保存时权限同步正常
- [ ] 权限缓存版本号递增正常

---

## 七、风险与应对

| 风险 | 影响 | 概率 | 应对措施 |
|------|------|------|---------|
| 权限编码重复 | 中 | 中 | 人工决策保留哪个菜单的权限 |
| dataScope 值 6 无映射 | 高 | 低 | 与业务方确认后人工修正 |
| 迁移时间过长 | 中 | 低 | 分批迁移或在低峰期执行 |
| 回滚失败 | 高 | 极低 | 保留完整备份 |

---

## 八、后续任务（批次2）

迁移完成后进入**批次2：认证模块**：
- 实现 TokenService（JWT 签发/验证）
- 实现 AuthService（登录/登出）
- 实现 AuthGuard
- 实现 @Public() 装饰器

---

**文档版本**: v1.0  
**创建时间**: 2025-01-17  
**更新时间**: 2025-01-17
