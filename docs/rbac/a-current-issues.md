# 当前认证与权限设计问题

本文只记录当前仓库中可以直接确认的问题，不包含目标方案。

## 认证与授权尚未形成链路

- `libs/auth/src/auth.service.ts` 中的 `AuthService` 为空类；模块只提供并导出该服务，没有登录、凭证验证、令牌签发、令牌校验或用户上下文建立逻辑。
- `libs/permission/src/permission.service.ts` 中的 `PermissionService` 为空类；当前没有权限元数据、权限检查或数据范围计算实现。
- `apps/gateway/src/app.module.ts` 没有导入 `AuthModule` 或 `PermissionModule`；即使这两个模块后续增加提供者，当前应用启动图也不会使用它们。
- 仓库没有 JWT/Passport 策略、认证守卫、权限守卫、公开路由标记或用户请求上下文类型。`package.json` 中也没有 JWT、Passport 相关依赖。
- `CoreModule` 目前只全局注册限流守卫、异常过滤器和响应拦截器，没有全局认证或授权守卫。
- `apps/gateway/src/modules/system/example/example.controller.ts` 中的创建、查询、更新和删除端点都没有认证或权限声明。当前路由不能证明调用者身份，也不执行访问控制。
- 未发现 `@Permission(...)` 装饰器、权限模式 `Mode`、角色兜底选项或相应的测试。

## RBAC 表结构与语义问题

- `Role.dataScope` 的注释定义为 `1=全部、2=自定义、3=本部门、4=本部门及以下、5=本人、6=部门及以下或本人`，而目标数据范围需要 `1=全部、2=本部门、3=本部门及以下、4=仅本人、5=自定义`。现有编码语义不兼容；若直接按目标枚举读取旧值，会把授权范围解释错误。
- `Role.dataScope` 是无约束的 `String @db.Char(1)`。数据库层没有枚举/检查约束；代码中也没有对应的类型化枚举或校验，非法值和不同环境中的解释分歧无法由 schema 阻止。
- `RoleMenu` 只能把角色连到 `Menu`，具体权限字符串放在可空的 `Menu.perms`（长度 100）中。权限点因此和导航/菜单记录耦合；按钮权限、非菜单 API 权限没有独立实体和唯一性约束，`perms` 为空或重复也未被结构约束。
- `Menu.menuType`、`Role.status`、`User.status`、`delFlag` 等状态字段都是任意字符串/字符列，没有 Prisma enum 或数据库检查约束；启用、停用、删除记录的授权过滤语义没有在代码中落实。
- `UserRole` 是用户角色关联表，但没有生效时间、分配人或状态等字段。该设计本身能表达简单多对多关系，但无法记录授权变更上下文；仓库也没有角色分配服务来校验用户、角色状态和权限变更。
- `RoleDept` 支持自定义部门关联，但没有数据范围查询器使用它；也没有定义用户拥有多个角色且各角色范围不同时的合并规则。
- 仓库中没有 `prisma/migrations` 目录或可审查的 RBAC 迁移脚本；现有模型变更无法从仓库追踪到数据库版本，也没有权限表扩展的迁移基线。
- `Dept.ancestors` 是自由文本物化路径，字段注释说明含自身，但默认值为 `/`，没有路径格式/一致性校验。当前没有基于该字段的祖先部门授权查询。
- 角色、菜单、部门、用户模型没有 `tenantId`。若系统未来需要租户隔离，当前唯一键和关联模型不能表达租户边界；仓库没有表明当前已支持多租户。
- `Menu` 同时保存路由、前端组件、显示状态和权限字符串。仓库没有区分后端接口授权源与前端菜单/路由投影的服务或同步规则。

## 数据范围尚未具备执行条件

- 仓库没有数据范围枚举、策略构造器或 Prisma 查询条件注入机制。
- `User.deptId` 是单个可空部门归属，`RoleDept` 是自定义部门集合，但没有定义部门为空时的结果，也没有定义 `SELF` 应匹配的业务表归属字段。
- 当前示例业务模型没有可用于验证 `DEPT`、`DEPT_AND_CHILD`、`SELF`、`CUSTOM` 的带部门/归属人业务数据，也没有对越权列表、详情、更新和删除的测试。
- `Role.dataScope` 在角色上，但没有说明多角色用户的数据范围是取并集、交集还是指定主角色；这一缺失会直接造成不同业务模块实现不一致。

## 缺少安全边界与回归覆盖

- 没有登录凭证生命周期、密码登录策略、令牌撤销/轮换、密码错误限速或登出行为的实现与测试。
- `User.password` 仅是存储列定义；schema 本身不能保证其内容经过安全哈希，仓库没有认证代码证明写入/验证路径使用了 `PasswordHashService`。
- 未发现角色/权限变更后的缓存失效或权限版本控制逻辑（目前也没有权限缓存实现），所以尚无一致性策略可供验证。
- 当前测试只检查 `PermissionService` 可实例化，没有权限通过/拒绝、匿名访问、失效用户/角色、角色兜底、数据范围合并或越权数据访问测试。
- API 加密守卫仅处理报文加密策略，不建立用户身份，也不替代认证或授权；仓库没有将其与权限边界混用的代码，但目前也没有文档阐明两者职责。

## 涉及位置

- `prisma/models/user.prisma`
- `prisma/models/role.prisma`
- `prisma/models/menu.prisma`
- `prisma/models/dept.prisma`
- `prisma/models/relations.prisma`
- `libs/auth/src/`
- `libs/permission/src/`
- `libs/core/src/core.module.ts`
- `apps/gateway/src/modules/system/example/example.controller.ts`
