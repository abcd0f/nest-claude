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

保留 `User`、`Role`、`Dept`、`Post` 和显式关联表，增加独立 `Permission` 模型与 `RolePermission`。`Permission` 是 API/业务动作的稳定标识目录，不等同于菜单项。当前前端只有 M/C/F 三种节点，且 `perms` 在 C 菜单和 F 按钮上填写，建议让每个带 `perms` 的 C/F 节点对应一条权限记录，`Permission.menuId` 唯一指向该节点；M 目录不产生功能权限。前端继续提交 `Menu.perms`，后端负责同步权限表。

```prisma
model Permission {
  permissionId BigInt   @id @default(autoincrement()) @map("permission_id")
  code         String   @unique @db.VarChar(128) // system:user:view
  name         String   @db.VarChar(100)
  resource     String?  @db.VarChar(100)
  action       String?  @db.VarChar(64)
  menuId       BigInt?  @unique @map("menu_id") // 对应 menuType=C/F 的菜单节点
  status       String   @default("0") @db.Char(1)
  menu         Menu?    @relation(fields: [menuId], references: [menuId], onDelete: SetNull)
  roles        RolePermission[]
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

在当前“一条 C/F 菜单节点对应一个权限编码”的需求下，不需要 `MenuPermission` 中间表；如果未来允许权限跨多个菜单节点复用，再引入多对多关联。具体字段以迁移策略为准。建议用数据库 enum 或 `CHECK` 约束状态/范围编码，并保持领域层枚举校验。`UserRole`、`RolePermission`、`RoleDept` 的复合主键和级联删除模式适用于当前单租户简单授权；如未来支持租户，需在所有唯一键、外键关系和查询条件中一致加入 `tenantId`，不能只加到主表。

`Role.roleKey` 必须唯一且不可由普通角色管理员随意改动；`Permission.code` 必须唯一、稳定且由代码/受控种子数据维护。权限删除前检查控制器代码引用和角色关联，优先停用而不是物理删除。状态值应有统一语义，例如 `0=启用、1=停用`，并在用户认证、角色解析和权限计算中一致过滤。

## 菜单页面与分表权限的对应方式

分表不要求前端拆成多个页面。前端继续使用 `M` 目录、`C` 菜单、`F` 按钮三种节点。参考 `ruoyi-plus-vben5-main` 的实际调用：菜单新增/编辑每次提交一个扁平 `Menu` 对象，字段中包含 `menuType` 和 `perms`；角色新增/编辑提交 `menuIds` 一维数组。后端在保存单条 C/F 节点时，同一事务自动同步权限表。前端不接触权限表主键，也不提交 `permissionIds`。

### 表之间的关系

```text
Menu                       菜单/目录/按钮节点
  │ 1                         1 │
  └──── Permission (仅 C/F) ────┘
                 │
Role ─────< RolePermission
  └──────< RoleMenu >──── Menu
```

- `Menu` 保存菜单树、路由、组件、显示/隐藏等导航信息。
- `Permission` 保存稳定的授权编码，例如 `system:user:view`、`system:user:add`。它是后端权限事实来源，不依赖菜单文案或路由地址。
- `Permission.menuId` 唯一指向一个带 `perms` 的 `C` 菜单或 `F` 按钮节点，`Permission.code` 与该节点的 `Menu.perms` 保持一致。M 目录没有功能权限。
- `RoleMenu(roleId, menuId)` 控制角色可以看到哪些导航节点。
- `RolePermission(roleId, permissionId)` 控制角色可以执行哪些后端动作。

菜单可见性和接口授权应同时配置但独立判定：用户看不到菜单不代表接口安全；只有 `RolePermission` 能让 `PermissionGuard` 放行接口。目录/父菜单通常没有动作权限，但应根据拥有的子菜单或显式 `menu:view` 权限计算是否展示。

### 前端提交载荷

菜单页面的新增/编辑接口是一条记录一个请求，不提交嵌套树或整张表。字段来自菜单表单的 `Menu` 模型；前端菜单列表拿到扁平记录后，按 `menuId/parentId` 构造树。F 按钮只填写现有 `perms` 字段，权限表对前端透明。

```json
{
  "menuId": 101,
  "parentId": 20,
  "menuName": "新增",
  "orderNum": 2,
  "menuType": "F",
  "perms": "system:user:add",
  "status": "0",
  "remark": null
}
```

新建时省略 `menuId`；编辑时带 `menuId`。M/C/F 使用同一请求 DTO，但按类型校验字段。菜单列表可返回扁平 `Menu[]`，如需角色授权树，则由菜单树选择接口返回 `{ menus, checkedKeys }`，与该前端仓库现有类型一致。

### 后端保存事务

`POST /system/menus`、`PATCH /system/menus/:id` 或批量接口可以共用一个应用服务：

1. 校验当前操作者具有 `system:menu:add` 或 `system:menu:edit`，并校验父菜单存在、不能形成环、菜单类型与路由字段匹配。
2. 在一个 Prisma transaction 中创建/更新单条 `Menu`。`M/C/F` 字段规则分别校验：F 不允许路由和组件，M/C 的路由字段按项目规则校验。
3. 若 `menuType` 为 C/F 且 `perms` 非空，按 `perms` 唯一编码查找或创建 `Permission`，同步 `Permission.menuId`、菜单名称和状态。若编码已绑定到另一个菜单节点，返回 409；更新编码涉及已有角色授权时，应显式迁移 `RolePermission` 关系并记录审计。
4. 若记录从 C/F 改为 M，或清空 `perms`，解除 `Permission.menuId`。如权限仍被 `RolePermission` 引用，不物理删除权限，停用并要求处理角色授权。
5. 提交事务后失效菜单/权限缓存，并记录操作者和变更前后差异。

示意代码：

```ts
await prisma.$transaction(async (tx) => {
  const menu = await upsertMenu(tx, input);
  if ((menu.menuType === 'C' || menu.menuType === 'F') && menu.perms) {
    await tx.permission.upsert({
      where: { code: menu.perms },
      create: { ...mapPermissionFromButton(menu), menuId: menu.menuId },
      update: { menuId: menu.menuId, name: menu.menuName, status: menu.status },
    });
  }
});
```

示意代码需要按项目生成的 Prisma 类型调整。权限编码变更会影响角色授权，必须显式迁移并审计，不可静默改写。

### 角色页面如何使用

角色编辑页使用树选择接口返回的菜单树和 `checkedKeys` 初始化勾选。保存角色时，前端只提交表单字段及选中的 `menuIds` 一维数组：

```json
{ "roleId": 1, "roleName": "用户管理员", "roleKey": "user-admin", "menuIds": [10, 20, 101, 102] }
```

后端在一个事务中按 `menuIds` 查询所有启用节点：M/C 写入 `RoleMenu`，任何被选中且带 `perms` 的 C/F 节点都通过 `Permission.menuId` 找到权限并写入 `RolePermission`。因此 C 菜单自身权限与 F 按钮权限由同一份 `menuIds` 表达，不需要前端额外提交权限编码数组。保留前端 `menuCheckStrictly` 语义：非严格模式需处理父子勾选联动；严格模式下校验提交 ID 并按产品规则补齐/要求父节点。勾选 C 不应隐式授予未勾选的 F 按钮；按钮需由角色页面明确勾选。角色保存后失效权限缓存。

### 从现有 `Menu.perms` 迁移

`Menu.perms` 继续作为前端菜单表单上的权限编码字段；后端将其同步到独立 `Permission.code`，授权守卫只从 `RolePermission -> Permission` 解析权限，避免守卫直接依赖菜单文本字段。迁移步骤如下：

1. 按非空、去空格后的 `Menu.perms` 生成唯一 `Permission.code`；重复编码只保留一条权限记录。
2. 为每个带非空 `perms` 的旧 C/F 菜单节点创建 `Permission`，并将该节点 ID 写入 `Permission.menuId`。
3. 根据现有 `RoleMenu` 反推出兼容的 `RolePermission`，并由业务人员抽样核对，尤其是按钮级权限和多个菜单复用同一编码的情况。
4. 应用切换到 `RolePermission` 判定并观察审计日志后，保留 `Menu.perms` 作为菜单配置输入/展示字段；切换前不要同时从 `RoleMenu + Menu.perms` 和 `RolePermission` 两套路径做 OR 判定，否则会出现权限意外放大。

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
2. 增加 `sys_permission`、`sys_role_permission` 迁移；补唯一约束、状态/范围约束及 `role_key` 唯一索引。先部署兼容读写，再从 C/F 节点的 `Menu.perms` 回填权限目录及角色权限关系，核对后切换守卫读取路径。
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
