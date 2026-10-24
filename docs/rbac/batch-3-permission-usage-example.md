# 批次 3 权限模块使用示例

## 装饰器使用示例

### 1. 单个权限

```typescript
import { Controller, Get } from '@nestjs/common';
import { Permission } from '@app/permission';
import { CurrentUser, UserPrincipal } from '@app/auth';

@Controller('users')
export class UserController {
  /**
   * 查看用户列表
   * 要求用户拥有 'system:user:view' 权限
   */
  @Get()
  @Permission('system:user:view')
  findAll(@CurrentUser() user: UserPrincipal) {
    return { message: 'User list', userId: user.userId.toString() };
  }
}
```

### 2. 多个权限（AND 模式，默认）

```typescript
import { Put } from '@nestjs/common';
import { Permission } from '@app/permission';

@Controller('users')
export class UserController {
  /**
   * 更新用户
   * 要求用户同时拥有 'system:user:edit' 和 'system:user:view' 权限
   */
  @Put(':id')
  @Permission(['system:user:edit', 'system:user:view'])
  update() {
    return { message: 'User updated' };
  }
}
```

### 3. 多个权限（OR 模式）

```typescript
import { Post } from '@nestjs/common';
import { Permission, Mode } from '@app/permission';

@Controller('users')
export class UserController {
  /**
   * 保存用户（新增或更新）
   * 要求用户拥有 'system:user:add' 或 'system:user:edit' 权限之一
   */
  @Post()
  @Permission({ value: ['system:user:add', 'system:user:edit'], mode: Mode.OR })
  save() {
    return { message: 'User saved' };
  }
}
```

### 4. 带角色兜底

```typescript
import { Delete } from '@nestjs/common';
import { Permission } from '@app/permission';

@Controller('users')
export class UserController {
  /**
   * 删除用户
   * 用户拥有 'admin' 角色或 'system:user:remove' 权限即可访问
   */
  @Delete(':id')
  @Permission({ value: 'system:user:remove', role: 'admin' })
  remove() {
    return { message: 'User removed' };
  }
}
```

### 5. 类级装饰器

```typescript
import { Controller, Get, Post, Put, Delete } from '@nestjs/common';
import { Permission } from '@app/permission';

/**
 * 类级权限：所有方法默认需要 'system:user:view' 权限
 * 方法级权限会覆盖类级权限
 */
@Controller('users')
@Permission('system:user:view')
export class UserController {
  /**
   * 继承类级权限：需要 'system:user:view'
   */
  @Get()
  findAll() {
    return { message: 'User list' };
  }

  /**
   * 方法级权限覆盖类级权限：需要 'system:user:add'
   */
  @Post()
  @Permission('system:user:add')
  create() {
    return { message: 'User created' };
  }
}
```

## 权限判定逻辑

### AND 模式（默认）

用户必须拥有**所有**指定的权限才能访问：

```typescript
// 用户必须同时拥有两个权限
@Permission(['system:user:view', 'system:user:edit'])

// 等价于
@Permission({ value: ['system:user:view', 'system:user:edit'], mode: Mode.AND })
```

### OR 模式

用户只需拥有**至少一个**指定的权限即可访问：

```typescript
// 用户拥有其中一个权限即可
@Permission({ value: ['system:user:add', 'system:user:edit'], mode: Mode.OR })
```

### 角色兜底

用户拥有指定角色**或**满足权限要求即可访问：

```typescript
// 用户拥有 'admin' 角色 或 'system:user:remove' 权限即可
@Permission({ value: 'system:user:remove', role: 'admin' })
```

### 超级管理员

拥有 `roleKey = 'superadmin'` 角色的用户自动通过所有权限检查，无需显式授权。

## 权限缓存机制

### 缓存键设计

```typescript
// 缓存键格式：user:perms:{userId}:{permissionVersion}
const cacheKey = `user:perms:1:5`;
```

### 缓存失效策略

1. **用户角色变更时**：
   ```typescript
   await permissionService.invalidateUserPermissions([userId1, userId2]);
   ```

2. **角色权限变更时**：
   ```typescript
   await permissionService.invalidateRolePermissions(roleId);
   ```

3. **批量失效**：
   ```typescript
   permissionService.clearAllCache();
   ```

### 缓存流程

1. 用户首次访问受保护路由
2. `PermissionGuard` 调用 `PermissionService.resolveUserPermissions(userId)`
3. `PermissionService` 检查缓存：`user:perms:{userId}:{version}`
4. 缓存未命中，从数据库查询：`User -> UserRole -> RolePermission -> Permission`
5. 将结果缓存 1 小时
6. 下次访问直接从缓存读取，无需查询数据库
7. 权限变更时，递增用户的 `permissionVersion`，旧缓存自动失效

## 守卫执行顺序

```
请求 → ThrottlerGuard → AuthGuard → PermissionGuard → Controller
       （限流）         （认证）      （权限判定）
```

### 各守卫职责

1. **ThrottlerGuard**：限流保护，防止恶意请求
2. **AuthGuard**：JWT 验证，设置 `request.user`
3. **PermissionGuard**：权限判定，检查 `@Permission` 装饰器

### 策略

- **无装饰器**：只要求认证（AuthGuard），不检查权限
- **@Public()**：跳过认证和权限检查
- **@Permission(...)**：需要认证 + 权限检查

## 错误响应

### 401 Unauthorized

用户未认证或认证失败：

```json
{
  "statusCode": 401,
  "message": "用户未认证",
  "error": "Unauthorized"
}
```

### 403 Forbidden

用户已认证但权限不足：

```json
{
  "statusCode": 403,
  "message": "权限不足",
  "error": "Forbidden"
}
```

## 测试用例

### 单元测试

```typescript
import { Test } from '@nestjs/testing';
import { PermissionService } from '@app/permission';
import { PrismaService } from '@app/database';

describe('UserController', () => {
  let controller: UserController;
  let permissionService: PermissionService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: PermissionService,
          useValue: {
            resolveUserPermissions: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(UserController);
    permissionService = module.get(PermissionService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
```

### E2E 测试

```typescript
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Permission (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Login to get access token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    accessToken = loginResponse.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 401 without token', () => {
    return request(app.getHttpServer())
      .get('/system/user')
      .expect(401);
  });

  it('should return 403 without permission', () => {
    return request(app.getHttpServer())
      .get('/system/user')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
  });

  it('should return 200 with valid token and permission', () => {
    return request(app.getHttpServer())
      .get('/system/user')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });
});
```

## 最佳实践

### 1. 权限编码规范

遵循统一的命名规则：`<module>:<resource>:<action>`

```typescript
// ✅ 正确
@Permission('system:user:view')
@Permission('system:role:add')
@Permission('system:menu:edit')

// ❌ 错误
@Permission('viewUser')
@Permission('USER_VIEW')
@Permission('system-user-view')
```

### 2. 权限粒度

合理设计权限粒度，避免过细或过粗：

```typescript
// ✅ 合理粒度
@Get(':id')
@Permission('system:user:view')
findOne() {}

@Post()
@Permission('system:user:add')
create() {}

// ❌ 过细粒度（不必要）
@Get(':id/name')
@Permission('system:user:view:name')
getName() {}

// ❌ 过粗粒度（不安全）
@Delete(':id')
@Permission('system:user')  // 应该是 'system:user:remove'
remove() {}
```

### 3. 避免硬编码

将权限编码定义为常量：

```typescript
// constants/permissions.ts
export const PERMISSIONS = {
  USER: {
    VIEW: 'system:user:view',
    ADD: 'system:user:add',
    EDIT: 'system:user:edit',
    REMOVE: 'system:user:remove',
  },
  ROLE: {
    VIEW: 'system:role:view',
    ADD: 'system:role:add',
    EDIT: 'system:role:edit',
    REMOVE: 'system:role:remove',
  },
} as const;

// user.controller.ts
import { PERMISSIONS } from './constants/permissions';

@Get()
@Permission(PERMISSIONS.USER.VIEW)
findAll() {}
```

### 4. 文档化

为每个受保护的路由添加注释说明权限要求：

```typescript
@Controller('users')
export class UserController {
  /**
   * 查看用户列表
   *
   * 权限要求：system:user:view
   * 角色要求：无
   * 描述：普通用户和管理员都可以查看用户列表
   */
  @Get()
  @Permission('system:user:view')
  findAll() {}
}
```

### 5. 测试覆盖

每个受保护的路由都应该有对应的权限测试：

- 有权限的用户可以访问
- 无权限的用户被拒绝
- 超级管理员可以访问
- 匿名用户被拒绝

## 故障排查

### 问题：权限变更后仍无法访问

**原因**：权限缓存未失效

**解决**：
1. 检查是否调用了 `invalidateUserPermissions` 或 `invalidateRolePermissions`
2. 检查用户的 `permissionVersion` 是否递增
3. 手动清除缓存：`permissionService.clearAllCache()`

### 问题：所有用户都可以访问受保护路由

**原因**：未注册 PermissionGuard 或装饰器使用错误

**解决**：
1. 检查 `CoreModule` 是否注册了 `PermissionGuard`
2. 检查守卫注册顺序：`AuthGuard` 必须在 `PermissionGuard` 之前
3. 检查装饰器是否正确导入：`import { Permission } from '@app/permission'`

### 问题：超级管理员也被拒绝

**原因**：角色键不匹配或角色未启用

**解决**：
1. 检查用户的角色键是否为 `'superadmin'`（精确匹配）
2. 检查角色状态：`status='0'`, `delFlag='0'`
3. 检查用户状态：`status='0'`, `delFlag='0'`

## 后续批次预告

批次 3 完成后，我们已经具备了基础的 RBAC 权限判定能力。

**批次 4** 将实现：
- 菜单管理（CRUD）
- 菜单与权限的自动同步
- 角色菜单授权
- 权限种子管理

这将使权限管理更加可视化和易于维护。
