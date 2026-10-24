# 批次 6 快速参考卡

## 快速开始（3 步）

### 步骤 1：解析用户范围
```typescript
const scope = await dataScopeService.resolveUserScope(principal.userId);
// 返回：{ kind: DataScope.DEPT, deptIds: [] }
```

### 步骤 2：构建查询条件
```typescript
const where = await dataScopeService.buildUserWhereCondition(
  scope,
  principal.deptId,
  principal.userId,
);
// 返回：{ deptId: principal.deptId }
```

### 步骤 3：应用到查询
```typescript
const users = await prisma.user.findMany({ where });
```

## 五种范围速查表

| 范围 | 值 | 条件示例 | 说明 |
|------|-----|---------|------|
| ALL | '1' | `{}` | 全部数据，无限制 |
| DEPT | '2' | `{ deptId: userDeptId }` | 本部门用户 |
| DEPT_AND_CHILD | '3' | `{ deptId: { in: childIds } }` | 本部门及子部门用户 |
| SELF | '4' | `{ userId }` | 仅当前用户 |
| CUSTOM | '5' | `{ deptId: { in: customIds } }` | 指定部门用户 |

## 常用模式

### 模式 1：列表查询
```typescript
async listUsers(query, principal) {
  const scope = await this.dataScope.resolveUserScope(principal.userId);
  const scopeWhere = await this.dataScope.buildUserWhereCondition(
    scope, principal.deptId, principal.userId
  );
  
  const where = DataScopeService.mergeWhereConditions(
    scopeWhere,
    { status: '0' }
  );
  
  return this.prisma.user.findMany({ where });
}
```

### 模式 2：详情查询
```typescript
async getById(id, principal) {
  const scope = await this.dataScope.resolveUserScope(principal.userId);
  const where = await this.dataScope.buildUserWhereCondition(
    scope, principal.deptId, principal.userId
  );
  
  const item = await this.prisma.user.findFirst({
    where: { id, ...where }
  });
  
  return item || throw new NotFoundException();
}
```

### 模式 3：编辑/删除
```typescript
async deleteUsers(ids, principal) {
  const scope = await this.dataScope.resolveUserScope(principal.userId);
  const where = await this.dataScope.buildUserWhereCondition(
    scope, principal.deptId, principal.userId
  );
  
  const result = await this.prisma.user.deleteMany({
    where: { id: { in: ids }, ...where }
  });
  
  return result.count; // 返回实际删除数
}
```

### 模式 4：不同资源
```typescript
// 用户资源
const userWhere = await this.dataScope.buildUserWhereCondition(...);

// 部门资源
const deptWhere = await this.dataScope.buildDeptWhereCondition(...);

// 操作日志
const logWhere = await this.dataScope.buildOperLogWhereCondition(...);
```

## 常用方法速查

```typescript
// 解析范围
resolveUserScope(userId)
  → Promise<ResolvedDataScope>

// 构建条件
buildUserWhereCondition(scope, userDeptId, userId)
  → Promise<Prisma.WhereInput>

buildDeptWhereCondition(scope, userDeptId, userId)
  → Promise<Prisma.WhereInput>

buildOperLogWhereCondition(scope, userDeptId, userId)
  → Promise<Prisma.WhereInput>

// 部门树
getDeptChildrenIds(deptId)
  → Promise<bigint[]>

getDeptParentIds(deptId)
  → Promise<bigint[]>

// 工具
mergeWhereConditions(...conditions)
  → Prisma.WhereInput
```

## 条件合并

```typescript
// 方式 1：对象展开
const where = {
  ...scopeWhere,
  status: '0',
  delFlag: '0'
};

// 方式 2：mergeWhereConditions
const where = DataScopeService.mergeWhereConditions(
  scopeWhere,
  { status: '0' },
  { delFlag: '0' }
);
```

## 扩展新资源

### 1. 添加资源类型
```typescript
export enum ResourceType {
  PROJECT = 'project'
}
```

### 2. 配置资源政策
```typescript
[ResourceType.PROJECT]: {
  deptField: 'deptId',
  ownerField: 'creatorId'
}
```

### 3. 实现条件构建方法
```typescript
async buildProjectWhereCondition(scope, userDeptId, userId) {
  // 实现逻辑
}
```

## 错误处理

```typescript
// ✅ 正确：返回 404 隐藏权限信息
throw new NotFoundException('资源不存在或无权访问');

// ❌ 错误：泄露权限信息
throw new ForbiddenException('无权访问该资源');
```

## 性能要点

```typescript
// ✅ 查询和计数使用相同 where
const [items, total] = await Promise.all([
  prisma.user.findMany({ where, skip, take }),
  prisma.user.count({ where })  // 相同的 where
]);

// ✅ 部门子树查询时 ancestors 必须有索引
@@index([ancestors])

// ✅ 批量操作不使用循环
const result = await prisma.user.deleteMany({
  where: { id: { in: ids }, ...scopeWhere }
});

// ❌ 避免 N+1 查询
for (const id of ids) {
  await prisma.user.delete({ where: { id } });
}
```

## 缓存键规则

```typescript
// 权限缓存
`user:perms:${userId}:${permissionVersion}`

// 范围缓存
`user:scope:${userId}:${permissionVersion}`
```

## 权限变更失效

```typescript
// 角色权限变更时
await permissionService.invalidateRolePermissions(roleId);

// 用户角色变更时
await permissionService.invalidateUserPermissions([userId]);

// 会自动：
// 1. 递增 User.permissionVersion
// 2. 清除内存缓存
// 3. 记录审计日志
```

## 文档链接

- [完整指南](./batch-6-data-scope-guide.md)
- [集成示例](./batch-6-integration-example.md)
- [实现清单](./batch-6-implementation-checklist.md)
- [系统状态](./RBAC-IMPLEMENTATION-STATUS.md)

## 常见问题

**Q: 用户没有有效角色怎么办？**
A: 返回 SELF 范围（最严格），用户只能访问自己的数据。

**Q: 多角色范围怎么合并？**
A: 并集策略，取最大可见范围。例如 DEPT 和 DEPT_AND_CHILD → DEPT_AND_CHILD。

**Q: 如何应用到编辑/删除？**
A: 在 updateMany/deleteMany 中应用 where 条件，确保只操作有权访问的记录。

**Q: 部门删除时怎么处理？**
A: 外键约束防止删除被引用的部门。优先逻辑删除（delFlag='1'）。

**Q: 能否只在列表查询应用范围？**
A: 不能！必须在所有操作类型（列表、详情、编辑、删除）都应用，否则会有安全漏洞。

## 关键数据库模型

```prisma
model User {
  userId BigInt @id
  deptId BigInt?
  permissionVersion Int  // 权限版本号
}

model Role {
  roleId BigInt @id
  dataScope String  // '1','2','3','4','5'
}

model Dept {
  deptId BigInt @id
  ancestors String  // 物化路径如 /1/2/3
  @@index([ancestors])
}

model UserRole {
  userId BigInt
  roleId BigInt
  @@id([userId, roleId])
}

model RoleDept {
  roleId BigInt
  deptId BigInt
  @@id([roleId, deptId])
}
```

## 核心代码位置

```
libs/permission/src/
├── services/data-scope.service.ts (核心服务)
├── services/data-scope.service.spec.ts (单元测试)
└── policies/resource-policy.ts (资源配置)
```

---

**提示**：本卡片涵盖了 80% 的常见使用场景。更多细节请查阅完整指南。
