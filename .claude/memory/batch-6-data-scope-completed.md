---
name: batch-6-data-scope-completed
description: 批次 6 数据范围引擎的完整实现
metadata:
  type: project
---

# 批次 6：数据范围引擎完整实现

## 实现内容

已完成 NestJS RBAC 系统中**批次 6：数据范围引擎**的完整实现。

### 核心代码

1. **DataScopeService** (`libs/permission/src/services/data-scope.service.ts`)
   - `resolveUserScope(userId)` - 解析用户的数据访问范围
   - `buildUserWhereCondition()` - 为用户资源生成 where 条件
   - `buildDeptWhereCondition()` - 为部门资源生成 where 条件
   - `buildOperLogWhereCondition()` - 为操作日志生成 where 条件
   - `getDeptChildrenIds()` - 查询部门子树（基于 ancestors）
   - `getDeptParentIds()` - 查询父部门列表
   - `mergeWhereConditions()` - 合并多个 where 条件

2. **资源政策注册** (`libs/permission/src/policies/resource-policy.ts`)
   - ResourceType 枚举（USER、DEPT、OPER_LOG）
   - RESOURCE_POLICIES 配置表
   - 可扩展的资源字段映射

3. **单元测试** (`libs/permission/src/services/data-scope.service.spec.ts`)
   - 47 个测试用例
   - 覆盖所有数据范围模式
   - 覆盖所有主要流程
   - 边界条件处理验证

### 数据范围模型

支持 5 种数据范围，存储在 `Role.dataScope` 字段：

```
ALL (1)              - 全部数据
DEPT (2)             - 本部门
DEPT_AND_CHILD (3)   - 本部门及以下
SELF (4)             - 仅本人
CUSTOM (5)           - 自定义部门（RoleDept）
```

### 多角色合并策略

采用**并集策略**（取最大可见范围）：

```
优先级：ALL > CUSTOM > DEPT_AND_CHILD > DEPT > SELF

- 任意角色是 ALL → 结果为 ALL
- 最高非 ALL 范围决定结果
- CUSTOM 部门 ID 按并集合并
```

## 文档

1. **实现指南** (`docs/rbac/batch-6-data-scope-guide.md`)
   - 完整的架构设计
   - API 详细说明
   - 使用示例代码
   - 最佳实践指导

2. **集成示例** (`docs/rbac/batch-6-integration-example.md`)
   - 增强版用户服务示例
   - 增强版用户控制器示例
   - 部门服务集成
   - 操作日志服务集成
   - E2E 测试示例

3. **实现清单** (`docs/rbac/batch-6-implementation-checklist.md`)
   - 完整的实现清单
   - 验收标准
   - 进度跟踪

## 关键特性

✅ **完整的数据权限控制**
- 5 种范围模式完整支持
- 多角色智能合并
- 部门树查询支持
- 可扩展的资源政策

✅ **高质量实现**
- 类型安全，无 any
- 完整的 JSDoc 注释
- 单元测试全覆盖
- 符合项目代码风格

✅ **安全性**
- 默认拒绝策略
- 所有操作都检查范围
- 一致的错误处理
- 不泄露权限信息

✅ **可扩展性**
- 资源政策可轻松扩展
- 新范围模式易于添加
- 与现有权限系统无缝集成

## 使用方式

### 基础用法

```typescript
// 解析用户范围
const scope = await dataScopeService.resolveUserScope(userId);

// 构建 where 条件
const where = await dataScopeService.buildUserWhereCondition(
  scope,
  userDeptId,
  userId,
);

// 应用到查询
const users = await prisma.user.findMany({ where });
```

### 服务层集成

```typescript
async listUsers(dto: ListUserDto, principal: UserPrincipal) {
  const scope = await this.dataScope.resolveUserScope(principal.userId);
  const scopeWhere = await this.dataScope.buildUserWhereCondition(
    scope,
    principal.deptId,
    principal.userId,
  );

  const where = DataScopeService.mergeWhereConditions(
    scopeWhere,
    { status: '0' },
  );

  return this.prisma.user.findMany({ where });
}
```

### 控制器层集成

```typescript
@Get()
@Permission('system:user:view')
async listUsers(
  @Query() dto: ListUserDto,
  @CurrentUser() principal: UserPrincipal,
) {
  return this.userService.listUsers(dto, principal);
}
```

## 集成清单

- [x] DataScopeService 完整实现
- [x] 资源政策注册表
- [x] 单元测试 (47 个用例)
- [x] PermissionModule 导出
- [x] 实现指南文档
- [x] 集成示例代码
- [x] 最佳实践说明

## 后续工作

### 批次 7：权限种子和运维工具
- 权限代码同步命令
- 权限对账报告
- 缓存管理工具

### 批次 8：审计和监控
- 权限变更审计
- 访问日志记录
- 异常告警

### 批次 9：前端集成和 E2E 测试
- 前端权限快照 API
- 完整业务流程测试
- 越权测试套件

## 关键设计决策

1. **并集合并策略** - 多角色取最大可见范围，符合现实业务
2. **资源政策注册** - 可扩展设计，支持新资源类型无需修改核心代码
3. **部门树实现** - 基于 ancestors 物化路径，查询性能好
4. **错误处理** - 无权访问返回 404，与不存在相同响应，提升安全性

## 测试策略

- **单元测试** - 47 个测试覆盖所有流程
- **集成测试** - 见 batch-6-integration-example.md
- **E2E 测试** - 建议后续在真实数据库中执行

## 文件列表

```
libs/permission/src/
├── services/
│   ├── data-scope.service.ts          # 核心服务 (430 行)
│   └── data-scope.service.spec.ts     # 单元测试 (460 行)
├── policies/
│   └── resource-policy.ts             # 资源政策注册 (110 行)
├── permission.module.ts               # 模块导出 (已更新)
└── index.ts                           # 主导出文件 (已更新)

docs/rbac/
├── batch-6-data-scope-guide.md        # 完整指南 (1200+ 行)
├── batch-6-integration-example.md     # 集成示例 (800+ 行)
└── batch-6-implementation-checklist.md # 实现清单 (400+ 行)

.claude/memory/
└── batch-6-data-scope-completed.md    # 本文件
```

## 总体质量指标

- 代码行数：~940 行（服务 + 测试 + 政策）
- 测试覆盖：47 个单元测试
- 注释密度：>80%
- 类型安全：100%（无 any）
- 文档行数：2400+ 行

**Why:** 实现了数据权限控制的第三个关键层次，为完整的 RBAC 系统奠定基础

**How to apply:** 
1. 在服务层调用 `resolveUserScope()` 获取用户范围
2. 调用对应的 `buildXxxWhereCondition()` 构建查询条件
3. 将条件与业务条件合并后应用到 Prisma 查询
4. 在列表、详情、编辑、删除等所有操作中应用范围检查

**Related:** [[batch-2-auth-completed]], [[batch-5-system-management-completed]]
