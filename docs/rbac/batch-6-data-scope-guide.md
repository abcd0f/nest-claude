# 批次 6：数据范围引擎实现指南

## 概述

批次 6 实现了 NestJS RBAC 系统中的**数据权限控制层**，用于限制用户可访问的数据记录集合。

**核心概念：**
- **认证层**：确认"你是谁"（AuthGuard）
- **功能权限层**：确认"你能做什么"（PermissionGuard）
- **数据权限层**：确认"你能看到什么"（DataScopeService）← 本批次

## 架构设计

### 数据范围模型

系统支持 5 种数据范围，存储在 `Role.dataScope` 字段中：

```typescript
export enum DataScope {
  ALL = '1',              // 全部数据
  DEPT = '2',             // 本部门
  DEPT_AND_CHILD = '3',   // 本部门及以下
  SELF = '4',             // 仅本人
  CUSTOM = '5',           // 自定义部门（通过 sys_role_dept）
}
```

### 多角色范围合并策略

用户可能拥有多个角色，每个角色有不同的数据范围。合并规则遵循**并集（最大可见）**策略：

```
优先级顺序（从高到低）：
1. ALL         - 全部数据（吸收其他所有范围）
2. CUSTOM      - 自定义部门（收集所有指定部门）
3. DEPT_AND_CHILD - 本部门及以下
4. DEPT        - 本部门
5. SELF        - 仅本人
```

**示例：**
- 用户拥有角色 A（DEPT）和角色 B（DEPT_AND_CHILD）→ 合并结果：DEPT_AND_CHILD
- 用户拥有角色 A（CUSTOM, 部门1,2）和角色 B（CUSTOM, 部门2,3）→ 合并结果：CUSTOM（部门1,2,3）

### 资源政策注册

不同的业务资源有不同的"部门"和"所有者"字段定义：

```typescript
export enum ResourceType {
  USER = 'user',       // deptId, userId
  DEPT = 'dept',       // deptId, leaderId
  OPER_LOG = 'operLog', // operUser.deptId, operUserId
}

// 资源政策配置
{
  [ResourceType.USER]: {
    deptField: 'deptId',      // 用户所属部门
    ownerField: 'userId',     // 用户自身
  },
  [ResourceType.DEPT]: {
    deptField: 'deptId',      // 部门自身
    ownerField: 'leaderId',   // 部门负责人
  },
  [ResourceType.OPER_LOG]: {
    deptField: 'operUser.deptId',  // 操作人所属部门
    ownerField: 'operUserId',      // 操作人
  },
}
```

## API 设计

### DataScopeService

#### `resolveUserScope(userId: bigint): Promise<ResolvedDataScope>`

解析用户的数据访问范围。

**流程：**
1. 查询用户的所有有效角色（已启用、未删除）
2. 合并多个角色的范围（并集策略）
3. 返回解析后的范围

**返回类型：**
```typescript
type ResolvedDataScope =
  | { kind: DataScope.ALL }
  | { kind: DataScope.DEPT }
  | { kind: DataScope.DEPT_AND_CHILD; deptIds: bigint[] }
  | { kind: DataScope.SELF }
  | { kind: DataScope.CUSTOM; deptIds: bigint[] };
```

**示例：**
```typescript
const scope = await dataScopeService.resolveUserScope(userId);

if (scope.kind === DataScope.ALL) {
  // 用户可见全部数据
}
```

#### `buildUserWhereCondition(scope, userDeptId, userId): Promise<Prisma.WhereInput>`

为用户资源（User）构建查询条件。

**范围映射规则：**

| 范围 | 条件 | 说明 |
|------|------|------|
| ALL | `{}` | 无限制 |
| DEPT | `{ deptId: userDeptId }` | 按用户部门过滤 |
| DEPT_AND_CHILD | `{ deptId: { in: childIds } }` | 按用户部门及子部门过滤 |
| SELF | `{ userId }` | 按当前用户过滤 |
| CUSTOM | `{ deptId: { in: customDeptIds } }` | 按指定部门列表过滤 |

**示例：**
```typescript
const scope = await dataScopeService.resolveUserScope(currentUserId);
const where = await dataScopeService.buildUserWhereCondition(
  scope,
  currentUserDeptId,
  currentUserId,
);

// 列表查询，应用数据范围
const users = await prisma.user.findMany({
  where: {
    ...where,           // 数据范围条件
    status: '0',        // 业务条件
  },
});
```

#### `buildDeptWhereCondition(scope, userDeptId, userId): Promise<Prisma.WhereInput>`

为部门资源（Dept）构建查询条件。

特殊处理：
- SELF 范围映射到部门负责人（`{ leaderId: userId }`）

#### `buildOperLogWhereCondition(scope, userDeptId, userId): Promise<Prisma.WhereInput>`

为操作日志资源构建查询条件。

#### `getDeptChildrenIds(deptId: bigint): Promise<bigint[]>`

查询部门的所有子部门 ID（包含自身）。

基于 `Dept.ancestors` 物化路径字段实现。

**示例：**
```typescript
const deptId = 1n;
const childIds = await dataScopeService.getDeptChildrenIds(deptId);
// 返回 [1n, 2n, 3n, ...] 包含所有子部门
```

#### `getDeptParentIds(deptId: bigint): Promise<bigint[]>`

查询部门的所有父部门 ID（包含自身）。

#### `mergeWhereConditions(...conditions): Prisma.WhereInput`

合并多个 Prisma where 条件为 AND 逻辑。

用于将数据范围条件与业务条件合并。

**示例：**
```typescript
const where = DataScopeService.mergeWhereConditions(
  scopeWhere,      // 数据范围条件
  { status: '0' }, // 业务条件
  { delFlag: '0' }, // 更多业务条件
);
```

## 使用示例

### 1. 用户列表查询

```typescript
@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
  ) {}

  async listUsers(
    dto: ListUserDto,
    principal: UserPrincipal,
  ): Promise<PageResponseDto<UserResponseDto>> {
    // 1. 解析当前用户的数据范围
    const scope = await this.dataScope.resolveUserScope(principal.userId);

    // 2. 构建数据范围条件
    const scopeWhere = await this.dataScope.buildUserWhereCondition(
      scope,
      principal.deptId,
      principal.userId,
    );

    // 3. 构建业务条件
    const businessWhere = {
      ...(dto.status && { status: dto.status }),
      ...(dto.search && {
        OR: [
          { userName: { contains: dto.search } },
          { nickName: { contains: dto.search } },
        ],
      }),
    };

    // 4. 合并条件：数据范围 AND 业务条件
    const where = DataScopeService.mergeWhereConditions(scopeWhere, businessWhere, {
      delFlag: '0',
    });

    // 5. 执行查询（同时查询数据和总数）
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (dto.page - 1) * dto.pageSize,
        take: dto.pageSize,
        orderBy: { createTime: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    // 6. 转换并返回
    return {
      items: items.map(item => plainToInstance(UserResponseDto, item)),
      meta: makePageMeta(dto.page, dto.pageSize, total),
    };
  }
}
```

### 2. 用户详情查询

```typescript
async getUserById(
  userId: string,
  principal: UserPrincipal,
): Promise<UserResponseDto> {
  const id = parseId(userId, 'userId');

  // 1. 解析数据范围
  const scope = await this.dataScope.resolveUserScope(principal.userId);
  const scopeWhere = await this.dataScope.buildUserWhereCondition(
    scope,
    principal.deptId,
    principal.userId,
  );

  // 2. 查询用户，应用数据范围过滤
  const user = await this.prisma.user.findFirst({
    where: {
      userId: id,
      ...scopeWhere, // 应用数据范围
    },
  });

  if (!user) {
    throw new NotFoundException(`用户不存在或无权访问`);
  }

  return plainToInstance(UserResponseDto, user);
}
```

### 3. 用户更新/删除

```typescript
async updateUser(
  userId: string,
  dto: UpdateUserDto,
  principal: UserPrincipal,
): Promise<UserResponseDto> {
  const id = parseId(userId, 'userId');

  // 1. 构建数据范围条件
  const scope = await this.dataScope.resolveUserScope(principal.userId);
  const scopeWhere = await this.dataScope.buildUserWhereCondition(
    scope,
    principal.deptId,
    principal.userId,
  );

  // 2. 更新时应用数据范围（防止越权修改）
  const user = await this.prisma.user.updateMany({
    where: {
      userId: id,
      ...scopeWhere, // 只能更新有权访问的用户
    },
    data: {
      nickName: dto.nickName,
      email: dto.email,
      updateTime: new Date(),
    },
  });

  // 3. 检查是否真的更新了（验证权限）
  if (user.count === 0) {
    throw new ForbiddenException('无权访问该用户');
  }

  // 4. 重新查询返回最新数据
  const updated = await this.prisma.user.findUnique({ where: { userId: id } });
  return plainToInstance(UserResponseDto, updated!);
}
```

### 4. 批量操作

```typescript
async deleteUsers(
  userIds: string[],
  principal: UserPrincipal,
): Promise<void> {
  const ids = userIds.map(id => parseId(id, 'userId'));

  // 1. 构建数据范围条件
  const scope = await this.dataScope.resolveUserScope(principal.userId);
  const scopeWhere = await this.dataScope.buildUserWhereCondition(
    scope,
    principal.deptId,
    principal.userId,
  );

  // 2. 删除时应用数据范围
  const result = await this.prisma.user.deleteMany({
    where: {
      userId: { in: ids },
      ...scopeWhere, // 只能删除有权访问的用户
    },
  });

  if (result.count !== ids.length) {
    throw new ForbiddenException(
      `只能删除有权访问的用户（实际删除 ${result.count}/${ids.length}）`,
    );
  }
}
```

## 控制器集成

```typescript
import { CurrentUser } from '@app/auth';
import { UserPrincipal } from '@app/auth';
import { Permission } from '@app/permission';

@Controller('system/user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * 列表查询
   * 自动应用数据范围限制
   */
  @Get()
  @Permission('system:user:view')
  async listUsers(
    @Query() dto: ListUserDto,
    @CurrentUser() principal: UserPrincipal,
  ): Promise<PageResponseDto<UserResponseDto>> {
    // userService.listUsers 内部会调用 dataScope 进行范围检查
    return this.userService.listUsers(dto, principal);
  }

  /**
   * 详情查询
   * 自动验证访问权限
   */
  @Get(':userId')
  @Permission('system:user:view')
  async getUserById(
    @Param() params: UserIdParamDto,
    @CurrentUser() principal: UserPrincipal,
  ): Promise<UserResponseDto> {
    return this.userService.getUserById(params.userId, principal);
  }
}
```

## 测试用例

### 单元测试

已在 `data-scope.service.spec.ts` 中实现：

- `resolveUserScope` - 五种范围的单独测试和合并测试
- `buildUserWhereCondition` - 各范围对应的 where 条件
- `buildDeptWhereCondition` - 部门资源的特殊处理
- `buildOperLogWhereCondition` - 操作日志的处理
- `getDeptChildrenIds` - 部门子树查询
- `getDeptParentIds` - 父部门解析
- `mergeWhereConditions` - 条件合并逻辑

### 集成测试建议

```typescript
describe('DataScope Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await app.init();
  });

  describe('User List Query', () => {
    it('SELF 范围用户只能看到自己', async () => {
      // 创建测试数据
      const user1 = await createUser('user1', 'SELF');
      const user2 = await createUser('user2', 'ALL');

      // user1 登录，查询用户列表
      const response = await request(app.getHttpServer())
        .get('/system/user')
        .set('Authorization', `Bearer ${getToken(user1.userId)}`);

      // user1 只能看到自己
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].userId).toBe(user1.userId.toString());
    });

    it('DEPT 范围用户只能看到本部门用户', async () => {
      const dept1 = await createDept('部门1');
      const dept2 = await createDept('部门2');
      const user1 = await createUser('user1', dept1.deptId, 'DEPT');
      const user2 = await createUser('user2', dept2.deptId, 'DEPT');

      const response = await request(app.getHttpServer())
        .get('/system/user')
        .set('Authorization', `Bearer ${getToken(user1.userId)}`);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].deptId).toBe(dept1.deptId.toString());
    });

    it('DEPT_AND_CHILD 范围用户能看到本部门及子部门用户', async () => {
      const parentDept = await createDept('父部门');
      const childDept = await createDept('子部门', parentDept.deptId);
      
      const user1 = await createUser('user1', parentDept.deptId, 'DEPT_AND_CHILD');
      const user2 = await createUser('user2', childDept.deptId, 'DEPT_AND_CHILD');

      const response = await request(app.getHttpServer())
        .get('/system/user')
        .set('Authorization', `Bearer ${getToken(user1.userId)}`);

      expect(response.body.items).toHaveLength(2);
    });

    it('ALL 范围用户能看到所有用户', async () => {
      const user1 = await createUser('user1', null, 'ALL');
      const user2 = await createUser('user2', null, 'ALL');

      const response = await request(app.getHttpServer())
        .get('/system/user')
        .set('Authorization', `Bearer ${getToken(user1.userId)}`);

      expect(response.body.items.length).toBeGreaterThanOrEqual(2);
    });

    it('CUSTOM 范围用户只能看到指定部门的用户', async () => {
      const dept1 = await createDept('部门1');
      const dept2 = await createDept('部门2');
      const dept3 = await createDept('部门3');

      const user1 = await createUser('user1', dept1.deptId);
      const user2 = await createUser('user2', dept2.deptId);
      const user3 = await createUser('user3', dept3.deptId);

      // 分配 CUSTOM 范围角色，只指定 dept1 和 dept2
      const role = await createRole('custom-role', 'CUSTOM');
      await assignRoleToDept(role.roleId, dept1.deptId);
      await assignRoleToDept(role.roleId, dept2.deptId);
      await assignRoleToUser(user1.userId, role.roleId);

      const response = await request(app.getHttpServer())
        .get('/system/user')
        .set('Authorization', `Bearer ${getToken(user1.userId)}`);

      // user1 只能看到 dept1 和 dept2 的用户
      expect(response.body.items.map(u => u.userId)).toContain(user1.userId.toString());
      expect(response.body.items.map(u => u.userId)).toContain(user2.userId.toString());
      expect(response.body.items.map(u => u.userId)).not.toContain(user3.userId.toString());
    });
  });

  describe('越权访问拒绝', () => {
    it('SELF 范围用户不能访问其他用户详情', async () => {
      const user1 = await createUser('user1', 'SELF');
      const user2 = await createUser('user2', 'SELF');

      const response = await request(app.getHttpServer())
        .get(`/system/user/${user2.userId}`)
        .set('Authorization', `Bearer ${getToken(user1.userId)}`);

      expect(response.status).toBe(404); // 或 403
    });

    it('DEPT 范围用户不能修改其他部门用户', async () => {
      const dept1 = await createDept('部门1');
      const dept2 = await createDept('部门2');
      const user1 = await createUser('user1', dept1.deptId, 'DEPT');
      const user2 = await createUser('user2', dept2.deptId, 'DEPT');

      const response = await request(app.getHttpServer())
        .put(`/system/user/${user2.userId}`)
        .set('Authorization', `Bearer ${getToken(user1.userId)}`)
        .send({ nickName: 'hacked' });

      expect(response.status).toBe(403);
    });
  });
});
```

## 最佳实践

### 1. 始终应用数据范围

数据范围必须应用到所有涉及数据访问的操作：

```typescript
// ✅ 正确：应用数据范围
await prisma.user.findMany({ where: { ...scopeWhere, status: '0' } });
await prisma.user.updateMany({ where: { userId: id, ...scopeWhere }, data: {...} });
await prisma.user.deleteMany({ where: { userId: { in: ids }, ...scopeWhere } });

// ❌ 错误：只在列表查询应用，详情/编辑/删除不应用
const user = await prisma.user.findUnique({ where: { userId: id } });
```

### 2. 区分 where 和 select

```typescript
// 查询条件（WHERE）
const scopeWhere = await dataScope.buildUserWhereCondition(...);

// 返回字段（SELECT）
const select = { userId: true, userName: true, nickName: true };

// 使用区分
const users = await prisma.user.findMany({
  where: scopeWhere,
  select,
});
```

### 3. 事务中的数据范围

```typescript
const result = await prisma.$transaction(async (tx) => {
  // 在事务中重新解析数据范围（避免中途权限变更）
  const scope = await this.dataScope.resolveUserScope(userId);
  const where = await this.dataScope.buildUserWhereCondition(scope, deptId, userId);

  const user = await tx.user.findFirst({ where: { userId: id, ...where } });
  if (!user) throw new ForbiddenException();

  return await tx.user.update({ where: { userId: id }, data: {...} });
});
```

### 4. 部门树的维护

`DEPT_AND_CHILD` 范围依赖 `Dept.ancestors` 字段：

```prisma
model Dept {
  // ... 其他字段
  ancestors String   @default("/") @db.VarChar(512)  // 物化路径
  
  @@index([ancestors])  // 必须有索引用于快速查询
}
```

部门移动时必须更新 ancestors：

```typescript
async moveDept(deptId: bigint, newParentId: bigint): Promise<void> {
  return await prisma.$transaction(async (tx) => {
    // 1. 验证不能移动到自身后代
    const descendants = await tx.dept.findMany({
      where: { ancestors: { contains: `/${deptId}/` } },
    });
    if (descendants.some(d => d.deptId === newParentId)) {
      throw new BadRequestException('不能移动到自身后代');
    }

    // 2. 查询新父部门的 ancestors
    const newParent = await tx.dept.findUnique({
      where: { deptId: newParentId },
      select: { ancestors: true },
    });

    // 3. 计算新的 ancestors
    const newAncestors = `${newParent.ancestors}${newParentId}/`;

    // 4. 更新该部门及所有子部门的 ancestors
    const allDescendants = await tx.dept.findMany({
      where: {
        OR: [
          { deptId },
          { ancestors: { contains: `/${deptId}/` } },
        ],
      },
    });

    for (const dept of allDescendants) {
      const suffix = dept.ancestors.substring(
        dept.deptId === deptId ? 
          dept.ancestors.length - `/${deptId}`.length :
          dept.ancestors.indexOf(`/${deptId}/`) + `/${deptId}`.length
      );
      
      await tx.dept.update({
        where: { deptId: dept.deptId },
        data: { ancestors: `${newAncestors}${suffix}` },
      });
    }
  });
}
```

### 5. 缓存策略

`ResolvedDataScope` 可基于用户权限版本号缓存：

```typescript
async resolveUserScope(userId: bigint): Promise<ResolvedDataScope> {
  const user = await this.prisma.user.findUnique({
    where: { userId },
    select: { permissionVersion: true },
  });

  // 缓存键基于用户权限版本
  const cacheKey = `datascope:${userId}:${user.permissionVersion}`;
  const cached = await this.cache.get(cacheKey);
  if (cached) return cached;

  const scope = await this.resolveScope(userId);
  await this.cache.set(cacheKey, scope, 3600 * 1000); // 1 小时

  return scope;
}
```

## 常见问题

### Q1: 用户没有任何角色时怎么办？

A: 返回 `SELF` 范围（最严格），用户只能访问自己的数据。如果甚至这也不符合业务需求，可配置为返回空集（拒绝所有访问）。

### Q2: 如何扩展到其他资源类型？

A: 在 `ResourceType` 枚举中添加新类型，在 `RESOURCE_POLICIES` 中定义字段映射，在 `DataScopeService` 中添加对应的 `buildXxxWhereCondition` 方法。

### Q3: 部门删除时如何处理数据范围？

A: 
- 不能物理删除被引用的部门（通过检查 `User.deptId` 和 `RoleDept` 的外键）
- 优先进行逻辑删除（设置 `delFlag='1'`）
- 查询时过滤已删除部门

### Q4: 能否结合菜单权限和数据范围？

A: 可以。菜单权限（`@Permission`）和数据范围是正交的：
- 菜单权限判定"是否可访问这个功能"
- 数据范围判定"可访问哪些记录"

两者都满足才能成功执行操作。

### Q5: 性能优化建议？

A:
- 给 `Dept.ancestors` 添加索引（已在 schema 中）
- 缓存 `ResolvedDataScope` 基于权限版本号
- 批量操作时使用 `findMany + Map` 而非逐个查询
- 为常见的 where 组合添加复合索引

## 总结

批次 6 实现的 DataScopeService 提供了灵活、可扩展的数据权限控制能力：

- ✅ 支持 5 种数据范围模式
- ✅ 多角色范围智能合并（并集策略）
- ✅ 资源政策可扩展注册
- ✅ 部门树支持（基于 ancestors 物化路径）
- ✅ 完整单元测试覆盖
- ✅ 与 AuthGuard 和 PermissionGuard 协同工作

关键是在所有数据访问操作中都应用数据范围条件，不仅限于列表查询，还包括详情、编辑、删除等操作。
