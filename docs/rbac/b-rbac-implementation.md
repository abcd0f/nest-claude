# RBAC 权限架构实施设计

## 一、架构目标与边界

### 1.1 核心目标

本设计面向 **NestJS 12 + Fastify + Prisma 7 + PostgreSQL** 技术栈，实现完整的企业级 RBAC 权限控制系统，包含：

- **认证层（Authentication）**：确认请求用户身份
- **功能权限层（Authorization）**：判断用户能否执行某个操作
- **数据权限层（Data Scope）**：限制操作可访问的记录集合

三层独立解耦，职责清晰，默认拒绝策略。

### 1.2 设计原则

1. **默认拒绝**：受保护路由必须有有效身份；声明权限的路由必须满足元数据策略；数据查询必须显式应用范围条件
2. **单一职责**：认证、权限、数据范围各司其职，不相互越界
3. **类型安全**：BigInt ID 边界清晰，DTO 校验严格
4. **易于维护**：代码结构清晰，职责明确，便于 AI 理解和实现
5. **审计追踪**：所有权限变更、授权判定可追溯

### 1.3 装饰器 API 设计

```ts
import { Mode, Permission } from '@app/permission';

// 单个权限
@Get()
@Permission('system:user:view')
findAll() {}

// 多个权限 OR 模式
@Post()
@Permission({ value: ['system:user:add', 'system:user:edit'], mode: Mode.OR })
save() {}

// 多个权限 AND 模式（默认）
@Put()
@Permission(['system:user:edit', 'system:user:view'])
update() {}
```

**类型定义：**

```ts
export enum Mode {
  AND = 'AND',
  OR = 'OR',
}

export type PermissionInput =
  | string
  | string[]
  | {
      value: string | string[];
      mode?: Mode;
    };

export type PermissionMetadata = {
  value: readonly string[];
  mode: Mode;
};

export function Permission(input: PermissionInput): MethodDecorator & ClassDecorator;
```

**设计说明：**

- 单个字符串自动转为 `{ value: [string], mode: AND }`
- 字符串数组默认 AND 模式，需要 OR 必须显式声明
- 移除 `role` 兜底设计，简化权限判定逻辑
- 方法级装饰器覆盖类级装饰器

## 二、技术栈与模块架构

### 2.1 依赖选型

**核心依赖：**

```bash
pnpm add @nestjs/jwt
```

**设计决策：**

- ✅ 使用 `@nestjs/jwt` 处理 JWT 签发和校验
- ✅ 密码使用项目现有 `PasswordHashService`
- ❌ 不使用 `@nestjs/authorization` 和 `@nestjs/authentication`（增加复杂度，收益有限）
- ✅ 使用 NestJS 原生 `SetMetadata` + `Reflector` 实现权限装饰器

### 2.2 模块目录结构

```text
libs/
  ├── auth/src/
  │   ├── auth.module.ts
  │   ├── services/
  │   │   ├── auth.service.ts              # 登录、token、session
  │   │   └── token.service.ts             # JWT 签发/校验
  │   ├── guards/
  │   │   └── auth.guard.ts                # Bearer/JWT 认证
  │   ├── decorators/
  │   │   ├── public.decorator.ts          # @Public()
  │   │   └── current-user.decorator.ts    # @CurrentUser()
  │   ├── controllers/
  │   │   └── auth.controller.ts           # login/logout/refresh/me
  │   ├── dto/
  │   └── types/
  │       └── user-principal.type.ts       # 当前用户主体
  │
  ├── permission/src/
  │   ├── permission.module.ts
  │   ├── services/
  │   │   ├── permission.service.ts        # 权限解析
  │   │   └── data-scope.service.ts        # 数据范围
  │   ├── guards/
  │   │   └── permission.guard.ts          # @Permission 判定
  │   ├── decorators/
  │   │   └── permission.decorator.ts      # @Permission()
  │   ├── enums/
  │   │   ├── mode.enum.ts                 # AND/OR
  │   │   └── data-scope.enum.ts           # 数据范围枚举
  │   └── types/
  │
  └── common/
      ├── utils/
      │   ├── bigint.util.ts               # parseId/formatId
      │   └── where.util.ts                # andWhere/orWhere
      └── dto/
          └── dto-transformer.ts           # toDto/toDtoList/toPageDto

apps/gateway/src/modules/system/
  ├── user/
  │   ├── user.controller.ts
  │   ├── user.service.ts
  │   ├── user.repository.ts
  │   ├── user.mapper.ts
  │   └── dto/
  ├── role/
  ├── dept/
  ├── menu/
  └── post/
```

### 2.3 模块依赖关系

```text
AppModule
  ├── AppConfigModule.forRoot()
  ├── DatabaseModule
  ├── CryptoModule
  ├── AuthModule
  │   └── depends: DatabaseModule, CryptoModule, ConfigModule
  ├── PermissionModule
  │   └── depends: DatabaseModule, AuthModule
  ├── CoreModule
  │   └── provides: APP_GUARD (AuthGuard, PermissionGuard)
  └── SystemModule
      └── depends: AuthModule, PermissionModule
```

**依赖规则：**

1. `AuthModule` 不依赖 `SystemModule`，避免循环依赖
2. 全局 Guard 在 `CoreModule` 通过 `APP_GUARD` 注册
3. Guard 注册顺序：先 `AuthGuard`，后 `PermissionGuard`
4. 装饰器只写 metadata，不执行数据库查询
5. 方法级 metadata 覆盖类级 metadata（使用 `getAllAndOverride`）

## 三、数据模型设计

### 3.1 核心表设计

#### 3.1.1 Permission（权限表）

独立的权限目录，是后端授权的事实来源。

```prisma
model Permission {
  permissionId BigInt   @id @default(autoincrement()) @map(“permission_id”)
  code         String   @unique @db.VarChar(128)        // system:user:view
  name         String   @db.VarChar(100)                // 用户查看
  resource     String?  @db.VarChar(100)                // user（可选，便于分组）
  action       String?  @db.VarChar(64)                 // view/add/edit/remove
  menuId       BigInt?  @unique @map(“menu_id”)         // 关联菜单（可选，C/F 类型）
  status       String   @default(“0”) @db.Char(1)       // 0=启用, 1=停用
  remark       String?  @db.VarChar(500)
  createdAt    DateTime @default(now()) @map(“created_at”)
  updatedAt    DateTime @updatedAt @map(“updated_at”)

  menu         Menu?    @relation(fields: [menuId], references: [menuId], onDelete: SetNull)
  roles        RolePermission[]

  @@map(“sys_permission”)
}
```

**设计说明：**

- `code` 全局唯一，是权限编码的稳定标识
- `menuId` 唯一，一个 C/F 菜单节点只能绑定一个权限
- M 目录不产生权限，不关联 Permission
- `resource` 和 `action` 可选，用于权限管理界面分类展示

**关于超级管理员：**

系统保留 `roleKey = 'superadmin'` 作为超级管理员角色。该角色拥有特殊权限：

1. **权限判定时自动通过**：`PermissionGuard` 检测到用户拥有 `superadmin` 角色时，直接放行
2. **数据范围自动为 ALL**：`DataScopeService` 检测到 `superadmin` 时，返回全部数据
3. **保护机制**：
   - 不能删除 `superadmin` 角色
   - 必须保留至少一个拥有 `superadmin` 角色的启用用户
   - `superadmin` 角色的菜单和权限配置仍需维护（用于前端展示）

```ts
// libs/permission/src/constants/reserved-roles.ts
export const RESERVED_ROLES = {
  SUPER_ADMIN: 'superadmin',
} as const;

export function isSuperAdmin(roleKeys: string[]): boolean {
  return roleKeys.includes(RESERVED_ROLES.SUPER_ADMIN);
}
```

#### 3.1.2 Role（角色表）

```prisma
model Role {
  roleId            BigInt   @id @default(autoincrement()) @map(“role_id”)
  roleKey           String   @unique @db.VarChar(64)
  roleName          String   @db.VarChar(100)
  dataScope         String   @default(“1”) @db.Char(1)   // 数据范围
  status            String   @default(“0”) @db.Char(1)   // 0=正常 1=停用
  delFlag           String   @default(“0”) @db.Char(1)   // 0=未删 1=已删
  remark            String?  @db.VarChar(500)
  createdAt         DateTime @default(now()) @map(“created_at”)
  updatedAt         DateTime @updatedAt @map(“updated_at”)

  users             UserRole[]
  permissions       RolePermission[]
  menus             RoleMenu[]
  depts             RoleDept[]

  @@map(“sys_role”)
}
```

**数据范围枚举：**

```ts
export enum DataScope {
  ALL = '1', // 全部数据
  CUSTOM = '2', // sys_role_dept 指定部门
  DEPT = '3', // 本部门
  DEPT_AND_CHILD = '4', // 本部门及以下
  SELF = '5', // 仅本人
}
```

#### 3.1.3 User（用户表）

```prisma
model User {
  userId              BigInt      @id @default(autoincrement()) @map(“user_id”)
  username            String      @unique @db.VarChar(64)
  password            String      @db.VarChar(255)
  nickName            String      @db.VarChar(100)
  email               String?     @unique @db.VarChar(100)
  phone               String?     @db.VarChar(20)
  deptId              BigInt?     @map(“dept_id”)
  status              String      @default(“0”) @db.Char(1)       // 0=正常 1=停用
  delFlag             String      @default(“0”) @db.Char(1)       // 0=未删 1=已删
  loginIp             String?     @db.VarChar(128)
  loginTime           DateTime?   @map(“login_time”)
  permissionVersion   Int         @default(0)                     // 权限版本号，用于缓存失效
  createdAt           DateTime    @default(now()) @map(“created_at”)
  updatedAt           DateTime    @updatedAt @map(“updated_at”)

  dept                Dept?       @relation(fields: [deptId], references: [deptId])
  roles               UserRole[]
  posts               UserPost[]

  @@map(“sys_user”)
}
```

**关键字段说明：**

- `permissionVersion`：权限缓存版本号，权限变更时递增，自动使旧缓存失效

#### 3.1.4 Menu（菜单表）

```prisma
model Menu {
  menuId              BigInt      @id @default(autoincrement()) @map(“menu_id”)
  parentId            BigInt      @default(0) @map(“parent_id”)
  menuName            String      @db.VarChar(100)
  orderNum            Int         @default(0)
  menuType            String      @db.Char(1)                    // M=目录 C=菜单 F=按钮
  path                String?     @db.VarChar(200)               // 路由路径
  component           String?     @db.VarChar(255)               // 组件路径
  perms               String?     @db.VarChar(128)               // 权限标识（system:user:view）
  status              String      @default(“0”) @db.Char(1)      // 0=显示 1=隐藏
  delFlag             String      @default(“0”) @db.Char(1)      // 0=未删 1=已删
  createdAt           DateTime    @default(now()) @map(“created_at”)
  updatedAt           DateTime    @updatedAt @map(“updated_at”)

  permission          Permission?
  roles               RoleMenu[]

  @@map(“sys_menu”)
}
```

**菜单类型说明：**

- M（目录）：不允许 `perms`，不允许 `path/component`
- C（菜单）：可选 `perms`，必须有 `path/component`
- F（按钮）：可选 `perms`，不允许 `path/component`

#### 3.1.5 关联表

```prisma
// 用户-角色
model UserRole {
  userId              BigInt      @map(“user_id”)
  roleId              BigInt      @map(“role_id”)
  user                User        @relation(fields: [userId], references: [userId], onDelete: Cascade)
  role                Role        @relation(fields: [roleId], references: [roleId], onDelete: Cascade)
  @@id([userId, roleId])
  @@map(“sys_user_role”)
}

// 角色-权限
model RolePermission {
  roleId              BigInt      @map(“role_id”)
  permissionId        BigInt      @map(“permission_id”)
  role                Role        @relation(fields: [roleId], references: [roleId], onDelete: Cascade)
  permission          Permission  @relation(fields: [permissionId], references: [permissionId], onDelete: Cascade)
  @@id([roleId, permissionId])
  @@index([permissionId])
  @@map(“sys_role_permission”)
}

// 角色-菜单
model RoleMenu {
  roleId              BigInt      @map(“role_id”)
  menuId              BigInt      @map(“menu_id”)
  role                Role        @relation(fields: [roleId], references: [roleId], onDelete: Cascade)
  menu                Menu        @relation(fields: [menuId], references: [menuId], onDelete: Cascade)
  @@id([roleId, menuId])
  @@map(“sys_role_menu”)
}

// 角色-部门（数据范围）
model RoleDept {
  roleId              BigInt      @map(“role_id”)
  deptId              BigInt      @map(“dept_id”)
  role                Role        @relation(fields: [roleId], references: [roleId], onDelete: Cascade)
  dept                Dept        @relation(fields: [deptId], references: [deptId], onDelete: Cascade)
  @@id([roleId, deptId])
  @@map(“sys_role_dept”)
}

// 用户-职位
model UserPost {
  userId              BigInt      @map(“user_id”)
  postId              BigInt      @map(“post_id”)
  user                User        @relation(fields: [userId], references: [userId], onDelete: Cascade)
  post                Post        @relation(fields: [postId], references: [postId], onDelete: Cascade)
  @@id([userId, postId])
  @@map(“sys_user_post”)
}
```

### 3.2 菜单-权限关系设计

#### 关系图

```text
Menu (M/C/F)
  │
  ├── M (目录)  ────> 无权限，仅导航
  │
  ├── C (菜单)  ────> perms (可选) ────> Permission (1:1)
  │
  └── F (按钮)  ────> perms (可选) ────> Permission (1:1)

Role
  ├───< RoleMenu >──── Menu (控制导航可见性)
  └───< RolePermission >──── Permission (控制接口访问)
```

#### 同步规则

1. **菜单保存时自动同步权限：**
   - M 类型：不处理 `perms`
   - C/F 类型且 `perms` 非空：自动创建或更新 Permission
   - C/F 类型但 `perms` 为空：解除 Permission 绑定

2. **角色菜单授权时自动同步权限：**
   - 前端提交 `menuIds` 数组
   - 后端同时写入 `RoleMenu` 和 `RolePermission`
   - C/F 菜单如有权限，自动授予

3. **权限编码变更保护：**
   - 同一 `perms` 编码不能被多个菜单占用
   - 权限被角色引用时，编码变更需显式迁移
   - 菜单删除时，权限被引用不物理删除，只停用

### 3.3 BigInt 边界规范

所有 ID 字段（用户、角色、部门、菜单、职位）都是 PostgreSQL `bigint` / Prisma `BigInt`。

#### 分层处理规则

| 边界                 | 类型     | 转换规则                              |
| -------------------- | -------- | ------------------------------------- |
| Prisma schema/Client | `bigint` | 数据库查询、关联 ID 全部使用 `bigint` |
| Domain service       | `bigint` | Service 接收已验证的 `bigint`         |
| Request DTO          | `string` | `@IsString()` + 十进制格式校验        |
| Response DTO         | `string` | `@Transform()` 转换为字符串           |
| JWT claims           | `string` | `sub/sid` 使用字符串                  |
| Redis/JSON cache     | `string` | 序列化前转换为字符串                  |
| 日志/审计            | `string` | `.toString()` 转换                    |

#### 工具函数

```ts
// libs/common/src/utils/bigint.util.ts
const DECIMAL_ID = /^(0|[1-9][0-9]*)$/;

export function parseId(value: unknown, field = 'id'): bigint {
  if (typeof value !== 'string' || !DECIMAL_ID.test(value)) {
    throw new UnprocessableEntityException(`${field} 必须是十进制字符串`);
  }
  return BigInt(value);
}

export function formatId(value: bigint | null | undefined): string | null | undefined {
  return value == null ? value : value.toString();
}
```

#### DTO 示例

```ts
// 请求 DTO
export class MenuIdParamDto {
  @IsString()
  @Matches(/^(0|[1-9][0-9]*)$/)
  menuId!: string;
}

// 响应 DTO
export class MenuResponseDto {
  @Expose()
  @Transform(({ value }) => value?.toString(), { toPlainOnly: true })
  menuId!: string;

  @Expose()
  menuName!: string;

  // ... 其他字段
}
```

#### BigInt 使用禁区

- ❌ 不把数据库 ID 声明为 TypeScript `number`
- ❌ 不把 `bigint` 放入 `JSON.stringify`、JWT payload、Redis JSON
- ❌ 不用 `BigInt` 与 `number` 混合比较
- ❌ 不把 BigInt 转 string 后拼接 SQL（使用参数化查询）
- ❌ 不为每个表发明 `toXxxId/fromXxxId`（统一使用 `parseId/formatId`）

## 四、核心服务实现设计

### 4.1 认证服务（AuthService）

**职责：**登录、Token 签发、Token 校验、会话管理

**核心方法：**

```ts
class AuthService {
  async login(dto: LoginDto): Promise<LoginResultDto>;
  async refreshToken(refreshToken: string): Promise<TokenDto>;
  async logout(userId: bigint, sessionId: string): Promise<void>;
  async getCurrentUser(userId: bigint): Promise<UserPrincipal>;
  async validateUser(username: string, password: string): Promise<User | null>;
}
```

**登录流程：**

1. 校验 DTO（用户名、密码格式）
2. 查询用户并验证密码（不存在时执行 dummy hash 防止时序攻击）
3. 检查用户状态（`status='0'`, `delFlag='0'`）
4. 签发 Access Token（短期，15min-1h）
5. 可选：签发 Refresh Token（长期，存储哈希）
6. 更新登录 IP 和时间
7. 记录登录审计

**Token 设计：**

```ts
interface AccessTokenPayload {
  sub: string; // userId (字符串)
  sid: string; // sessionId (字符串)
  iat: number;
  exp: number;
  iss: string; // 发行者
  aud: string; // 受众
}
```

### 4.2 权限服务（PermissionService）

**职责：**解析用户权限、权限缓存、权限版本管理

**核心方法：**

```ts
class PermissionService {
  async resolveUserPermissions(userId: bigint): Promise<Set<string>>;
  async invalidateUserPermissions(userIds: bigint[]): Promise<void>;
  async invalidateRolePermissions(roleId: bigint): Promise<void>;
  async syncPermissionSeeds(seeds: PermissionDefinition[]): Promise<SyncResult>;
}
```

**权限解析流程：**

```typescript
async resolveUserPermissions(userId: bigint): Promise<Set<string>> {
  // 1. 获取用户权限版本
  const user = await this.prisma.user.findUnique({
    where: { userId },
    select: { permissionVersion: true, status: true, delFlag: true }
  });

  if (!user || user.status !== '0' || user.delFlag !== '0') {
    return new Set();
  }

  // 2. 尝试从缓存读取
  const cacheKey = `user:perms:${userId}:${user.permissionVersion}`;
  const cached = await this.cacheManager.get<string[]>(cacheKey);
  if (cached) {
    return new Set(cached);
  }

  // 3. 从数据库查询：User -> UserRole -> RolePermission -> Permission
  const permissions = await this.prisma.permission.findMany({
    where: {
      status: '0',
      roles: {
        some: {
          role: {
            status: '0',
            delFlag: '0',
            users: {
              some: {
                userId,
                user: { status: '0', delFlag: '0' }
              }
            }
          }
        }
      }
    },
    select: { code: true }
  });

  const permSet = new Set(permissions.map(p => p.code));

  // 4. 缓存 1 小时
  await this.cacheManager.set(cacheKey, [...permSet], 3600 * 1000);

  return permSet;
}
```

**缓存失效策略：**

```typescript
// 角色权限变更时，递增所有拥有该角色的用户的版本号
async invalidateRolePermissions(roleId: bigint) {
  const userIds = await this.prisma.userRole.findMany({
    where: { roleId },
    select: { userId: true }
  });

  if (userIds.length > 0) {
    await this.prisma.user.updateMany({
      where: { userId: { in: userIds.map(u => u.userId) } },
      data: { permissionVersion: { increment: 1 } }
    });
  }
}
```

### 4.3 数据范围服务（DataScopeService）

**职责：**解析数据范围、生成 Prisma where 条件

**核心方法：**

```ts
class DataScopeService {
  async resolveUserScope(userId: bigint): Promise<ResolvedDataScope>;
  buildWhereForResource(
    scope: ResolvedDataScope,
    resource: ResourceType,
    userDeptId: bigint | null,
    userId: bigint,
  ): Prisma.WhereInput;
}
```

**数据范围解析：**

```typescript
async resolveUserScope(userId: bigint): Promise<ResolvedDataScope> {
  const userRoles = await this.prisma.userRole.findMany({
    where: {
      userId,
      user: { status: '0', delFlag: '0' }
    },
    include: {
      role: {
        where: { status: '0', delFlag: '0' },
        select: {
          dataScope: true,
          depts: { select: { deptId: true } }
        }
      }
    }
  });

  const roles = userRoles.map(ur => ur.role).filter(Boolean);

  // 任意角色是 ALL，则返回 ALL
  if (roles.some(r => r.dataScope === DataScope.ALL)) {
    return { kind: DataScope.ALL };
  }

  // 收集所有 CUSTOM 部门
  const customDepts = new Set<bigint>();
  roles.forEach(role => {
    if (role.dataScope === DataScope.CUSTOM) {
      role.depts.forEach(d => customDepts.add(d.deptId));
    }
  });

  if (customDepts.size > 0) {
    return { kind: DataScope.CUSTOM, deptIds: [...customDepts] };
  }

  // 按优先级返回：DEPT_AND_CHILD > DEPT > SELF
  if (roles.some(r => r.dataScope === DataScope.DEPT_AND_CHILD)) {
    return { kind: DataScope.DEPT_AND_CHILD };
  }

  if (roles.some(r => r.dataScope === DataScope.DEPT)) {
    return { kind: DataScope.DEPT };
  }

  return { kind: DataScope.SELF };
}
```

**Where 条件生成：**

```typescript
buildWhereForResource(
  scope: ResolvedDataScope,
  resource: ResourceType,
  userDeptId: bigint | null,
  userId: bigint
) {
  switch (scope.kind) {
    case DataScope.ALL:
      return {};

    case DataScope.DEPT:
      return { deptId: userDeptId ?? -1n };

    case DataScope.DEPT_AND_CHILD:
      // 需要查询部门子树
      const deptIds = await this.getDeptChildrenIds(userDeptId);
      return { deptId: { in: deptIds } };

    case DataScope.SELF:
      // 根据资源类型返回不同的字段
      const ownerField = this.getResourceOwnerField(resource);
      return { [ownerField]: userId };

    case DataScope.CUSTOM:
      return { deptId: { in: scope.deptIds } };
  }
}
```

### 4.4 菜单服务（MenuService）

**职责：**菜单 CRUD、菜单-权限同步、菜单树构建

**核心方法：**

```ts
class MenuService {
  async saveMenu(input: CreateMenuDto | UpdateMenuDto): Promise<MenuDto>;
  async deleteMenu(menuId: bigint): Promise<void>;
  async getMenuTree(): Promise<MenuTreeDto[]>;
  async getRoleMenuTree(roleId: bigint): Promise<RoleMenuTreeDto>;
  async assignMenusToRole(roleId: bigint, menuIds: bigint[]): Promise<void>;
}
```

**菜单保存事务（关键）：**

```typescript
async saveMenu(input: CreateMenuDto | UpdateMenuDto) {
  return await this.prisma.$transaction(async (tx) => {
    // 1. 校验菜单类型与字段匹配
    this.validateMenuTypeFields(input);

    // 2. 校验父菜单存在且不形成环
    if (input.parentId && input.parentId !== 0n) {
      await this.checkParentValid(tx, input.parentId, input.menuId);
    }

    // 3. 保存或更新菜单
    const menu = await tx.menu.upsert({
      where: { menuId: input.menuId || 0n },
      update: { ...input },
      create: { ...input }
    });

    // 4. 同步权限表（核心逻辑）
    await this.syncPermissionFromMenu(tx, menu);

    return menu;
  });
}

private async syncPermissionFromMenu(tx, menu) {
  // M 类型不产生权限
  if (menu.menuType === 'M') {
    return;
  }

  // C/F 类型但没有 perms，解除权限绑定
  if (!menu.perms) {
    const existing = await tx.permission.findUnique({
      where: { menuId: menu.menuId }
    });
    if (existing) {
      await tx.permission.update({
        where: { permissionId: existing.permissionId },
        data: { menuId: null }
      });
    }
    return;
  }

  // 检查权限编码是否被其它菜单占用
  const conflict = await tx.permission.findFirst({
    where: {
      code: menu.perms,
      menuId: { not: menu.menuId }
    }
  });

  if (conflict) {
    throw new ConflictException(`权限编码 ${menu.perms} 已被其它菜单占用`);
  }

  // 获取或创建权限
  const existing = await tx.permission.findUnique({
    where: { menuId: menu.menuId }
  });

  if (existing) {
    // 更新权限
    await tx.permission.update({
      where: { permissionId: existing.permissionId },
      data: {
        code: menu.perms,
        name: menu.menuName,
        status: menu.status
      }
    });
  } else {
    // 新建权限
    await tx.permission.create({
      data: {
        code: menu.perms,
        name: menu.menuName,
        status: menu.status,
        menuId: menu.menuId
      }
    });
  }
}
```

**角色菜单授权（同步权限）：**

```typescript
async assignMenusToRole(roleId: bigint, menuIds: bigint[]) {
  return await this.prisma.$transaction(async (tx) => {
    // 1. 清除原有关联
    await tx.roleMenu.deleteMany({ where: { roleId } });
    await tx.rolePermission.deleteMany({ where: { roleId } });

    // 2. 批量查询菜单
    const menus = await tx.menu.findMany({
      where: {
        menuId: { in: menuIds },
        delFlag: '0',
        status: '0'
      },
      include: {
        permission: { select: { permissionId: true } }
      }
    });

    if (menus.length !== menuIds.length) {
      throw new BadRequestException('部分菜单不存在或已停用');
    }

    // 3. 创建 RoleMenu
    await tx.roleMenu.createMany({
      data: menus.map(m => ({ roleId, menuId: m.menuId }))
    });

    // 4. 创建 RolePermission（仅 C/F 且有权限的菜单）
    const permissions = menus
      .filter(m => m.permission)
      .map(m => ({ roleId, permissionId: m.permission!.permissionId }));

    if (permissions.length > 0) {
      await tx.rolePermission.createMany({ data: permissions });
    }
  });
}
```

### 4.5 守卫实现（Guards）

#### AuthGuard

```typescript
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
    private authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. 检查是否是公开路由
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // 2. 提取 Bearer Token
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('缺少认证令牌');
    }

    try {
      // 3. 验证 Token
      const payload = await this.jwtService.verifyAsync(token);

      // 4. 加载用户主体
      const userId = parseId(payload.sub, 'userId');
      const user = await this.authService.getCurrentUser(userId);

      // 5. 设置到请求上下文
      request.user = user;
    } catch (error) {
      throw new UnauthorizedException('令牌无效或已过期');
    }

    return true;
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
```

#### PermissionGuard

```typescript
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. 读取权限元数据
    const permission = this.reflector.getAllAndOverride<PermissionMetadata>('permission', [
      context.getHandler(),
      context.getClass(),
    ]);

    // 无权限声明，只要求认证
    if (!permission) {
      return true;
    }

    // 2. 获取当前用户
    const request = context.switchToHttp().getRequest();
    const user: UserPrincipal = request.user;

    if (!user) {
      throw new UnauthorizedException('用户未认证');
    }

    // 3. 解析用户权限
    const userPermissions = await this.permissionService.resolveUserPermissions(user.userId);

    // 4. 判定权限
    const hasPermission = this.checkPermission(permission, userPermissions);

    if (!hasPermission) {
      throw new ForbiddenException('权限不足');
    }

    return true;
  }

  private checkPermission(
    required: PermissionMetadata,
    userPerms: Set<string>,
    userRoles: string[],
  ): boolean {
    // 超级管理员直接通过
    if (isSuperAdmin(userRoles)) {
      return true;
    }

    if (required.mode === Mode.AND) {
      // 全部包含
      return required.value.every((p) => userPerms.has(p));
    }

    if (required.mode === Mode.OR) {
      // 至少一个
      return required.value.some((p) => userPerms.has(p));
    }

    return false;
  }
}
```

## 五、菜单页面与分表权限的对应方式

## 五、前后端交互方式

### 5.1 菜单页面交互

**前端提交格式（单条菜单）：**

```json
{
  "menuId": "101", // 编辑时必传，新增时不传
  "parentId": "20",
  "menuName": "新增",
  "orderNum": 2,
  "menuType": "F", // M=目录, C=菜单, F=按钮
  "perms": "system:user:add", // C/F 可选，M 不允许
  "path": null, // M/F 不允许，C 必须
  "component": null, // M/F 不允许，C 必须
  "status": "0"
}
```

**后端接口：**

- `POST /system/menu` - 新增菜单
- `PUT /system/menu/:menuId` - 更新菜单
- `DELETE /system/menu/:menuId` - 删除菜单
- `GET /system/menu/tree` - 获取菜单树

**菜单树返回格式：**

```json
[
  {
    "menuId": "1",
    "menuName": "系统管理",
    "menuType": "M",
    "children": [
      {
        "menuId": "100",
        "menuName": "用户管理",
        "menuType": "C",
        "perms": "system:user:list",
        "path": "/system/user",
        "component": "system/user/index",
        "children": [
          {
            "menuId": "1001",
            "menuName": "新增",
            "menuType": "F",
            "perms": "system:user:add"
          }
        ]
      }
    ]
  }
]
```

### 5.2 角色菜单授权

**前端提交格式：**

```json
{
  "roleId": "1",
  "roleName": "用户管理员",
  "roleKey": "user-admin",
  "dataScope": "2",
  "menuIds": ["1", "100", "1001", "1002"], // 一维数组
  "menuCheckStrictly": false
}
```

**后端处理流程：**

1. 校验所有 `menuIds` 存在且启用
2. 同一事务内：
   - 清除原有 `RoleMenu` 和 `RolePermission`
   - 批量创建 `RoleMenu`
   - 为 C/F 类型且有权限的菜单创建 `RolePermission`
3. 失效该角色所有用户的权限缓存

### 5.3 角色菜单树查询

**接口：** `GET /system/menu/role/:roleId`

**返回格式：**

```json
{
  "tree": [...],          // 完整菜单树
  "checkedKeys": ["100", "1001", "1002"]  // 该角色已选中的菜单 ID
}
```

### 5.4 前端权限快照接口

为了前端按钮显示，提供当前用户权限查询接口。

**接口：** `GET /auth/permissions`

**返回：**

```json
{
  "permissions": ["system:user:view", "system:user:add", "system:user:edit"]
}
```

**说明：** 该接口仅用于前端 UI 展示，不是后端授权依据。

## 六、分批实施计划

### 批次 0：环境准备（1-2 天）

**目标：** 确认技术栈兼容性、建立基础设施

**任务清单：**

- [ ] 安装依赖：`@nestjs/jwt`
- [ ] 创建模块目录结构：`libs/auth`、`libs/permission`
- [ ] 创建 BigInt 工具函数：`parseId`、`formatId`
- [ ] 创建基础 DTO：`IdParamDto`、`IdsBodyDto`
- [ ] 创建枚举：`Mode`、`DataScope`
- [ ] 创建类型定义：`UserPrincipal`、`PermissionMetadata`、`ResolvedDataScope`
- [ ] 验证 JWT 配置：密钥、issuer、audience、TTL

**交付物：**

- 模块骨架代码
- 工具函数单元测试
- JWT 配置 ADR 文档

### 批次 1：数据库迁移（2-3 天）

**目标：** 完成数据模型变更和数据迁移

**任务清单：**

- [ ] 编写 Prisma schema：`Permission`、`RolePermission` 模型
- [ ] 给 `User` 表增加 `permissionVersion` 字段
- [ ] 给 `Permission` 表增加 `menuId` 唯一约束
- [ ] 给 `Menu` 表增加反向关系 `permission`
- [ ] 统计现有数据：菜单 `perms` 去重、重复编码、孤儿关联
- [ ] 编写迁移脚本：从 `Menu.perms` 生成 `Permission` 记录
- [ ] 编写回滚脚本
- [ ] 测试环境验证迁移

**交付物：**

- Prisma migration 文件
- 数据迁移脚本
- 迁移前后数据对账报告
- 回滚手册

### 批次 2：认证模块（3-4 天）

**目标：** 实现完整的认证功能

**任务清单：**

- [ ] 实现 `TokenService`：JWT 签发、验证
- [ ] 实现 `AuthService`：登录、登出、刷新 Token
- [ ] 实现 `AuthController`：`/login`、`/logout`、`/refresh`、`/me`
- [ ] 实现 `@Public()` 装饰器
- [ ] 实现 `@CurrentUser()` 装饰器
- [ ] 实现 `AuthGuard`
- [ ] 配置全局 Guard：`APP_GUARD`
- [ ] 编写 e2e 测试：登录成功/失败、Token 过期、停用用户

**交付物：**

- `libs/auth` 完整代码
- 认证 API 文档
- e2e 测试（覆盖率 > 80%）

### 批次 3：权限模块核心（3-4 天）

**目标：** 实现权限判定和缓存

**任务清单：**

- [ ] 实现 `@Permission()` 装饰器
- [ ] 实现 `PermissionService`：权限解析、缓存、失效
- [ ] 实现 `PermissionGuard`
- [ ] 配置全局 Guard 顺序：`AuthGuard` -> `PermissionGuard`
- [ ] 实现权限缓存：基于 `permissionVersion`
- [ ] 编写单元测试：AND/OR 模式、方法覆盖类
- [ ] 编写 e2e 测试：有权限/无权限/停用角色

**交付物：**

- `libs/permission` 核心代码
- 权限装饰器使用文档
- 单元测试 + e2e 测试

### 批次 4：菜单权限管理（4-5 天）

**目标：** 实现菜单 CRUD 和菜单-权限同步

**任务清单：**

- [ ] 实现 `MenuService`：CRUD、菜单树、权限同步
- [ ] 实现 `MenuController`：菜单管理 API
- [ ] 实现菜单保存事务：同步 `Permission` 表
- [ ] 实现菜单删除保护：权限被引用时不能删除
- [ ] 实现角色菜单授权：同步 `RoleMenu` 和 `RolePermission`
- [ ] 实现角色菜单树查询
- [ ] 编写集成测试：菜单同步、权限冲突、角色授权

**交付物：**

- `MenuService` 完整代码
- 菜单管理 API 文档
- 集成测试

### 批次 5：系统管理模块（5-7 天）

**目标：** 实现用户、角色、部门、职位管理

**任务清单：**

**用户管理：**

- [ ] 实现 `UserService`：CRUD、分配角色、重置密码
- [ ] 实现 `UserController`
- [ ] 应用 `@Permission` 装饰器

**角色管理：**

- [ ] 实现 `RoleService`：CRUD、菜单授权、数据范围设置
- [ ] 实现 `RoleController`

**部门管理：**

- [ ] 实现 `DeptService`：树查询、CRUD、`ancestors` 维护
- [ ] 实现 `DeptController`

**职位管理：**

- [ ] 实现 `PostService`：CRUD、用户分配
- [ ] 实现 `PostController`

**所有 Service：**

- [ ] 实现 DTO Mapper：BigInt 转换
- [ ] 实现分页查询
- [ ] 实现事务保护
- [ ] 编写集成测试

**交付物：**

- 系统管理模块完整代码
- API 文档
- 集成测试

### 批次 6：数据范围引擎（4-5 天）

**目标：** 实现数据权限控制

**任务清单：**

- [ ] 实现 `DataScopeService`：范围解析、where 条件生成
- [ ] 实现部门子树查询：基于 `ancestors` 或递归 CTE
- [ ] 实现多角色范围合并：并集策略
- [ ] 实现资源策略注册表：`user -> deptId/userId`
- [ ] 接入用户列表查询
- [ ] 接入部门列表查询
- [ ] 接入操作日志查询
- [ ] 编写单元测试：五种范围模式
- [ ] 编写集成测试：越权访问拒绝

**交付物：**

- `DataScopeService` 完整代码
- 资源策略配置文档
- 单元测试 + 集成测试

### 批次 7：权限种子和运维工具（2-3 天）

**目标：** 权限目录管理和诊断工具

**任务清单：**

- [ ] 创建权限种子文件：`permissions.seed.ts`
- [ ] 实现权限同步命令：`npm run permission:sync`
- [ ] 实现权限对账报告：未绑定权限、孤儿权限、重复编码
- [ ] 实现权限诊断接口：`/system/permission/check`
- [ ] 实现缓存管理：手动失效、批量失效
- [ ] 编写初始化脚本：超级管理员创建
- [ ] 编写数据库备份/恢复脚本

**交付物：**

- 权限种子文件
- CLI 命令
- 运维工具文档

### 批次 8：审计和监控（2-3 天）

**目标：** 审计日志和权限变更追踪

**任务清单：**

- [ ] 实现操作日志：用户操作、权限判定、授权变更
- [ ] 实现审计拦截器：自动记录敏感操作
- [ ] 实现登录日志：登录/登出、IP 记录
- [ ] 实现权限变更审计：角色授权、用户分配角色
- [ ] 实现审计查询接口
- [ ] 配置日志脱敏：密码、Token
- [ ] 编写审计查询测试

**交付物：**

- 审计模块代码
- 审计日志查询 API
- 审计策略文档

### 批次 9：前端集成和 E2E 测试（3-4 天）

**目标：** 前后端联调和完整流程测试

**任务清单：**

- [ ] 前端菜单管理页面联调
- [ ] 前端角色管理页面联调
- [ ] 前端用户管理页面联调
- [ ] 前端权限按钮显示联调
- [ ] 编写完整业务流程 E2E 测试
- [ ] 编写并发测试：角色授权、权限缓存
- [ ] 编写越权测试：IDOR、垂直越权、水平越权
- [ ] 性能测试：权限查询、缓存命中率

**交付物：**

- 前端集成测试报告
- E2E 测试套件
- 性能测试报告

### 批次 10：上线准备和加固（2-3 天）

**目标：** 生产环境准备和安全加固

**任务清单：**

- [ ] 生产环境配置检查：JWT 密钥、数据库连接
- [ ] 安全扫描：依赖漏洞、SQL 注入、XSS
- [ ] 性能优化：索引、查询优化、缓存策略
- [ ] 监控告警：失败登录、权限拒绝、异常访问
- [ ] 灰度发布计划
- [ ] 回滚演练
- [ ] 上线检查清单
- [ ] 生产环境备份

**交付物：**

- 安全扫描报告
- 性能优化报告
- 上线检查清单
- 回滚方案

## 七、代码质量规范

### 7.1 Service 分层规范

**Controller 层：**

- 只负责路由、DTO 校验、当前用户获取
- 不写 Prisma 查询
- 不处理 BigInt 转换（由 DTO Transformer 处理）

**Application Service 层：**

- 编排一个用例（如 `updateMenu`、`assignRoleMenus`）
- 调用领域规则、启动事务、发布结果
- 方法长度原则上不超过 50 行

**Domain Service/Policy 层：**

- 可复用规则（如 `PermissionEvaluator`、`DataScopeResolver`）
- 不依赖 HTTP request
- 纯函数优先

**Repository/Query 层：**

- Prisma 读写和固定查询
- 不决定权限逻辑

**Mapper 层：**

- Prisma model <-> DTO
- 集中处理 BigInt、Date、敏感字段

### 7.2 查询规范

**列表查询四层结构：**

```ts
async list(query: UserListQuery, actor: UserPrincipal) {
  // 1. parseQuery：DTO 转内部 query，完成校验
  const input = parseUserListQuery(query);

  // 2. buildWhere：组合租户/状态/关键字/数据范围
  const scope = await this.dataScope.resolve(actor, USER_RESOURCE);
  const where = andWhere(buildUserFilters(input), scope.where);

  // 3. buildOrderBy：白名单映射
  const orderBy = USER_ORDER_BY[input.orderBy];

  // 4. findPage：执行查询
  const [rows, total] = await this.prisma.$transaction([
    this.prisma.user.findMany({
      where,
      orderBy,
      select: USER_LIST_SELECT,
      skip: input.skip,
      take: input.take
    }),
    this.prisma.user.count({ where })
  ]);

  return toPageDto(UserListItemDto, {
    items: rows,
    meta: makePageMeta(input, total)
  });
}
```

**查询复杂度门槛：**

- 单个 service 方法不超过 50 行
- 超过 100 行必须说明为何不能拆分
- `select/include/where` 需要命名常量
- 禁止在循环内逐个查询（N+1）

### 7.3 事务规范

**事务只包含数据库操作：**

```ts
// ✅ 正确
return await this.prisma.$transaction(async (tx) => {
  const menu = await tx.menu.update(...);
  await this.syncPermission(tx, menu);
  return menu;
}, { timeout: 10_000 });
// 事务外失效缓存
await this.cacheManager.del(...);

// ❌ 错误：事务内调用外部服务
return await this.prisma.$transaction(async (tx) => {
  const menu = await tx.menu.update(...);
  await this.cacheManager.del(...);  // 不要在事务内调用缓存
  await this.httpService.post(...);  // 不要在事务内调用 HTTP
  return menu;
});
```

**事务配置：**

- 设置合理 `timeout/maxWait`
- 必要时使用 `Serializable` 隔离级别
- 捕获唯一约束冲突，转换为 409

### 7.4 测试规范

**必需测试：**

**单元测试：**

- 装饰器规范化：字符串、数组、AND/OR、类/方法覆盖
- BigInt 边界：超大 ID、非法字符串、响应转换
- 权限判定：AND/OR、停用角色、用户停用

**集成测试：**

- 守卫：匿名 401、公开放行、有效身份、缺权限 403
- 认证：密码正确/错误、停用用户、Token 过期
- 数据范围：五种模式、多角色并集、越权拒绝

**E2E 测试：**

- 完整业务流程：菜单管理、角色授权、用户分配
- 并发场景：角色权限变更、缓存失效
- 越权测试：IDOR、垂直越权、水平越权

### 7.5 代码评审清单

- [ ] 新接口有 `@Public` 或 `@Permission` 声明
- [ ] 所有外部 ID 是字符串 DTO，进入 service 前转为 BigInt
- [ ] 数据范围应用到列表、详情、更新、删除
- [ ] 不直接返回 Prisma entity
- [ ] 没有重复权限判断、循环依赖、过长事务
- [ ] 有数据库唯一/外键约束作为兜底
- [ ] 敏感操作有审计日志

## 八、估算与时间线

### 时间估算（单人）

| 批次     | 任务           | 估算天数     |
| -------- | -------------- | ------------ |
| 0        | 环境准备       | 1-2 天       |
| 1        | 数据库迁移     | 2-3 天       |
| 2        | 认证模块       | 3-4 天       |
| 3        | 权限模块核心   | 3-4 天       |
| 4        | 菜单权限管理   | 4-5 天       |
| 5        | 系统管理模块   | 5-7 天       |
| 6        | 数据范围引擎   | 4-5 天       |
| 7        | 权限种子和工具 | 2-3 天       |
| 8        | 审计和监控     | 2-3 天       |
| 9        | 前端集成 E2E   | 3-4 天       |
| 10       | 上线准备加固   | 2-3 天       |
| **总计** |                | **31-43 天** |

### 里程碑

- **第 1 周末**：数据库迁移完成，认证模块可用
- **第 2 周末**：权限判定核心完成，可保护接口
- **第 3 周末**：菜单权限管理完成，可通过界面授权
- **第 4 周末**：系统管理模块完成，基本可用
- **第 5 周末**：数据范围完成，权限控制完整
- **第 6 周末**：审计和工具完成，前端集成
- **第 7 周末**：测试和加固，准备上线

### 依赖与风险

**关键依赖：**

1. 数据库现状盘点和迁移方案确认（批次 1）
2. 前端 ID 类型兼容性确认（批次 0）
3. JWT 策略和刷新 Token 方案确认（批次 2）

**风险点：**

1. 数据迁移中的编码重复和冲突（需人工决策）
2. 前端树组件不支持字符串 ID（需前端改造）
3. 权限缓存失效不及时（需监控和测试）

## 九、验收标准

### 功能完整性

- [ ] 所有受保护端点有明确的权限声明
- [ ] 后端权限检查独立于前端菜单
- [ ] 数据库权限点唯一且可审计
- [ ] `@Permission` 的 AND/OR 语义一致
- [ ] 认证拒绝返回 401，权限拒绝返回 403

### 数据权限

- [ ] 五种数据范围统一编码
- [ ] 历史值完成逐条映射
- [ ] 每个受控查询在 SQL 条件层执行范围限制
- [ ] 详情、更新、删除都应用数据范围

### 缓存与一致性

- [ ] 用户/角色/权限停用或授权变更立即生效（或明确 TTL 内）
- [ ] 权限缓存基于版本号
- [ ] 缓存故障时降级策略明确

### BigInt 处理

- [ ] API 入参/出参全程十进制字符串
- [ ] 内部 Prisma 查询使用 BigInt
- [ ] 大 ID 在请求、响应、JWT、缓存往返无精度损失

### 代码质量

- [ ] Service 主流程短小清晰
- [ ] 超过 100 行的方法有评审理由
- [ ] 查询/事务/mapper/policy 职责清楚
- [ ] 没有循环内数据库查询
- [ ] 没有复制粘贴的权限规则

### 测试覆盖

- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试覆盖核心流程
- [ ] E2E 测试覆盖完整业务场景
- [ ] 越权测试全部通过

### 安全性

- [ ] 依赖漏洞扫描通过
- [ ] SQL 注入测试通过
- [ ] XSS 测试通过
- [ ] 敏感操作有审计日志
- [ ] 生产密钥独立配置

---

## 附录 A：权限编码规范

### 命名规则

```text
<module>:<resource>:<action>

module:   系统模块（system, business, report）
resource: 资源名称（user, role, dept, menu）
action:   操作动作（view, add, edit, remove, resetPwd, assign）
```

### 标准动作

| 动作       | 说明                 |
| ---------- | -------------------- |
| `view`     | 查看/查询            |
| `add`      | 新增                 |
| `edit`     | 编辑                 |
| `remove`   | 删除                 |
| `export`   | 导出                 |
| `import`   | 导入                 |
| `resetPwd` | 重置密码             |
| `assign`   | 分配（角色、部门等） |
| `scope`    | 数据范围设置         |

### 示例

```ts
// 用户管理
'system:user:view'; // 查看用户
'system:user:add'; // 新增用户
'system:user:edit'; // 编辑用户
'system:user:remove'; // 删除用户
'system:user:resetPwd'; // 重置密码
'system:user:assign'; // 分配角色

// 角色管理
'system:role:view';
'system:role:add';
'system:role:edit';
'system:role:remove';
'system:role:assign'; // 菜单授权
'system:role:scope'; // 数据范围

// 菜单管理
'system:menu:view';
'system:menu:add';
'system:menu:edit';
'system:menu:remove';

// 部门管理
'system:dept:view';
'system:dept:add';
'system:dept:edit';
'system:dept:remove';
```

## 附录 B：API 清单

### 认证 API

| 方法 | 路径                | 权限 | 说明             |
| ---- | ------------------- | ---- | ---------------- |
| POST | `/auth/login`       | 公开 | 登录             |
| POST | `/auth/logout`      | 认证 | 登出             |
| POST | `/auth/refresh`     | 公开 | 刷新 Token       |
| GET  | `/auth/me`          | 认证 | 当前用户信息     |
| GET  | `/auth/permissions` | 认证 | 当前用户权限列表 |

### 用户管理 API

| 方法   | 路径                         | 权限                   | 说明     |
| ------ | ---------------------------- | ---------------------- | -------- |
| GET    | `/system/user`               | `system:user:view`     | 用户列表 |
| GET    | `/system/user/:id`           | `system:user:view`     | 用户详情 |
| POST   | `/system/user`               | `system:user:add`      | 新增用户 |
| PUT    | `/system/user/:id`           | `system:user:edit`     | 编辑用户 |
| DELETE | `/system/user/:id`           | `system:user:remove`   | 删除用户 |
| PUT    | `/system/user/:id/reset-pwd` | `system:user:resetPwd` | 重置密码 |
| PUT    | `/system/user/:id/roles`     | `system:user:assign`   | 分配角色 |

### 角色管理 API

| 方法   | 路径                          | 权限                 | 说明     |
| ------ | ----------------------------- | -------------------- | -------- |
| GET    | `/system/role`                | `system:role:view`   | 角色列表 |
| GET    | `/system/role/:id`            | `system:role:view`   | 角色详情 |
| POST   | `/system/role`                | `system:role:add`    | 新增角色 |
| PUT    | `/system/role/:id`            | `system:role:edit`   | 编辑角色 |
| DELETE | `/system/role/:id`            | `system:role:remove` | 删除角色 |
| PUT    | `/system/role/:id/menus`      | `system:role:assign` | 菜单授权 |
| PUT    | `/system/role/:id/data-scope` | `system:role:scope`  | 数据范围 |

### 菜单管理 API

| 方法   | 路径                        | 权限                 | 说明       |
| ------ | --------------------------- | -------------------- | ---------- |
| GET    | `/system/menu/tree`         | `system:menu:view`   | 菜单树     |
| GET    | `/system/menu/:id`          | `system:menu:view`   | 菜单详情   |
| POST   | `/system/menu`              | `system:menu:add`    | 新增菜单   |
| PUT    | `/system/menu/:id`          | `system:menu:edit`   | 编辑菜单   |
| DELETE | `/system/menu/:id`          | `system:menu:remove` | 删除菜单   |
| GET    | `/system/menu/role/:roleId` | `system:role:view`   | 角色菜单树 |

### 部门管理 API

| 方法   | 路径                | 权限                 | 说明     |
| ------ | ------------------- | -------------------- | -------- |
| GET    | `/system/dept/tree` | `system:dept:view`   | 部门树   |
| GET    | `/system/dept/:id`  | `system:dept:view`   | 部门详情 |
| POST   | `/system/dept`      | `system:dept:add`    | 新增部门 |
| PUT    | `/system/dept/:id`  | `system:dept:edit`   | 编辑部门 |
| DELETE | `/system/dept/:id`  | `system:dept:remove` | 删除部门 |

---

**文档版本：** v2.0
**最后更新：** 2025-01-17
**适用技术栈：** NestJS 12 + Fastify + Prisma 7 + PostgreSQL

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
  "menuId": "101",
  "parentId": "20",
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

与前端实际接口对齐，菜单新增使用 `POST /system/menu`，菜单更新使用 `PUT /system/menu`，每次只保存单个菜单 DTO；角色新增/更新沿用角色 DTO 中的一维 `menuIds`。路径可按 gateway API 前缀调整。菜单保存由一个应用服务完成：

1. 校验当前操作者具有 `system:menu:add` 或 `system:menu:edit`，并校验父菜单存在、不能形成环、菜单类型与路由字段匹配。
2. 在一个 Prisma transaction 中创建/更新单条 `Menu`。`M/C/F` 字段规则分别校验：F 不允许路由和组件，M/C 的路由字段按项目规则校验。
3. 若 `menuType` 为 C/F 且 `perms` 非空，先按 `Permission.menuId=menu.menuId` 查找当前绑定，再检查目标 `code` 是否已被其它权限占用；无冲突时更新当前权限的 `code/name/status`，没有当前绑定时才按 `code` 创建。若编码已绑定到另一个菜单节点，返回 409；更新编码涉及已有角色授权时，应显式迁移 `RolePermission` 关系并记录审计。
4. 若记录从 C/F 改为 M，或清空 `perms`，解除 `Permission.menuId`。如权限仍被 `RolePermission` 引用，不物理删除权限，停用并要求处理角色授权。
5. 提交事务后失效菜单/权限缓存，并记录操作者和变更前后差异。

示意代码：

```ts
await prisma.$transaction(
  async (tx) => {
    const menu = await upsertMenu(tx, input);
    if ((menu.menuType !== 'C' && menu.menuType !== 'F') || !menu.perms) return;

    const conflict = await tx.permission.findFirst({
      where: { code: menu.perms, menuId: { not: menu.menuId } },
      select: { permissionId: true },
    });
    if (conflict) throw new ConflictException('权限编码已绑定其它菜单');

    const current = await tx.permission.findUnique({ where: { menuId: menu.menuId } });
    if (current) {
      await tx.permission.update({
        where: { permissionId: current.permissionId },
        data: { code: menu.perms, name: menu.menuName, status: menu.status },
      });
    } else {
      await tx.permission.create({
        data: { ...mapPermissionFromMenu(menu), menuId: menu.menuId },
      });
    }
  },
  { isolationLevel: 'Serializable', timeout: 10_000 },
);
```

示意代码需要按项目生成的 Prisma 类型调整。生产实现还要捕获唯一约束冲突（例如并发保存相同 `perms`）并返回稳定的 409；事务只执行数据库操作，日志/缓存失效放在提交成功之后。权限编码变更会影响角色授权，必须显式迁移并审计，不可静默改写。

### 角色页面如何使用

角色编辑页使用树选择接口返回的菜单树和 `checkedKeys` 初始化勾选。保存角色时，前端只提交表单字段及选中的 `menuIds` 一维数组：

```json
{
  "roleId": "1",
  "roleName": "用户管理员",
  "roleKey": "user-admin",
  "menuIds": ["10", "20", "101", "102"]
}
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
  ALL = '1', // 全部数据
  DEPT = '2', // 本部门
  DEPT_AND_CHILD = '3', // 本部门及以下
  SELF = '4', // 仅本人
  CUSTOM = '5', // RoleDept 指定部门
}
```

把 `Role.dataScope` 注释、校验与数据库约束统一到以上值。迁移前先统计现有角色数据；旧注释中的 `2..5` 含义与目标值冲突，必须由业务负责人根据角色实际授权逐条映射，不能只改注释或直接改解释。旧值 `6` 没有目标等价项，应作为需人工决策的迁移数据，不能静默转换。

多角色用户范围按**并集（取最大可见范围）**合并，且只考虑启用且未删除角色：任意角色 `ALL` 则为全部；自定义部门集合合并；部门范围、子树范围、本人范围合并成 OR 条件。若产品要求更严格的交集，应作为显式业务策略另行定义，不能在各查询中自行决定。无有效角色或无有效范围时默认拒绝/空结果，不默认全量。

查询条件生成器接受可信的 `UserPrincipal`、角色范围和由服务端配置的业务归属字段；不能允许请求传入任意列名。范例：

```ts
function buildUserWhere(principal: UserPrincipal, scope: ResolvedDataScope) {
  switch (scope.kind) {
    case DataScope.ALL:
      return {};
    case DataScope.DEPT:
      return { deptId: principal.deptId ?? -1n };
    case DataScope.DEPT_AND_CHILD:
      return { deptId: { in: scope.deptIds } };
    case DataScope.SELF:
      return { userId: principal.userId };
    case DataScope.CUSTOM:
      return { deptId: { in: scope.deptIds } };
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

## 认证与守卫实现细节

### JWT 配置与登录流程

`JwtModule` 只从配置注入密钥和校验参数，禁止把密钥写入 `default.yaml` 或代码仓库：

```ts
JwtModule.registerAsync({
  inject: [authConfig.KEY],
  useFactory: (config: AuthConfig) => ({
    secret: config.accessTokenSecret,
    signOptions: {
      issuer: config.issuer,
      audience: config.audience,
      expiresIn: config.accessTokenTtl,
    },
  }),
});
```

登录流程固定为：校验 DTO -> 按用户名查询用户 -> 对密码执行哈希验证（不存在用户时执行 dummy hash 验证）-> 检查 `status/delFlag` -> 创建 session/jti -> 用 `JwtService.signAsync` 签发 access token -> 更新登录 IP/时间并写登录审计。登录失败统一返回，不区分“用户名不存在”和“密码错误”。

JWT payload 只放 `sub`（用户 ID）、`sid`（会话 ID）、`jti`、`iat/exp` 和版本号；不放完整角色/权限列表。`AuthGuard` 验签后再从数据库/缓存加载主体，检查用户有效、session 未撤销、权限版本仍匹配。若采用 refresh token，数据库只保存其哈希，明文只在响应中出现一次；每次刷新废弃旧 token 并创建新 token，检测到旧 token 重放时撤销该 session 家族。

### `@Permission` 规范化和 guard 算法

装饰器在编译/启动阶段只保存规范化 metadata：

```ts
const PERMISSION_KEY = Symbol('permission');

export const Permission = (input: PermissionValue | PermissionOptions) => {
  const options =
    typeof input === 'string'
      ? { value: [input], mode: Mode.AND }
      : {
          value: typeof input.value === 'string' ? [input.value] : [...input.value],
          mode: input.mode ?? Mode.AND,
          role: input.role,
        };
  validatePermissionMetadata(options);
  return SetMetadata(PERMISSION_KEY, options);
};
```

Guard 执行步骤：

1. 读取 `getAllAndOverride(PERMISSION_KEY, [context.getHandler(), context.getClass()])`；方法 metadata 覆盖类 metadata。
2. 没有 metadata 时只要求 `request.user`，不自动放行匿名请求。
3. 取主体的有效 `roleKeys` 和去重后的 `permissionCodes`；不直接信任 JWT 中的角色/权限 claim。
4. 先计算 `role` 兜底，再按 AND/OR 计算权限表达式；成功返回 true，失败抛出 403，并写拒绝审计。
5. 不在 guard 中查询业务数据、不计算部门范围、不修改请求输入；数据范围由 service/query policy 执行。

权限服务建议把一次请求的授权材料定义为不可变对象：

```ts
export interface AuthorizationSnapshot {
  userId: bigint;
  deptId: bigint | null;
  roleKeys: ReadonlySet<string>;
  permissionCodes: ReadonlySet<string>;
  version: number;
}
```

快照来自启用用户 -> 启用角色 -> `RolePermission` -> 启用权限的链路，所有关联都要过滤 `delFlag/status`。超级管理员如有绕过策略，必须是配置明确的角色键判断，并在审计中标记；不能用前端传值或通配符实现。

### 当前用户与公开接口

只允许极少数端点使用 `@Public()`：登录、刷新 token（仍需 refresh token）、健康检查、必要的密钥协商/验证码接口。Swagger、菜单查询、业务 API 默认都是受保护的。`CurrentUser()` 返回只读主体，不返回 Prisma `User` 实体，避免 controller 修改持久化对象或意外序列化密码字段。

### 错误和日志

- 401：缺少 Bearer、签名错误、过期、撤销、用户不存在/停用。
- 403：身份有效但没有权限，或数据范围没有匹配记录。
- 409：角色/权限编码/用户名等唯一约束冲突，权限编码绑定到其它菜单节点。
- 422：DTO 字段、menuType 与字段组合、dataScope 值非法。

错误体只返回稳定业务码和通用消息；日志可以记录 userId、route、permission code、判定结果、traceId 和耗时，不记录 token、密码、refresh token 或未脱敏的敏感请求参数。

## 缓存与一致性

第一版可先不缓存权限结果，确保行为正确后再优化。需要缓存时以 `userId + permissionVersion`（或角色授权版本组合）作为键，并设置短 TTL；分配/移除角色、角色权限变化、停用角色、用户停用时递增版本或主动失效。敏感管理操作应提供主动失效并在存储不可用时按安全策略拒绝或实时回源，不得继续使用无限期旧权限。

JWT 内不应承载长期权威权限快照。短期令牌只承载身份/会话标识；高风险接口可查询 token/session 撤销状态。退出登录、密码重置、账号禁用需有明确的令牌失效策略。

## 管理后台领域功能

### 用户

- 列表/详情/新增/编辑/停用/删除（优先逻辑删除）、重置密码、修改本人密码、分配部门、分配角色、分配职位、导入/导出（如启用）。
- 用户名唯一；邮箱/手机号按产品规则唯一；密码只存 `PasswordHashService` 输出。响应 DTO 永不返回 `password`。
- 普通管理员不能给用户分配自己无权管理的角色，不能更改/删除最后一个有效超级管理员。
- 写入时校验部门、角色、职位有效且未删除；用户停用或角色变更后令会话/权限版本失效。

### 部门

- 部门树查询、详情、新增/编辑、停用、删除；部门移动时校验不能移动到自身后代，并在事务中重算受影响子树 `ancestors`。
- 被用户、子部门、角色自定义范围引用时禁止物理删除；停用后阻止新分配，并定义已有数据和已有用户的处理方式。
- 部门列表/详情/更新/删除均需应用数据范围，不能只在前端隐藏树节点。

### 角色

- 列表/详情/新增/编辑/停用/删除、角色用户管理、菜单权限分配、数据范围设置、角色权限变更审计。
- `roleKey` 全局唯一、创建后限制修改；系统内置角色保护；最后管理员保护。
- 角色保存 DTO 接受 `menuIds: ID[]` 和 `menuCheckStrictly`。同一事务写 `RoleMenu` 与 `RolePermission`，服务端验证所有 ID 都存在、启用并可由当前操作者管理。
- 多角色功能权限取并集；任一有效角色授予某 permission 即可访问。数据范围也按本文定义取并集，角色禁用立即从两种计算中排除。

### 菜单与职位

- 菜单按 M/C/F 管理。列表返回扁平记录，前端按 `menuId/parentId` 展示；菜单单条保存传一个 `Menu` DTO。M 不允许 `perms`，C/F 的 `perms` 可选但如填写必须唯一；F 不能有路由/组件，也不能成为其它菜单的父节点。
- C/F `perms` 变更必须与 `Permission` 同事务同步；不能从菜单删除操作中静默移除角色已授予的权限。角色菜单树只包含启用节点并返回 `checkedKeys`。
- 职位 CRUD、启停、删除保护；用户与职位维持 `UserPost` 多对多。职位是组织/岗位信息，不作为默认授权主体；若将来职位授予权限，应另行定义明确的授权来源和优先级，第一版不要混入 RBAC。

## 可维护性与架构约束

本系统的质量目标是让授权规则容易被定位、修改和验证。代码不以“功能能跑”为完成标准；每个模块都要有单一职责、稳定边界和能说明行为的测试。以下规则作为代码评审清单。

### 只保留必要的抽象

- `AuthGuard` 只负责身份建立，`PermissionGuard` 只负责功能权限，`DataScopeService` 只负责数据范围；不要写一个同时解析 JWT、查询菜单、拼 Prisma where 的“万能权限服务”。
- Repository 只负责持久化和可复用查询；角色授权编排、菜单权限同步、最后管理员保护放在领域 service；controller 只做 DTO、当前用户和 service 调用。
- 只有至少两个真实调用点且语义一致时才抽公共 helper。不要为每张表创建同构的十层 wrapper，也不要把简单的 Prisma `findUnique` 包成无法搜索的泛型 DAO。
- 前端/HTTP 字段、领域对象、Prisma model 分开映射。避免把 Prisma 返回对象直接穿透 controller；mapper 应明确列出字段，防止未来新增 `password`、内部状态或 BigInt 泄漏。
- DTO 只做输入格式和业务约束；领域 service 做授权、状态、关联和不变量；数据库约束做最后一道并发/唯一性保护。三层职责不能互相替代。

### 权限规则集中化

- 权限 code 定义在受控目录/种子中，controller 装饰器只引用字符串；不要在多个 service 手写同一权限判断或用菜单名称推导权限。
- `Mode`、角色兜底、用户/角色有效性、权限版本和数据范围合并各自只有一个实现入口；每个入口有单元测试，业务端点只调用它。
- 管理端点的 permission code 按资源/动作命名，统一使用 `view/add/edit/remove/resetPwd/assign/scope` 等词汇。不能出现同一动作同时叫 `delete` 和 `remove`。
- 复杂提权操作（角色授权、数据范围、超级管理员、权限编码修改）使用显式 service 方法和审计事件，不通过通用 `update(data)` 逃避规则。

### 查询与事务边界

- 事务只包含必要的 Prisma 读写，事务外准备 DTO、计算差异、发送日志/缓存失效事件；避免在 interactive transaction 中调用 HTTP、Redis、第三方服务或长时间计算。
- 菜单保存、角色授权、用户角色/职位分配、部门移动必须使用明确的事务方法，设置合理 `timeout/maxWait`，并捕获唯一约束冲突转换为稳定 409。
- 数据范围条件由资源策略生成后与业务条件以 AND 合并；service 不允许接收一个可能覆盖安全 where 的任意 `where` 对象。更新/删除以带范围的 `updateMany/deleteMany` 或等价原子查询为主。
- 所有列表都使用白名单排序字段和分页上限；禁止把用户传入的列名、表名或 SQL 片段直接传入 Prisma/raw SQL。
- 读取角色授权快照时只 select 所需字段；不要在每个 controller 重复 include 全部用户、角色、菜单和部门关系。

### Service 与查询代码规范

“实现功能”不等于把所有步骤塞进一个方法。Service 和查询代码必须能在一次阅读中看清主流程；任何单个方法接近几十行并开始同时处理校验、查询、转换、事务、日志和缓存时，应拆成有名字的私有方法或独立领域服务。目标是短小的编排方法，而不是为了凑行数机械切碎代码。

#### Service 分层

- Controller 只负责路由、DTO 校验、当前用户和响应 DTO；不写 Prisma 查询、不拼权限条件、不处理 BigInt 转换细节。
- Application service 编排一个用例，例如 `updateMenu()`、`assignRoleMenus()`、`changePassword()`；它负责调用领域规则、启动事务和发布结果。
- Domain policy/service 负责可复用规则，例如 `PermissionEvaluator`、`DataScopeResolver`、`RoleAssignmentPolicy`、`DepartmentTreePolicy`；不依赖 HTTP request。
- Repository/query helper 负责 Prisma 读写和固定查询形状；不在 repository 内偷偷决定当前用户是否有权限。
- Mapper 负责 Prisma model <-> domain/response DTO；集中处理 BigInt、Date、敏感字段和字段命名。

一个用例的推荐形状：

```ts
async updateMenu(input: UpdateMenuInput, actor: UserPrincipal): Promise<MenuDto> {
  await this.menuPolicy.assertCanEdit(actor, input.menuId);
  const command = this.menuMapper.toCommand(input);

  const menu = await this.prisma.$transaction((tx) =>
    this.menuWriter.updateWithPermission(tx, command),
  );
  await this.afterMenuChanged(menu, actor);
  return this.menuMapper.toDto(menu);
}
```

`menuPolicy`、`menuMapper`、`menuWriter` 各自有明确职责；不要把它们再包进一个难以搜索的万能 `BaseService<T>`。事务方法只接收已经完成格式校验的 command，事务内只做必要的数据库操作。

#### 查询必须拆成四层

列表查询建议固定为四个步骤，并让每一步可单测：

1. `parseQuery()`：把 DTO 转成内部 query，完成 BigInt、分页默认值和枚举校验。
2. `buildWhere()`：组合租户/状态/关键字/数据范围条件；数据范围条件只能由服务端 policy 生成。
3. `buildOrderBy()`：从固定白名单映射到 Prisma `orderBy`，不接受任意字段。
4. `findPage()`：执行 `findMany` 与 `count`，只选择响应需要的字段，再交给 mapper。

```ts
async list(query: UserListQuery, actor: UserPrincipal) {
  const input = parseUserListQuery(query);
  const scope = await this.dataScope.resolve(actor, USER_RESOURCE);
  const where = andWhere(buildUserFilters(input), scope.where);
  const orderBy = USER_ORDER_BY[input.orderBy];

  const [rows, total] = await this.prisma.$transaction([
    this.prisma.user.findMany({ where, orderBy, select: USER_LIST_SELECT, skip: input.skip, take: input.take }),
    this.prisma.user.count({ where }),
  ]);
  return toPageDto(UserListItemDto, { items: rows, meta: makePageMeta(input, total) });
}
```

`USER_LIST_SELECT`、`USER_ORDER_BY`、`buildUserFilters` 和 `andWhere` 是小而有业务名称的模块，不要把整个列表方法复制到部门、角色、职位 service。只有字段和权限语义真正相同的查询才共享 helper；资源专属条件保留在资源模块，防止一个“通用查询器”隐藏安全规则。

#### 查询长度和复杂度门槛

- 单个 service 方法原则上不超过 50 行；超过后先拆分主流程、校验、where、mapper 和副作用。超过 100 行必须在评审中说明为什么不能拆分。
- 单个 Prisma 调用的 `select/include/where` 需要命名常量或 query builder；不要在 controller 或多个 service 复制几十行字段结构。
- 一个方法只编排一个用例；不要把用户新增、角色分配、登录日志、缓存刷新全部放进用户 `create()`。
- 复杂权限逻辑使用命名函数表达意图，例如 `resolveRolePermissionCodes()`、`mergeDataScopes()`、`assertCanManageRole()`，不要堆叠三元表达式和深层 `if`。
- 领域方法返回稳定的 domain result/DTO，不返回 Prisma `PrismaPromise` 让上层继续拼查询；这样事务边界和异常语义可控。
- 减少嵌套层级：早返回非法状态、空结果和无权限情况；避免超过两层的 `if/for` 嵌套。

这些是可维护性门槛而不是机械 lint 规则。评审重点是是否容易定位业务规则、是否能独立测试、是否会因为复制代码造成不同模块行为漂移。

#### 避免 N+1 和重复查询

- 已知关联集合时使用一次 `findMany({ where: { id: { in: ids } } })`，再用 Map 在内存中匹配；不要在循环内逐个 `findUnique`。
- 角色授权保存先批量读取并校验菜单 ID、权限和角色状态，再使用 `deleteMany + createMany` 或经过比较的增量写入；不要每个 checkbox 发一次写请求。
- 列表展示角色/部门/职位时，使用明确的 `select/include` 或聚合查询；禁止在 mapper 中触发数据库查询。
- 需要多次读取的同一快照在一个 service 方法内只加载一次并传递给后续策略；不要让每个 policy 自己重新查用户和角色。
- 使用 Prisma relation filter（`some/is/none`）表达关联筛选；只有确认 Prisma 无法表达且经过参数绑定时才使用 `$queryRaw`。

#### 分页、where 和原生 SQL

- `count` 和 `findMany` 必须使用完全相同的 `where` 对象来源；不要列表过滤了数据范围而总数没有过滤。
- 分页、关键字、状态、部门 ID 等输入都通过 DTO 和 query parser；空字符串不能被隐式转换为 0 或空 ID。
- `orderByColumn` 只能映射到代码中的白名单，例如 `{ userName: { userName: 'asc' } }`；不能把输入直接放入 Prisma object key 或 SQL。
- `where` builder 返回资源专属的 Prisma 类型，不能返回 `any` 或让调用方覆盖 `scopeWhere`。安全范围应与业务条件使用 AND 合并。
- 原生 SQL 只用于递归部门树、复杂报表等确有必要的查询；必须使用 `$queryRaw` 参数化模板，封装在 query module 并有 SQL 集成测试。禁止字符串拼接表名、列名和用户输入。

#### 事务与批量写入

- 新增/更新菜单同步 C/F permission、角色同步菜单和权限、部门移动重算 ancestors 都使用 interactive transaction；明确设置 `timeout/maxWait`，必要时使用 `Serializable`，并处理重试/唯一冲突。
- 事务外先完成 DTO 解析、权限差异计算和无副作用的内存准备；事务内不调用缓存、邮件、HTTP 或日志传输服务。
- 事务成功后再失效缓存和写审计；需要保证可靠投递时使用 outbox/event table，不在事务中直接依赖外部网络。
- 批量数据使用 `createMany/updateMany/deleteMany` 或有限批次，避免数千次单行调用；对必须逐行执行的规则说明原因并限制输入数量。
- 不在同一个事务里既读取整棵组织树又做不相关的用户导入；一个事务只保护一个一致性不变量。

## 分批工作计划

### 可观察性和失败策略

- 权限判定、数据范围计算和授权变更都输出结构化事件：`traceId/userId/roleId/permissionCode/resource/action/result`，ID 先转字符串；不输出 token、密码和敏感业务内容。
- 授权数据缓存故障默认 fail closed 或实时回源，策略在配置中明确；不能无提示使用无限期旧权限。
- 错误映射集中在异常过滤器/业务异常类型，controller 不散落字符串错误消息。记录 Prisma 错误原码用于诊断，但返回稳定业务码。
- 关键变更支持 before/after 差异和操作者；日志/审计写入失败的处理策略（阻断还是告警）按事件风险分级，不在各 service 临时决定。

### 代码评审必查项

- 新接口是否有明确的 `@Public` 或 `@Permission`，是否有匿名旁路和 e2e 覆盖。
- 所有外部 ID 是否是字符串 DTO、进入 service 前是否转为 BigInt、响应是否转换回字符串。
- 是否把数据范围应用到列表、详情、更新、删除、导出和批量操作，而不是只过滤列表。
- 是否直接返回 Prisma entity、是否把隐私字段/内部关系/BigInt 泄漏到 HTTP 或缓存。
- 是否引入了重复权限判断、跨模块循环依赖、无必要的泛型 abstraction、过长 transaction 或隐式角色绕过。
- 是否有数据库唯一/外键/check 约束作为并发兜底，是否有迁移、回滚和审计记录。

以下批次按依赖顺序推进。每批完成后都应保持应用可构建；数据库破坏性迁移必须有备份、回滚方案及数据核对记录。批次可分别合并，但未经前一批验收，不开始依赖其行为的生产切换。

### 批次 0：依赖与接口契约验证

- [ ] 确认是否使用 `@nestjs/authorization`：检查当前包的 API、维护状态、Nest 12 peer dependencies、`@nestjs/authentication` 依赖链以及 Fastify HTTP adapter 集成方式。
- [ ] 建立最小 PoC：一个公开路由、一个带 permission metadata 路由、一个无权限路由；证明全局 guard 顺序、metadata 读取、异常状态码和 Fastify 请求类型可用。
- [ ] 若该包强制引入不需要的认证体系/额外 peer dependency，或 API 无法表达项目语义，则只采用 `@nestjs/jwt`，用 Nest `SetMetadata` + `Reflector` 实现轻量本地 guard；不要为了使用包而引入第二套身份模型。
- [ ] 锁定 `@nestjs/jwt` 与授权包版本，记录兼容矩阵；确定 JWT 算法、issuer、audience、访问令牌时长、refresh 策略、密钥来源。
- [ ] 确认前端契约：菜单单条 `Menu` DTO + `perms`，角色 DTO + `menuIds`、`menuCheckStrictly`；固定 ID 使用十进制字符串，避免 JavaScript Number 精度风险。
- [ ] 确认前端 ID 类型与控件兼容性：菜单/角色/部门/职位 ID、`parentId`、`menuIds`、树组件 key 全部支持 string；API 入出参始终 string，不得通过 `Number(id)` 转换。
- **交付物**：依赖决策记录、认证/权限 ADR、接口契约样例、Guard PoC 测试。
- **验收**：不接数据库即可演示公开/匿名/有权限三类请求的预期结果；依赖安装不产生未解决 peer dependency。

### 批次 1：数据模型和迁移基线

- [ ] 增加 `Permission`、`RolePermission` 与必要关系：`Permission.code @unique`、`Permission.menuId @unique?` 指向一个 C/F 菜单节点；`RolePermission` 复合主键。给 `Role.roleKey` 加唯一约束前先检查重复数据。
- [ ] 为角色增加权限版本字段或定义基于用户授权版本的可靠失效机制；为 refresh session 设计独立表（如 `AuthSession`，保存 refresh token 哈希、用户、过期、撤销和轮换信息）。
- [ ] 建立共用 `parseId/formatId` 和 BigInt DTO 约定；核查 Prisma ID 到响应 DTO、JWT subject、Redis cache key、审计日志的所有边界。
- [ ] 统一状态编码，给 `dataScope` 建立类型约束；评估 PostgreSQL CHECK 与 Prisma schema 表达能力，必要时使用可审查 SQL migration。
- [ ] 统计用户/角色/部门/菜单/职位孤儿关联、重复用户名/roleKey/perms、非法状态、无效 parentId、ancestors 异常及旧 `dataScope` 值。
- [ ] 因当前仓库未见 migration 基线，先确认环境数据库状态和部署策略，建立可重复的 Prisma migration 基线；不得在不清楚现有库状态时直接 reset 或覆盖数据。
- [ ] 编写升级与回滚脚本；旧 `dataScope` 值按角色清单映射，旧值 6 与非法值必须人工裁定。
- **交付物**：Prisma schema、migration SQL、数据盘点报告、映射表、回滚手册。
- **验收**：空库可从头 migrate；脱敏现存库升级后行数/关联数核对通过；唯一约束冲突已处理。

### 批次 2：认证基础与账户安全

- [ ] `AuthModule` 集成 `JwtModule.registerAsync`，密钥/issuer/audience/TTL 从经过校验的配置域读取，生产禁止使用默认密钥。
- [ ] 定义 `UserPrincipal`、Fastify request augmentation、`CurrentUser()` 参数装饰器与 `Public()` 元数据；主体从数据库有效账户加载，不信任客户端提交角色或权限。
- [ ] 实现登录 DTO、用户名查找、密码校验、失败统一响应、账号状态检查、登录限流/审计、最近登录字段更新。复用 `PasswordHashService`，确认密码不存在时使用固定成本的 dummy hash 验证以降低账号枚举时序差异。
- [ ] 实现 access token 校验和 401 标准异常；token claims 只包含必要身份与 session/version 标识，不包含长期权威权限快照。
- [ ] 实现 refresh token 哈希存储、轮换、重放检测、登出撤销、密码重置/用户停用后的会话撤销；若产品确定不需要 refresh token，则明确采用重新登录策略，不留半成品端点。
- [ ] 定义 CORS/cookie 或 Authorization Bearer 的前端传输方式、CSRF 策略、XSS 暴露风险和 Swagger bearer 配置。
- **交付物**：登录/刷新/登出 API、AuthGuard、公开路由标记、会话模型、认证审计。
- **验收**：正确凭证成功；错误凭证、停用/删除用户、过期/伪造/撤销 token 被拒绝；登出与密码重置按策略立即失效。

### 批次 3：RBAC 判定核心

- [ ] 在 `libs/permission` 实现 `Mode`、`@Permission(string | options)`、`@Roles()`（如需要）和 metadata 类型校验；空值/错误模式在测试失败关闭。
- [ ] 固定规则：字符串等价单项 AND；数组默认 AND；`Mode.OR` 任一命中；`role` 是“有效角色 OR 权限表达式”的兜底，不绕过认证及数据范围。
- [ ] 实现 `PermissionService`：查询用户有效 `UserRole -> RolePermission -> Permission`，过滤停用/删除用户、角色、权限，BigInt ID 在边界统一处理。
- [ ] 实现 `PermissionGuard` 与 `@nestjs/authorization` 适配层（若批次 0 证明适用）；项目 `@Permission` 必须是唯一业务装饰器 API。
- [ ] 在网关模块注册全局 AuthGuard、PermissionGuard，明确顺序和 DI scope；`@Public` 跳过认证，普通无 metadata 路由仍需登录。先以审计/测试列出所有现存 API，明确哪些公开、哪些需权限，防止漏标。
- [ ] 区分 401 未认证、403 权限不足；错误响应不泄露用户拥有哪些权限。
- **交付物**：权限装饰器、守卫、权限服务、权限解析类型、控制器接入指南。
- **验收**：AND/OR/role fallback、controller/method override、匿名访问、模块 DI、Fastify e2e 全覆盖。

### 批次 4：菜单权限目录与角色授权

- [ ] 菜单 `POST/PUT` DTO 保持前端现有字段，不要求权限主键。保存 M/C/F 节点和同步 `Permission` 必须同一事务。
- [ ] 菜单保存策略：M 清空/拒绝 `perms`；C/F 有 `perms` 时 upsert 权限目录并绑定 `menuId`；perms 改名需迁移授权或明确拒绝；权限被角色引用时不物理删除。
- [ ] 菜单列表继续返回扁平 DTO，menu treeselect 返回前端需要的 `{ menus, checkedKeys }`；菜单层级转换在 query/service DTO 做，不让权限表形状泄漏。
- [ ] 角色保存 DTO 接收一维 `menuIds` 与 `menuCheckStrictly`，校验 ID、状态、操作者可管理范围，事务覆盖 `RoleMenu` 和 `RolePermission`；C/F 节点有权限记录时授予权限，M/C 维护导航可见性。
- [ ] 定义非严格父子联动的服务端规范化规则；严格模式不擅自勾选子项。角色查询的 checkedKeys 需和前端树控件行为一致。
- [ ] 实现系统权限种子/同步工具：代码中声明受保护的 API permission codes，与菜单录入的 `perms` 对账；检测未登记、未使用、重复编码。运行期未登记权限默认拒绝。
- [ ] 实现角色授权和菜单修改审计，授权变化递增权限版本/失效缓存。
- **交付物**：MenuService/RoleService 授权事务、菜单/角色 API、种子同步命令、授权审计。
- **验收**：前端不改 DTO 即可新增/编辑菜单与角色；F/C 权限映射准确；角色保存不会因菜单排序/重复 ID 造成过度授权。

### 批次 5：用户、部门、职位管理域

- [ ] 实现用户列表、详情、新增、编辑、状态、删除、重置密码、本人改密、角色/职位分配及 DTO 白名单映射；不允许 mass assignment。
- [ ] 实现部门树、增改停删、负责人和 ancestors 维护；移动部门事务重算整个受影响子树路径并检查环。
- [ ] 实现职位列表、详情、增改停删；用户与职位多对多关系通过 `UserPost` 同事务替换。
- [ ] 关联写入对所有目标 ID 批量校验存在、启用、未删除；处理同一实体并发修改和数据库唯一约束冲突。
- [ ] 为菜单、角色、用户、部门、职位管理端点配置具体 `@Permission`，管理服务仍执行数据范围和对象级检查。
- [ ] 处理超级管理员保护、最后管理员保护、角色提权保护、部门删除引用保护、重复绑定和停用语义。
- **交付物**：五个管理域的 service/controller/DTO、列表分页查询、审计事件。
- **验收**：CRUD 和关联操作在真实 PostgreSQL 测试库通过；未授权 ID、已停用关联和越权对象都被拒绝。

### 批次 6：数据范围引擎

- [ ] 定义 `DataScope` 值：`ALL=1`、`DEPT=2`、`DEPT_AND_CHILD=3`、`SELF=4`、`CUSTOM=5`，校验 Role 配置和 RoleDept 关系。
- [ ] 解析用户多角色范围并集：ALL 吸收；本部门/部门子树/自定义部门 ID 合并；SELF 作为资源所有者条件合并；无有效角色返回空范围。
- [ ] 建立服务端资源策略注册表，例如 `user -> deptId/userId`、`operLog -> operUserId`，禁止请求输入任意字段名。不是每个表都具备部门和所有者列，须逐资源声明策略。
- [ ] 建立 Prisma 条件组合器，把 data scope 与租户/业务过滤条件以 AND 合并，防止业务 where 覆盖范围 where。
- [ ] 列表、计数、详情、更新、删除、导出、批量操作都应用同一策略；更新/删除优先 `updateMany/deleteMany` 带范围 where，并以受影响行数区分不存在/不可见的统一响应策略。
- [ ] `DEPT_AND_CHILD` 基于正确维护的 ancestors 或递归 CTE；`CUSTOM` 只读 `RoleDept`；本人匹配资源明确 owner 字段。
- [ ] 部门空值、安全管理员/系统任务的显式策略及后台任务 principal 需分别定义，不以 null 自动解释为 ALL。
- **交付物**：DataScopeService、资源策略表、Prisma where helper、管理域接入清单。
- **验收**：多角色交叉、空部门、子部门、本人、自定义范围和读写路径均有集成测试，越权记录不能通过 IDOR 访问。

### 批次 7：缓存、审计、前端集成和运营能力

- [ ] 先压测再决定是否加权限缓存。若启用，key 带用户授权版本；写角色菜单/permission、用户角色、角色状态时同事务更新版本或 outbox 后失效。
- [ ] 设计权限快照接口供前端按钮显示（如 `/auth/permissions` 返回 string[]）；该响应只改善 UI，不是后端授权依据。动态菜单接口返回当前角色可见 M/C 菜单和 C/F 权限码。
- [ ] 操作审计涵盖登录、登录失败、用户角色调整、角色菜单/权限调整、数据范围调整、菜单权限编码变化、拒绝事件。敏感字段脱敏，不记录凭证。
- [ ] 设计权限变更预览：显示受影响角色/用户和授权增减；高风险变更确认并留操作原因。
- [ ] 增加权限目录一致性诊断、失效角色/孤儿关系清理、管理员恢复流程和生产初始超级管理员安全 bootstrap。
- **交付物**：权限缓存/版本、前端兼容 API、审计查询、运维诊断命令和恢复手册。
- **验收**：权限撤销在定义的 SLA 内生效；缓存失效故障 fail closed 或实时回源；审计可追踪全链路变更。

### 批次 8：加固、迁移上线与回滚演练

- [ ] 全量静态扫描 Controller 路由，形成匿名白名单和每条受保护路由的权限矩阵；无标注的非公开路由在 CI 中失败。
- [ ] 对登录、刷新、改密、角色授权、菜单权限同步做并发/重放/越权测试；运行依赖漏洞扫描与 JWT 配置检查。
- [ ] 在脱敏生产副本演练迁移、数据回填、角色授权差异报告、回滚和重新执行；升级脚本须幂等。
- [ ] 使用 feature flag 先影子计算旧/新权限判定并只记录差异，不允许影子结果自动放行；复核差异后再切守卫。
- [ ] 按模块逐步强制权限，监控 401/403、权限查询延迟、空权限用户和管理员救援流程。
- [ ] 形成备份点、迁移窗口、回滚触发标准、回滚脚本和数据修复责任人。
- **交付物**：安全测试报告、权限矩阵、迁移演练记录、上线/回滚操作手册。
- **验收**：无未解释授权差异；回滚已演练；所有高风险越权测试通过；上线指标和责任人明确。

## 估算与依赖

以下是单个熟悉 NestJS/Prisma 的工程师粗略工作日估算，包含实现与必要测试，不含业务方数据范围映射等待时间和前端大改：批次 0 为 1-2 天，批次 1 为 2-4 天，批次 2 为 3-5 天，批次 3 为 2-4 天，批次 4 为 3-5 天，批次 5 为 5-8 天，批次 6 为 4-7 天，批次 7 为 3-5 天，批次 8 为 2-4 天。顺序执行约 25-44 工程日；可并行的测试/管理域工作需要先稳定批次 1-4 的 DTO 和模块接口。真实上线日期应在数据库现状盘点与登录/refresh 需求确认后再承诺。

## 数据库迁移总流程

1. 备份并盘点当前数据；确认当前 schema 是否已有真实部署库和 migration 历史。
2. 由业务逐角色确认旧 `dataScope` 到目标值的映射；旧值 6 与非法值不可自动猜测。
3. 添加 permission/role permission/session schema 与约束；扩展迁移优先采用新增表/列，避免先删除 `Menu.perms` 或旧关联。
4. 从所有启用 C/F 菜单中按 `perms` 去空格并分组；检查空值、格式错误、同码多节点和已停用菜单。若同一 code 对应多个菜单，先决定是拒绝、改成一个权限可关联多个菜单，还是修复重复编码；不要强行塞进唯一 `Permission.menuId`。
5. 创建 Permission 目录；由角色菜单关联反推 RolePermission。生成按角色的旧/新权限差异报告，审查系统角色、租户边界和高风险动作。
6. 部署兼容读写与影子授权，校验差异；再切换守卫至新授权表，观察后清理旧路径/列。

## 管理 API 建议清单

| 域   | API 能力                                                 | 典型权限码                                         |
| ---- | -------------------------------------------------------- | -------------------------------------------------- |
| 认证 | 登录、刷新、登出、当前用户、当前权限                     | 登录相关路由显式 `@Public()`；其余认证保护         |
| 用户 | 分页/详情/新增/编辑/停用/删除/重置密码/分配角色与职位    | `system:user:view/add/edit/remove/resetPwd/assign` |
| 部门 | 树/详情/新增/编辑/停用/删除/移动                         | `system:dept:view/add/edit/remove`                 |
| 角色 | 分页/详情/新增/编辑/停用/删除/用户列表/菜单授权/数据范围 | `system:role:view/add/edit/remove/assign/scope`    |
| 菜单 | 扁平列表/详情/新增/编辑/删除/角色树                      | `system:menu:view/add/edit/remove`                 |
| 职位 | 分页/详情/新增/编辑/停用/删除                            | `system:post:view/add/edit/remove`                 |

权限码命名需全项目统一，`remove`/`delete` 选一种并保持一致；上表是能力清单而非允许通配符放权。导入、导出、批量授权属于独立高风险权限，不应自动继承普通新增/查看权限。

## 必需测试

- 装饰器规范化：字符串、单元素/多元素数组、AND、OR、类与方法覆盖、角色兜底和非法 metadata。
- BigInt 边界：超出安全整数的 ID 往返、非法字符串拒绝、响应/JWT/cache/log 无裸 BigInt。
- 守卫：匿名 401、公开路由放行、有效身份、缺权限 403、AND/OR、有效/停用角色兜底、用户/角色停用、元数据遗漏策略。
- 认证：密码正确/错误、停用用户、过期/伪造/撤销令牌、刷新轮换与登出。
- 数据范围：五种模式、多角色并集、空部门、自定义部门、部门子树、本人归属；列表、详情、更新、删除都不能越权。
- 并发/一致性：角色权限变更后旧缓存失效；迁移映射后的实际可见记录符合已确认的授权范围。
- 查询质量：`findMany/count` 使用同一 where；排序白名单生效；关联读取无循环 N+1；高复杂度 where builder 和权限合并函数有单元/集成测试。

## 实施验收标准

- 受保护端点没有可绕过的匿名路径，公开端点明确声明。
- 后端权限检查独立于前端菜单展示，数据库权限点唯一且角色授权关系可审计。
- `@Permission` 的 AND、OR、角色兜底语义一致并有单测；认证拒绝与权限拒绝分别返回 401/403。
- 五种数据范围统一编码，历史值完成逐条映射；每个受控数据查询在 SQL/Prisma 条件层执行范围限制。
- 用户/角色/权限停用或授权变更按约定立即或在明确的短 TTL 内生效。
- API 与前端的 ID 全程十进制字符串，内部 Prisma 查询使用 BigInt；大 ID 在请求、响应、JWT、缓存和审计往返无精度损失。
- Service 主流程短小清晰；超过 100 行的方法有明确评审理由，查询/事务/mapper/policy 职责清楚，没有循环内数据库查询或复制粘贴的权限规则。
