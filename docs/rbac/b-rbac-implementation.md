# RBAC 权限架构实施设计

## 目标与边界

本设计面向当前 NestJS 12、Fastify、Prisma 7、PostgreSQL 项目。实现基于角色的访问控制（RBAC），并提供独立的数据范围过滤。认证负责确认请求用户身份；功能权限负责判断用户能否执行某个操作；数据权限负责限制操作可访问的记录集合。三者必须分别执行，API 加密不承担其中任一职责。

权限检查默认拒绝：受保护路由必须有有效身份；声明权限的路由必须满足元数据策略；数据查询必须显式应用范围条件。没有权限元数据的路由仍需认证，但应在全局守卫中与明确公开路由区分，避免因漏标而变成匿名入口。

## 目标调用方式

```ts
import { Mode, Permission } from '@app/permission';

@Get()
@Permission('system:user:view')
findAll() {}

@Post()
@Permission({ value: ['system:user:add', 'system:user:edit'], mode: Mode.OR })
save() {}

@Get('sensitive')
@Permission({ value: 'system:sensitive:view', role: 'admin' })
viewSensitive() {}
```

建议声明类型如下。默认单个权限；数组默认 `AND`，`Mode.OR` 表示至少具备其中一项。对象中的 `role` 定义为兜底：用户具备该角色**或**满足 `value` 权限条件即可通过。角色兜底不能绕过认证、用户/角色禁用状态检查，不能扩大数据范围。若业务要“角色且权限”，应使用单独明确的 `roles` 与 `mode` 组合选项，避免复用 `role` 产生歧义。

```ts
export enum Mode {
  AND = 'AND',
  OR = 'OR',
}

export type PermissionValue = string | readonly string[];
export type PermissionOptions = {
  value: PermissionValue;
  mode?: Mode;
  role?: string;
};
export type PermissionMetadata = {
  value: readonly string[];
  mode: Mode;
  role?: string;
};
export function Permission(input: PermissionValue | PermissionOptions): MethodDecorator & ClassDecorator;
```

裝飾器應只寫 metadata（Nest `SetMetadata` / `Reflector`），不應在裝飾器執行時查資料庫。類與方法同時有 metadata 時，以方法設定覆蓋類設定（`getAllAndOverride`），并为方法级公开/匿名策略定义同样明确的覆盖规则。空数组、空字符串、未知 `Mode` 在应用启动/测试阶段视作配置错误。

## 功能模块

1. **认证（`libs/auth`）**：登录 DTO 校验、账号状态校验、密码哈希验证、访问令牌签发与验证、当前用户上下文、公开端点标记、登出/撤销与刷新策略、认证审计。推荐短期 access token；若采用 refresh token，存储其哈希并支持轮换与重放检测。选用并锁定 JWT 实现依赖（例如 `@nestjs/jwt`），不要自行实现密码学或 JWT。
2. **权限（`libs/permission`）**：`@Permission`、`Mode`、`PermissionGuard`、权限解析服务、权限缓存/版本失效、角色检查、拒绝审计。权限解析应基于有效用户及有效角色，关联权限集合去重。
3. **数据范围**：类型化范围策略、角色范围解析、多角色合并、Prisma where 条件生成器、业务查询接入、记录级授权和测试。
4. **系统管理 API**：用户、角色、权限点、菜单、角色部门授权与角色分配 CRUD；所有管理端点自身也由同一权限机制保护，并防止移除最后一个有效管理员。
5. **权限目录与前端投影**：服务端权限点是授权事实来源；菜单/路由可以关联权限点供前端构造导航，但前端隐藏按钮不构成安全控制。

## 推荐数据模型

保留 `User`、`Role`、`Dept`、`Post` 和显式关联表，增加独立 `Permission` 模型与 `RolePermission`。`Permission` 是 API/业务动作的稳定标识目录，不等同于菜单项。可把 `Menu.perms` 迁移为 `MenuPermission` 关联，或保留为只读/迁移兼容字段，但不要让授权守卫依赖自由文本菜单字段。

```prisma
model Permission {
  permissionId BigInt   @id @default(autoincrement()) @map("permission_id")
  code         String   @unique @db.VarChar(128) // system:user:view
  name         String   @db.VarChar(100)
  resource     String?  @db.VarChar(100)
  action       String?  @db.VarChar(64)
  status       String   @default("0") @db.Char(1)
  roles        RolePermission[]
  menus        MenuPermission[]
  @@map("sys_permission")
}

model RolePermission {
  roleId       BigInt @map("role_id")
  permissionId BigInt @map("permission_id")
  role         Role @relation(fields: [roleId], references: [roleId], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [permissionId], onDelete: Cascade)
  @@id([roleId, permissionId])
  @@index([permissionId])
  @@map("sys_role_permission")
}
```

具体字段以迁移策略为准。建议用数据库 enum 或 `CHECK` 约束状态/范围编码，并保持领域层枚举校验。`UserRole`、`RolePermission`、`RoleDept` 的复合主键和级联删除模式适用于当前单租户简单授权；如未来支持租户，需在所有唯一键、外键关系和查询条件中一致加入 `tenantId`，不能只加到主表。

`Role.roleKey` 必须唯一且不可由普通角色管理员随意改动；`Permission.code` 必须唯一、稳定且由代码/受控种子数据维护。权限删除前检查控制器代码引用和角色关联，优先停用而不是物理删除。状态值应有统一语义，例如 `0=启用、1=停用`，并在用户认证、角色解析和权限计算中一致过滤。

### 数据范围模型

范围值采用项目所需的精确定义，建议命名为 `DataScope`：

```ts
export enum DataScope {
  ALL = '1',             // 全部数据
  DEPT = '2',            // 本部门
  DEPT_AND_CHILD = '3',  // 本部门及以下
  SELF = '4',            // 仅本人
  CUSTOM = '5',          // RoleDept 指定部门
}
```

把 `Role.dataScope` 注释、校验与数据库约束统一到以上值。迁移前先统计现有角色数据；旧注释中的 `2..5` 含义与目标值冲突，必须由业务负责人根据角色实际授权逐条映射，不能只改注释或直接改解释。旧值 `6` 没有目标等价项，应作为需人工决策的迁移数据，不能静默转换。

多角色用户范围按**并集（取最大可见范围）**合并，且只考虑启用且未删除角色：任意角色 `ALL` 则为全部；自定义部门集合合并；部门范围、子树范围、本人范围合并成 OR 条件。若产品要求更严格的交集，应作为显式业务策略另行定义，不能在各查询中自行决定。无有效角色或无有效范围时默认拒绝/空结果，不默认全量。

查询条件生成器接受可信的 `UserPrincipal`、角色范围和由服务端配置的业务归属字段；不能允许请求传入任意列名。范例：

```ts
function buildUserWhere(principal: UserPrincipal, scope: ResolvedDataScope) {
  switch (scope.kind) {
    case DataScope.ALL: return {};
    case DataScope.DEPT: return { deptId: principal.deptId ?? -1n };
    case DataScope.DEPT_AND_CHILD: return { deptId: { in: scope.deptIds } };
    case DataScope.SELF: return { userId: principal.userId };
    case DataScope.CUSTOM: return { deptId: { in: scope.deptIds } };
  }
}
```

这是按用户列表归属字段举例，不是通用 where 生成实现。每个业务资源要声明其部门列、所有者列及可编辑规则；详情、更新、删除必须把数据范围条件合并进数据库查询（例如 `updateMany({ where: { id, ...scopeWhere } })`），不能只在列表接口过滤，也不能仅先查记录再依赖客户端判断。`DEPT_AND_CHILD` 的部门集合可由 `Dept.ancestors` 计算或以递归 CTE 查询，并需要维护路径一致性；`CUSTOM` 部门 ID 来自 `RoleDept`。

## 请求处理顺序与职责

1. 全局 `AuthGuard` 通过 `@Public()` 读取公开元数据；否则校验 Bearer access token 的签名、发行者、受众、有效期及撤销状态，加载/验证账号状态后建立只读 `request.user` 主体。主体至少包含 `userId`、`deptId`、有效角色键和权限版本/会话标识；不要只信任客户端传入的角色或权限 claim。
2. `PermissionGuard` 读取 `@Permission` 元数据。无权限元数据的普通受保护路由只要求认证；有声明时执行 AND/OR 及角色兜底检查。用户停用、删除或所有角色均不可用时拒绝。认证失败返回 401，权限不足返回 403。
3. 业务 service 使用 `DataScopeService` 获取当前主体范围，并将条件纳入 Prisma 查询。PermissionGuard 不负责构造/注入具体业务表的查询条件。
4. 审计记录用户、路由/权限、判定结果、时间与请求关联 ID；不要记录明文密码、token 或未脱敏敏感参数。

在 `CoreModule` 中通过 `APP_GUARD` 注册认证守卫，再注册权限守卫；需确认 Nest 全局守卫顺序和依赖注入。由于 `CoreModule` 作为基础设施模块注册，权限模块应避免循环导入：把所需服务放入可解析的模块依赖图，并用 `forwardRef` 作为最后手段。将 `PermissionModule`、`AuthModule` 纳入网关模块依赖；全局守卫宜在需要其依赖的应用模块通过 `APP_GUARD` 提供。用 `@Public()` 明确登录、健康检查、加密密钥协商等真正公开端点。

## 权限判定规则

- 字符串 `@Permission('x')` 等价于 `{ value: ['x'], mode: AND }`。
- `{ value: ['x', 'y'], mode: AND }` 要求权限集合同时包含 `x` 和 `y`。
- `{ value: ['x', 'y'], mode: OR }` 要求至少包含一个。
- `{ value: 'x', role: 'admin' }` 通过条件为“用户拥有 `admin` 角色 **或** 有 `x` 权限”。角色键区分大小写并唯一；仅允许通过配置显式授予的角色兜底，不支持通配符或隐式超级管理员。
- `role` 角色本身必须有效；停用或删除角色不作为兜底。即使角色兜底通过，数据访问仍受数据范围约束。
- 不建议支持 `*` 权限通配符作为第一版能力；需要层级权限时用受控的代码匹配规则并单测前缀边界，避免 `user:*` 意外覆盖其它资源。

## 缓存与一致性

第一版可先不缓存权限结果，确保行为正确后再优化。需要缓存时以 `userId + permissionVersion`（或角色授权版本组合）作为键，并设置短 TTL；分配/移除角色、角色权限变化、停用角色、用户停用时递增版本或主动失效。敏感管理操作应提供主动失效并在存储不可用时按安全策略拒绝或实时回源，不得继续使用无限期旧权限。

JWT 内不应承载长期权威权限快照。短期令牌只承载身份/会话标识；高风险接口可查询 token/session 撤销状态。退出登录、密码重置、账号禁用需有明确的令牌失效策略。

## 数据库迁移与实施顺序

1. 确认并盘点现有 `Role.dataScope` 数据，生成旧值到新值的逐角色映射；确认旧值 `6` 和其它非法值的处理方式。
2. 增加 `sys_permission`、`sys_role_permission`（及可选 `sys_menu_permission`）迁移；补唯一约束、状态/范围约束及 `role_key` 唯一索引。先部署兼容读写，再迁移 `Menu.perms` 和角色关系，核对后移除旧授权读取路径。
3. 实现认证主体、登录与令牌校验、`@Public()` 和全局 `AuthGuard`；优先覆盖管理和写入 API。密码必须使用已有 `PasswordHashService`，并以其算法参数/验证 API 为准。
4. 实现 `@Permission`、`Mode`、`PermissionGuard` 和权限解析；为权限目录建立受控种子/同步机制，增加角色权限管理接口。
5. 实现 `DataScope`、多角色合并规则、部门祖先解析和 Prisma 条件工具；逐个业务查询接入。数据范围必须进入读写查询谓词。
6. 增加审计、缓存版本失效、前端菜单投影和迁移后清理；发布后核对权限拒绝日志与范围边界。

## 必需测试

- 装饰器规范化：字符串、单元素/多元素数组、AND、OR、类与方法覆盖、角色兜底和非法 metadata。
- 守卫：匿名 401、公开路由放行、有效身份、缺权限 403、AND/OR、有效/停用角色兜底、用户/角色停用、元数据遗漏策略。
- 认证：密码正确/错误、停用用户、过期/伪造/撤销令牌、刷新轮换与登出。
- 数据范围：五种模式、多角色并集、空部门、自定义部门、部门子树、本人归属；列表、详情、更新、删除都不能越权。
- 并发/一致性：角色权限变更后旧缓存失效；迁移映射后的实际可见记录符合已确认的授权范围。

## 实施验收标准

- 受保护端点没有可绕过的匿名路径，公开端点明确声明。
- 后端权限检查独立于前端菜单展示，数据库权限点唯一且角色授权关系可审计。
- `@Permission` 的 AND、OR、角色兜底语义一致并有单测；认证拒绝与权限拒绝分别返回 401/403。
- 五种数据范围统一编码，历史值完成逐条映射；每个受控数据查询在 SQL/Prisma 条件层执行范围限制。
- 用户/角色/权限停用或授权变更按约定立即或在明确的短 TTL 内生效。
