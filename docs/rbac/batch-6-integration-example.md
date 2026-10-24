# 批次 6：集成示例代码

本文档提供了完整的集成示例，展示如何在实际项目中使用 `DataScopeService`。

## 1. 增强版用户服务

```typescript
// apps/gateway/src/modules/system/user/user.service.enhanced.ts

import { PageResponseDto } from '@app/common/dto/base.dto.js';
import { parseId, formatId } from '@app/common/utils/bigint.util.js';
import { makePageMeta, paginate } from '@app/common/utils/page.util.js';
import { DataScopeService } from '@app/permission';
import { PrismaService } from '@app/database';
import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { UserPrincipal } from '@app/auth';

/**
 * 增强版用户服务
 * 
 * 集成 DataScopeService，为所有数据查询和修改操作应用数据范围限制
 */
@Injectable()
export class UserServiceEnhanced {
  private readonly logger = new Logger(UserServiceEnhanced.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
  ) {}

  /**
   * 获取用户详情，应用数据范围检查
   */
  async getUserById(userId: string, principal: UserPrincipal): Promise<UserResponseDto> {
    const id = parseId(userId, 'userId');

    // 1. 解析当前用户的数据范围
    const scope = await this.dataScope.resolveUserScope(principal.userId);
    const scopeWhere = await this.dataScope.buildUserWhereCondition(
      scope,
      principal.deptId,
      principal.userId,
    );

    // 2. 查询时应用数据范围，防止越权访问
    const user = await this.prisma.user.findFirst({
      where: {
        userId: id,
        ...scopeWhere, // 关键：应用数据范围
        delFlag: '0',
      },
      select: {
        userId: true,
        userName: true,
        nickName: true,
        email: true,
        phoneNumber: true,
        sex: true,
        status: true,
        deptId: true,
        loginIp: true,
        loginDate: true,
        createTime: true,
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在或无权访问');
    }

    return {
      ...user,
      userId: formatId(user.userId),
      deptId: formatId(user.deptId),
    } as UserResponseDto;
  }

  /**
   * 列表查询，应用数据范围和分页
   */
  async listUsers(
    dto: ListUserDto,
    principal: UserPrincipal,
  ): Promise<PageResponseDto<UserResponseDto>> {
    const { skip, take, page, pageSize } = paginate({
      page: dto.page,
      pageSize: dto.pageSize,
    });

    // 1. 解析数据范围
    const scope = await this.dataScope.resolveUserScope(principal.userId);
    const scopeWhere = await this.dataScope.buildUserWhereCondition(
      scope,
      principal.deptId,
      principal.userId,
    );

    // 2. 构建业务过滤条件
    const deptId = dto.deptId ? parseId(dto.deptId, 'deptId') : undefined;
    const businessWhere = {
      ...(deptId ? { deptId } : null),
      ...(dto.status ? { status: dto.status } : null),
      ...(dto.search ? {
        OR: [
          { userName: { contains: dto.search } },
          { nickName: { contains: dto.search } },
        ],
      } : null),
    };

    // 3. 合并数据范围条件和业务条件
    const where = {
      ...scopeWhere,        // 数据范围条件（AND）
      ...businessWhere,     // 业务条件（AND）
      delFlag: '0',         // 状态条件（AND）
    };

    // 4. 执行查询（同时查询数据和总数）
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createTime: 'desc' },
        select: {
          userId: true,
          userName: true,
          nickName: true,
          email: true,
          deptId: true,
          status: true,
          createTime: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    // 5. 转换为响应 DTO
    const userDtos = items.map(item => ({
      ...item,
      userId: formatId(item.userId),
      deptId: formatId(item.deptId),
    } as UserResponseDto));

    return {
      items: userDtos,
      meta: makePageMeta(page, pageSize, total),
    };
  }

  /**
   * 更新用户，应用数据范围检查
   */
  async updateUser(
    userId: string,
    dto: UpdateUserDto,
    principal: UserPrincipal,
  ): Promise<UserResponseDto> {
    const id = parseId(userId, 'userId');
    const deptId = dto.deptId ? parseId(dto.deptId, 'deptId') : undefined;

    return await this.prisma.$transaction(async (tx) => {
      // 1. 构建数据范围条件
      const scope = await this.dataScope.resolveUserScope(principal.userId);
      const scopeWhere = await this.dataScope.buildUserWhereCondition(
        scope,
        principal.deptId,
        principal.userId,
      );

      // 2. 验证用户存在且有权访问
      const existing = await tx.user.findFirst({
        where: {
          userId: id,
          ...scopeWhere,
          delFlag: '0',
        },
      });

      if (!existing) {
        throw new NotFoundException('用户不存在或无权访问');
      }

      // 3. 验证新部门（如果指定了）
      if (deptId && deptId !== existing.deptId) {
        const dept = await tx.dept.findUnique({
          where: { deptId },
          select: { deptId: true },
        });
        if (!dept) {
          throw new BadRequestException('目标部门不存在');
        }
      }

      // 4. 更新用户
      const updated = await tx.user.update({
        where: { userId: id },
        data: {
          ...(dto.nickName && { nickName: dto.nickName }),
          ...(dto.email !== undefined && { email: dto.email }),
          ...(dto.phoneNumber !== undefined && { phoneNumber: dto.phoneNumber }),
          ...(dto.sex && { sex: dto.sex }),
          ...(dto.status && { status: dto.status }),
          ...(deptId && { deptId }),
          updateTime: new Date(),
        },
        select: {
          userId: true,
          userName: true,
          nickName: true,
          email: true,
          phoneNumber: true,
          sex: true,
          status: true,
          deptId: true,
        },
      });

      return {
        ...updated,
        userId: formatId(updated.userId),
        deptId: formatId(updated.deptId),
      } as UserResponseDto;
    }, { timeout: 10_000 });
  }

  /**
   * 删除用户，应用数据范围检查
   * 
   * 注意：这里演示物理删除，实际项目建议使用逻辑删除（设置 delFlag='1'）
   */
  async deleteUser(userId: string, principal: UserPrincipal): Promise<void> {
    const id = parseId(userId, 'userId');

    // 1. 解析数据范围
    const scope = await this.dataScope.resolveUserScope(principal.userId);
    const scopeWhere = await this.dataScope.buildUserWhereCondition(
      scope,
      principal.deptId,
      principal.userId,
    );

    return await this.prisma.$transaction(async (tx) => {
      // 2. 验证用户存在且有权访问
      const user = await tx.user.findFirst({
        where: {
          userId: id,
          ...scopeWhere,
        },
      });

      if (!user) {
        throw new ForbiddenException('无权删除该用户');
      }

      // 3. 删除关联数据
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userPost.deleteMany({ where: { userId: id } });

      // 4. 删除用户
      await tx.user.delete({ where: { userId: id } });

      this.logger.log(
        `User ${id} deleted by ${principal.userId} (scope: ${scope.kind})`,
      );
    }, { timeout: 10_000 });
  }

  /**
   * 批量删除用户，应用数据范围检查
   */
  async deleteUsers(userIds: string[], principal: UserPrincipal): Promise<number> {
    const ids = userIds.map(id => parseId(id, 'userId'));

    // 1. 解析数据范围
    const scope = await this.dataScope.resolveUserScope(principal.userId);
    const scopeWhere = await this.dataScope.buildUserWhereCondition(
      scope,
      principal.deptId,
      principal.userId,
    );

    return await this.prisma.$transaction(async (tx) => {
      // 2. 批量删除时也必须应用数据范围
      const result = await tx.user.deleteMany({
        where: {
          userId: { in: ids },
          ...scopeWhere, // 关键：只删除有权访问的用户
        },
      });

      if (result.count !== ids.length) {
        this.logger.warn(
          `Attempted to delete ${ids.length} users but only deleted ${result.count} due to scope restrictions`,
        );
      }

      return result.count;
    });
  }

  /**
   * 分配角色给用户
   */
  async assignRoles(
    userId: string,
    roleIds: string[],
    principal: UserPrincipal,
  ): Promise<void> {
    const id = parseId(userId, 'userId');
    const rids = roleIds.map(rid => parseId(rid, 'roleId'));

    // 1. 解析数据范围
    const scope = await this.dataScope.resolveUserScope(principal.userId);
    const scopeWhere = await this.dataScope.buildUserWhereCondition(
      scope,
      principal.deptId,
      principal.userId,
    );

    return await this.prisma.$transaction(async (tx) => {
      // 2. 验证用户存在且有权访问
      const user = await tx.user.findFirst({
        where: {
          userId: id,
          ...scopeWhere,
        },
      });

      if (!user) {
        throw new ForbiddenException('无权分配该用户的角色');
      }

      // 3. 验证所有角色存在
      if (rids.length > 0) {
        const roles = await tx.role.findMany({
          where: { roleId: { in: rids }, delFlag: '0' },
          select: { roleId: true },
        });
        if (roles.length !== rids.length) {
          throw new BadRequestException('部分角色不存在或已删除');
        }
      }

      // 4. 清除原有角色并分配新角色
      await tx.userRole.deleteMany({ where: { userId: id } });
      if (rids.length > 0) {
        await tx.userRole.createMany({
          data: rids.map(roleId => ({ userId: id, roleId })),
        });
      }

      // 5. 失效该用户的权限缓存
      // （这会在 PermissionService 中由权限版本号管理）
    });
  }
}
```

## 2. 增强版用户控制器

```typescript
// apps/gateway/src/modules/system/user/user.controller.enhanced.ts

import { PageResponseDto } from '@app/common/dto/base.dto.js';
import { CurrentUser } from '@app/auth';
import { UserPrincipal } from '@app/auth';
import { Permission } from '@app/permission';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { UserServiceEnhanced } from './user.service.enhanced.js';
import { ListUserDto } from './dto/list-user.dto.js';
import { UserIdParamDto } from './dto/user-id-param.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

/**
 * 增强版用户控制器
 * 
 * 与原控制器的区别：
 * - 所有数据操作都传入 principal（当前用户）
 * - 业务逻辑中应用数据范围检查
 * - 返回结果和错误处理遵循最小权限原则
 */
@Controller('system/user')
export class UserControllerEnhanced {
  constructor(private readonly userService: UserServiceEnhanced) {}

  /**
   * 获取用户列表，自动应用数据范围限制
   * 
   * 权限检查：@Permission('system:user:view')
   * 
   * 实际访问的数据取决于当前用户的数据范围：
   * - ALL：能看到所有用户
   * - DEPT：只能看到本部门用户
   * - DEPT_AND_CHILD：能看到本部门及子部门用户
   * - SELF：只能看到自己
   * - CUSTOM：只能看到指定部门的用户
   */
  @Get()
  @Permission('system:user:view')
  async listUsers(
    @Query() dto: ListUserDto,
    @CurrentUser() principal: UserPrincipal,
  ): Promise<PageResponseDto<UserResponseDto>> {
    return this.userService.listUsers(dto, principal);
  }

  /**
   * 获取用户详情，验证访问权限
   * 
   * 如果当前用户无权访问该用户，返回 404（与"用户不存在"相同响应）
   */
  @Get(':userId')
  @Permission('system:user:view')
  async getUserById(
    @Param() params: UserIdParamDto,
    @CurrentUser() principal: UserPrincipal,
  ): Promise<UserResponseDto> {
    return this.userService.getUserById(params.userId, principal);
  }

  /**
   * 创建用户
   * 
   * 数据范围限制：创建者可以访问的范围内
   * （例如如果创建者是 DEPT 范围，则只能创建本部门用户）
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permission('system:user:add')
  async createUser(
    @Body() dto: CreateUserDto,
    @CurrentUser() principal: UserPrincipal,
  ): Promise<UserResponseDto> {
    // 建议添加：验证目标部门在当前用户的数据范围内
    return this.userService.createUser(dto, principal);
  }

  /**
   * 更新用户
   * 
   * 数据范围限制：只能修改有权访问的用户
   */
  @Put(':userId')
  @Permission('system:user:edit')
  async updateUser(
    @Param() params: UserIdParamDto,
    @Body() dto: UpdateUserDto,
    @CurrentUser() principal: UserPrincipal,
  ): Promise<UserResponseDto> {
    return this.userService.updateUser(params.userId, dto, principal);
  }

  /**
   * 删除用户
   * 
   * 数据范围限制：只能删除有权访问的用户
   * 
   * 如果无权删除，返回 403 Forbidden
   */
  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permission('system:user:remove')
  async deleteUser(
    @Param() params: UserIdParamDto,
    @CurrentUser() principal: UserPrincipal,
  ): Promise<void> {
    return this.userService.deleteUser(params.userId, principal);
  }

  /**
   * 分配角色给用户
   * 
   * 数据范围限制：只能为有权访问的用户分配角色
   */
  @Put(':userId/roles')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permission('system:user:assign')
  async assignRoles(
    @Param() params: UserIdParamDto,
    @Body() dto: AssignRolesDto,
    @CurrentUser() principal: UserPrincipal,
  ): Promise<void> {
    return this.userService.assignRoles(params.userId, dto.roleIds, principal);
  }

  /**
   * 批量删除用户
   * 
   * 注意：批量删除也要应用数据范围限制
   * 结果会返回实际删除的数量
   */
  @Post('batch/delete')
  @HttpCode(HttpStatus.OK)
  @Permission('system:user:remove')
  async deleteUsers(
    @Body() dto: { userIds: string[] },
    @CurrentUser() principal: UserPrincipal,
  ): Promise<{ deletedCount: number }> {
    const deletedCount = await this.userService.deleteUsers(dto.userIds, principal);
    return { deletedCount };
  }
}
```

## 3. 部门服务集成

```typescript
// apps/gateway/src/modules/system/dept/dept.service.enhanced.ts

import { DataScopeService } from '@app/permission';

@Injectable()
export class DeptServiceEnhanced {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
  ) {}

  /**
   * 获取部门树
   * 
   * 根据当前用户的数据范围：
   * - ALL：获取完整部门树
   * - DEPT/DEPT_AND_CHILD：只获取用户所在部门的子树
   * - CUSTOM：只获取指定部门的子树
   */
  async getDeptTree(principal: UserPrincipal): Promise<DeptTreeDto[]> {
    // 1. 解析数据范围
    const scope = await this.dataScope.resolveUserScope(principal.userId);

    // 2. 根据范围决定查询起点
    let rootIds: bigint[] = [];

    switch (scope.kind) {
      case DataScope.ALL:
        // 获取所有根部门
        rootIds = (
          await this.prisma.dept.findMany({
            where: { parentId: 0n },
            select: { deptId: true },
          })
        ).map(d => d.deptId);
        break;

      case DataScope.DEPT:
      case DataScope.DEPT_AND_CHILD:
        // 获取用户所在部门及其子部门
        if (principal.deptId) {
          const childIds = await this.dataScope.getDeptChildrenIds(principal.deptId);
          // 查询这些部门中的根部门
          const roots = await this.prisma.dept.findMany({
            where: { deptId: { in: childIds }, parentId: 0n },
            select: { deptId: true },
          });
          rootIds = roots.map(d => d.deptId);
        }
        break;

      case DataScope.CUSTOM:
        // 获取指定部门的树
        rootIds = scope.deptIds;
        break;

      case DataScope.SELF:
        // 只显示用户自己的部门
        if (principal.deptId) {
          rootIds = [principal.deptId];
        }
        break;
    }

    // 3. 递归构建树
    return this.buildDeptTree(rootIds);
  }

  /**
   * 获取部门详情，应用数据范围检查
   */
  async getDeptById(
    deptId: string,
    principal: UserPrincipal,
  ): Promise<DeptResponseDto> {
    const id = parseId(deptId, 'deptId');

    // 1. 解析数据范围
    const scope = await this.dataScope.resolveUserScope(principal.userId);
    const scopeWhere = await this.dataScope.buildDeptWhereCondition(
      scope,
      principal.deptId,
      principal.userId,
    );

    // 2. 查询部门
    const dept = await this.prisma.dept.findFirst({
      where: {
        deptId: id,
        ...scopeWhere,
        delFlag: '0',
      },
    });

    if (!dept) {
      throw new NotFoundException('部门不存在或无权访问');
    }

    return plainToInstance(DeptResponseDto, dept);
  }
}
```

## 4. 操作日志服务集成

```typescript
// apps/gateway/src/modules/system/oper-log/oper-log.service.enhanced.ts

import { DataScopeService, ResourceType } from '@app/permission';

@Injectable()
export class OperLogServiceEnhanced {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
  ) {}

  /**
   * 查询操作日志
   * 
   * 根据当前用户的数据范围过滤日志：
   * - ALL：看到所有操作日志
   * - DEPT/DEPT_AND_CHILD：看到本部门及子部门用户的操作日志
   * - SELF：只看到自己的操作日志
   */
  async listOperLogs(
    dto: ListOperLogDto,
    principal: UserPrincipal,
  ): Promise<PageResponseDto<OperLogResponseDto>> {
    const { skip, take, page, pageSize } = paginate(dto);

    // 1. 解析数据范围
    const scope = await this.dataScope.resolveUserScope(principal.userId);
    const scopeWhere = await this.dataScope.buildOperLogWhereCondition(
      scope,
      principal.deptId,
      principal.userId,
    );

    // 2. 构建查询条件
    const where = {
      ...scopeWhere,
      ...(dto.operType && { operType: dto.operType }),
      ...(dto.startTime && { operTime: { gte: dto.startTime } }),
      ...(dto.endTime && { operTime: { lte: dto.endTime } }),
    };

    // 3. 查询
    const [items, total] = await Promise.all([
      this.prisma.operLog.findMany({
        where,
        skip,
        take,
        include: { operUser: { select: { userName: true, nickName: true } } },
        orderBy: { operTime: 'desc' },
      }),
      this.prisma.operLog.count({ where }),
    ]);

    return {
      items,
      meta: makePageMeta(page, pageSize, total),
    };
  }
}
```

## 5. 测试场景

```typescript
// test/data-scope.e2e.spec.ts

describe('DataScope E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    prisma = module.get(PrismaService);
    await app.init();
  });

  describe('User List Query with Different Scopes', () => {
    it('SELF scope: user can only see themselves', async () => {
      // Setup: 创建两个用户，都是 SELF 范围
      const dept = await createDept('部门1');
      const user1 = await createUser('user1', dept.deptId, 'SELF');
      const user2 = await createUser('user2', dept.deptId, 'SELF');

      // Act: user1 查询用户列表
      const response = await request(app.getHttpServer())
        .get('/system/user')
        .set('Authorization', `Bearer ${getToken(user1)}`);

      // Assert: user1 只能看到自己
      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].userId).toBe(user1.userId.toString());
    });

    it('DEPT scope: user can only see department members', async () => {
      const dept1 = await createDept('部门1');
      const dept2 = await createDept('部门2');
      
      const user1 = await createUser('user1', dept1.deptId);
      const user2 = await createUser('user2', dept1.deptId);
      const user3 = await createUser('user3', dept2.deptId);

      // 分配 DEPT 范围角色
      await assignRole(user1, 'DEPT');

      const response = await request(app.getHttpServer())
        .get('/system/user')
        .set('Authorization', `Bearer ${getToken(user1)}`);

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(2);
      expect(response.body.items.map(u => u.userId)).toContain(user1.userId.toString());
      expect(response.body.items.map(u => u.userId)).toContain(user2.userId.toString());
      expect(response.body.items.map(u => u.userId)).not.toContain(user3.userId.toString());
    });

    it('DEPT_AND_CHILD scope: user can see department and sub-departments', async () => {
      const parentDept = await createDept('父部门');
      const childDept = await createDept('子部门', parentDept.deptId);
      const otherDept = await createDept('其他部门');

      const user1 = await createUser('user1', parentDept.deptId);
      const user2 = await createUser('user2', childDept.deptId);
      const user3 = await createUser('user3', otherDept.deptId);

      await assignRole(user1, 'DEPT_AND_CHILD');

      const response = await request(app.getHttpServer())
        .get('/system/user')
        .set('Authorization', `Bearer ${getToken(user1)}`);

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(2);
      const userIds = response.body.items.map(u => u.userId);
      expect(userIds).toContain(user1.userId.toString());
      expect(userIds).toContain(user2.userId.toString());
      expect(userIds).not.toContain(user3.userId.toString());
    });

    it('CUSTOM scope: user can only see specified departments', async () => {
      const dept1 = await createDept('部门1');
      const dept2 = await createDept('部门2');
      const dept3 = await createDept('部门3');

      const user1 = await createUser('user1', dept1.deptId);
      const user2 = await createUser('user2', dept2.deptId);
      const user3 = await createUser('user3', dept3.deptId);

      // 分配 CUSTOM 范围角色，只指定 dept1 和 dept2
      const role = await assignRole(user1, 'CUSTOM');
      await assignRoleToDept(role.roleId, dept1.deptId);
      await assignRoleToDept(role.roleId, dept2.deptId);

      const response = await request(app.getHttpServer())
        .get('/system/user')
        .set('Authorization', `Bearer ${getToken(user1)}`);

      expect(response.status).toBe(200);
      expect(response.body.items.length).toBeGreaterThanOrEqual(2);
      const userIds = response.body.items.map(u => u.userId);
      expect(userIds).toContain(user1.userId.toString());
      expect(userIds).toContain(user2.userId.toString());
      expect(userIds).not.toContain(user3.userId.toString());
    });

    it('ALL scope: user can see all users', async () => {
      const dept1 = await createDept('部门1');
      const dept2 = await createDept('部门2');

      const user1 = await createUser('user1', dept1.deptId);
      const user2 = await createUser('user2', dept2.deptId);

      await assignRole(user1, 'ALL');

      const response = await request(app.getHttpServer())
        .get('/system/user')
        .set('Authorization', `Bearer ${getToken(user1)}`);

      expect(response.status).toBe(200);
      expect(response.body.items.length).toBeGreaterThanOrEqual(2);
      const userIds = response.body.items.map(u => u.userId);
      expect(userIds).toContain(user1.userId.toString());
      expect(userIds).toContain(user2.userId.toString());
    });
  });

  describe('Authorization Check', () => {
    it('SELF scope user cannot access other users details', async () => {
      const dept = await createDept('部门1');
      const user1 = await createUser('user1', dept.deptId);
      const user2 = await createUser('user2', dept.deptId);

      await assignRole(user1, 'SELF');

      const response = await request(app.getHttpServer())
        .get(`/system/user/${user2.userId}`)
        .set('Authorization', `Bearer ${getToken(user1)}`);

      // 返回 404（与不存在相同处理，不泄露权限信息）
      expect(response.status).toBe(404);
    });

    it('User cannot modify others outside their scope', async () => {
      const dept1 = await createDept('部门1');
      const dept2 = await createDept('部门2');

      const user1 = await createUser('user1', dept1.deptId);
      const user2 = await createUser('user2', dept2.deptId);

      await assignRole(user1, 'DEPT');

      const response = await request(app.getHttpServer())
        .put(`/system/user/${user2.userId}`)
        .set('Authorization', `Bearer ${getToken(user1)}`)
        .send({ nickName: 'hacked' });

      expect(response.status).toBe(403);
    });

    it('User cannot delete others outside their scope', async () => {
      const dept1 = await createDept('部门1');
      const dept2 = await createDept('部门2');

      const user1 = await createUser('user1', dept1.deptId);
      const user2 = await createUser('user2', dept2.deptId);

      await assignRole(user1, 'DEPT');

      const response = await request(app.getHttpServer())
        .delete(`/system/user/${user2.userId}`)
        .set('Authorization', `Bearer ${getToken(user1)}`);

      expect(response.status).toBe(403);

      // 验证用户未被删除
      const user = await prisma.user.findUnique({
        where: { userId: user2.userId },
      });
      expect(user).toBeDefined();
    });
  });

  describe('Batch Operations', () => {
    it('Batch delete respects scope restrictions', async () => {
      const dept1 = await createDept('部门1');
      const dept2 = await createDept('部门2');

      const user1 = await createUser('user1', dept1.deptId);
      const user2 = await createUser('user2', dept1.deptId);
      const user3 = await createUser('user3', dept2.deptId);

      await assignRole(user1, 'DEPT');

      const response = await request(app.getHttpServer())
        .post('/system/user/batch/delete')
        .set('Authorization', `Bearer ${getToken(user1)}`)
        .send({
          userIds: [user2.userId.toString(), user3.userId.toString()],
        });

      expect(response.status).toBe(200);
      // 只能删除 user2（同部门），user3 在范围外
      expect(response.body.deletedCount).toBe(1);

      // 验证只删除了 user2
      const remaining2 = await prisma.user.findUnique({
        where: { userId: user2.userId },
      });
      expect(remaining2).toBeNull();

      const remaining3 = await prisma.user.findUnique({
        where: { userId: user3.userId },
      });
      expect(remaining3).toBeDefined();
    });
  });
});
```

## 最佳实践总结

1. **始终解析范围**：每个需要数据范围的操作都要调用 `resolveUserScope`
2. **构建正确的 where 条件**：根据资源类型调用对应的 `buildXxxWhereCondition`
3. **合并条件**：使用 `DataScopeService.mergeWhereConditions` 合并范围条件和业务条件
4. **应用到所有操作**：列表、详情、编辑、删除都要应用范围检查
5. **返回一致的错误**：无权访问返回 404（与不存在相同），改善安全性
6. **批量操作验证**：批量操作要检查实际操作数是否符合预期
7. **传递 principal**：从控制器层传入当前用户信息到服务层

这样可以确保整个系统中的数据权限控制是一致的、完整的、安全的。
