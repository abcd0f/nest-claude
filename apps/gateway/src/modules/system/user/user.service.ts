import { PageResponseDto } from '@app/common/dto/base.dto.js';
import { parseId } from '@app/common/utils/bigint.util.js';
import { makePageMeta, paginate } from '@app/common/utils/page.util.js';
import { andWhere } from '@app/common/utils/where.util.js';
import { PrismaService } from '@app/database';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { CreateUserDto } from './dto/create-user.dto.js';
import { ListUserDto } from './dto/list-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';

/**
 * 用户服务
 *
 * 职责：
 * - 用户 CRUD
 * - 角色和职位分配
 * - 密码重置
 * - 列表查询
 */
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 获取用户详情
   * @param userId 用户 ID（字符串）
   * @returns 用户详情
   */
  async getUserById(userId: string): Promise<UserResponseDto> {
    const id = parseId(userId, 'userId');
    const user = await this.prisma.user.findUnique({
      where: { userId: id },
    });

    if (!user) {
      throw new NotFoundException(`用户 ${userId} 不存在`);
    }

    return plainToInstance(UserResponseDto, user, { excludeExtraneousValues: true });
  }

  /**
   * 创建用户
   * @param dto 创建用户 DTO
   * @returns 创建的用户
   */
  async createUser(dto: CreateUserDto): Promise<UserResponseDto> {
    const deptId = dto.deptId ? parseId(dto.deptId, 'deptId') : null;
    const roleIds = dto.roleIds?.map((rid) => parseId(rid, 'roleId')) || [];
    const postIds = dto.postIds?.map((pid) => parseId(pid, 'postId')) || [];

    return await this.prisma.$transaction(
      async (tx) => {
        // 检查用户名是否重复
        const existing = await tx.user.findFirst({
          where: { userName: dto.userName },
        });

        if (existing) {
          throw new BadRequestException(`用户名 ${dto.userName} 已存在`);
        }

        // 验证部门存在
        if (deptId) {
          const dept = await tx.dept.findUnique({ where: { deptId } });
          if (!dept) {
            throw new BadRequestException(`部门 ${dto.deptId} 不存在`);
          }
        }

        // 验证角色存在
        if (roleIds.length > 0) {
          const roles = await tx.role.findMany({
            where: { roleId: { in: roleIds } },
          });
          if (roles.length !== roleIds.length) {
            throw new BadRequestException('部分角色不存在');
          }
        }

        // 验证职位存在
        if (postIds.length > 0) {
          const posts = await tx.post.findMany({
            where: { postId: { in: postIds } },
          });
          if (posts.length !== postIds.length) {
            throw new BadRequestException('部分职位不存在');
          }
        }

        // 创建用户
        const user = await tx.user.create({
          data: {
            userName: dto.userName,
            nickName: dto.nickName,
            email: dto.email,
            phoneNumber: dto.phoneNumber,
            sex: dto.sex ?? '2',
            password: dto.password, // 实际应使用 bcrypt 加密
            status: dto.status ?? '0',
            deptId,
            remark: dto.remark,
          },
        });

        // 分配角色
        if (roleIds.length > 0) {
          await tx.userRole.createMany({
            data: roleIds.map((roleId) => ({ userId: user.userId, roleId })),
            skipDuplicates: true,
          });
        }

        // 分配职位
        if (postIds.length > 0) {
          await tx.userPost.createMany({
            data: postIds.map((postId) => ({ userId: user.userId, postId })),
            skipDuplicates: true,
          });
        }

        this.logger.log(`Created user ${user.userId}: ${user.userName}`);

        return plainToInstance(UserResponseDto, user, { excludeExtraneousValues: true });
      },
      { timeout: 10_000 },
    );
  }

  /**
   * 更新用户
   * @param userId 用户 ID（字符串）
   * @param dto 更新用户 DTO
   * @returns 更新后的用户
   */
  async updateUser(userId: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    const id = parseId(userId, 'userId');
    const deptId = dto.deptId ? parseId(dto.deptId, 'deptId') : undefined;
    const roleIds = dto.roleIds?.map((rid) => parseId(rid, 'roleId'));
    const postIds = dto.postIds?.map((pid) => parseId(pid, 'postId'));

    return await this.prisma.$transaction(
      async (tx) => {
        // 检查用户是否存在
        const existing = await tx.user.findUnique({ where: { userId: id } });
        if (!existing) {
          throw new NotFoundException(`用户 ${userId} 不存在`);
        }

        // 验证部门存在
        if (deptId) {
          const dept = await tx.dept.findUnique({ where: { deptId } });
          if (!dept) {
            throw new BadRequestException(`部门 ${dto.deptId} 不存在`);
          }
        }

        // 验证角色存在
        if (roleIds && roleIds.length > 0) {
          const roles = await tx.role.findMany({
            where: { roleId: { in: roleIds } },
          });
          if (roles.length !== roleIds.length) {
            throw new BadRequestException('部分角色不存在');
          }
        }

        // 验证职位存在
        if (postIds && postIds.length > 0) {
          const posts = await tx.post.findMany({
            where: { postId: { in: postIds } },
          });
          if (posts.length !== postIds.length) {
            throw new BadRequestException('部分职位不存在');
          }
        }

        // 更新用户
        const user = await tx.user.update({
          where: { userId: id },
          data: {
            ...(dto.nickName && { nickName: dto.nickName }),
            ...(dto.email !== undefined && { email: dto.email }),
            ...(dto.phoneNumber !== undefined && { phoneNumber: dto.phoneNumber }),
            ...(dto.sex && { sex: dto.sex }),
            ...(dto.status && { status: dto.status }),
            ...(deptId !== undefined && { deptId }),
            updateTime: new Date(),
            remark: dto.remark,
          },
        });

        // 更新角色关联
        if (roleIds !== undefined) {
          await tx.userRole.deleteMany({ where: { userId: id } });
          if (roleIds.length > 0) {
            await tx.userRole.createMany({
              data: roleIds.map((roleId) => ({ userId: id, roleId })),
              skipDuplicates: true,
            });
          }
        }

        // 更新职位关联
        if (postIds !== undefined) {
          await tx.userPost.deleteMany({ where: { userId: id } });
          if (postIds.length > 0) {
            await tx.userPost.createMany({
              data: postIds.map((postId) => ({ userId: id, postId })),
              skipDuplicates: true,
            });
          }
        }

        this.logger.log(`Updated user ${user.userId}: ${user.userName}`);

        return plainToInstance(UserResponseDto, user, { excludeExtraneousValues: true });
      },
      { timeout: 10_000 },
    );
  }

  /**
   * 删除用户
   * @param userId 用户 ID（字符串）
   */
  async deleteUser(userId: string): Promise<void> {
    const id = parseId(userId, 'userId');

    await this.prisma.$transaction(
      async (tx) => {
        const user = await tx.user.findUnique({ where: { userId: id } });

        if (!user) {
          throw new NotFoundException(`用户 ${userId} 不存在`);
        }

        // 删除用户角色关联
        await tx.userRole.deleteMany({ where: { userId: id } });

        // 删除用户职位关联
        await tx.userPost.deleteMany({ where: { userId: id } });

        // 删除用户
        await tx.user.delete({ where: { userId: id } });

        this.logger.log(`Deleted user ${userId}`);
      },
      { timeout: 10_000 },
    );
  }

  /**
   * 获取用户列表
   * @param dto 列表查询 DTO
   * @returns 分页响应
   */
  async listUsers(dto: ListUserDto): Promise<PageResponseDto<UserResponseDto>> {
    const { skip, take, page, pageSize } = paginate({
      page: dto.page,
      pageSize: dto.pageSize,
    });

    const deptId = dto.deptId ? parseId(dto.deptId, 'deptId') : undefined;

    const where = andWhere(
      deptId ? { deptId } : null,
      dto.status ? { status: dto.status } : null,
      dto.search
        ? {
            OR: [{ userName: { contains: dto.search } }, { nickName: { contains: dto.search } }],
          }
        : null,
      { delFlag: '0' },
    );

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createTime: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const userDtos = items.map((item) =>
      plainToInstance(UserResponseDto, item, { excludeExtraneousValues: true }),
    );

    return {
      items: userDtos,
      meta: makePageMeta(page, pageSize, total),
    };
  }

  /**
   * 分配角色给用户
   * @param userId 用户 ID（字符串）
   * @param roleIds 角色 ID 列表（字符串数组）
   */
  async assignRoles(userId: string, roleIds: string[]): Promise<void> {
    const id = parseId(userId, 'userId');
    const ids = roleIds.map((rid) => parseId(rid, 'roleId'));

    await this.prisma.$transaction(
      async (tx) => {
        // 检查用户是否存在
        const user = await tx.user.findUnique({ where: { userId: id } });
        if (!user) {
          throw new NotFoundException(`用户 ${userId} 不存在`);
        }

        // 验证角色存在
        if (ids.length > 0) {
          const roles = await tx.role.findMany({
            where: { roleId: { in: ids } },
          });
          if (roles.length !== ids.length) {
            throw new BadRequestException('部分角色不存在');
          }
        }

        // 清除原有关联
        await tx.userRole.deleteMany({ where: { userId: id } });

        // 创建新关联
        if (ids.length > 0) {
          await tx.userRole.createMany({
            data: ids.map((roleId) => ({ userId: id, roleId })),
            skipDuplicates: true,
          });
        }

        this.logger.log(`Assigned ${ids.length} roles to user ${userId}`);
      },
      { timeout: 10_000 },
    );
  }

  /**
   * 分配职位给用户
   * @param userId 用户 ID（字符串）
   * @param postIds 职位 ID 列表（字符串数组）
   */
  async assignPosts(userId: string, postIds: string[]): Promise<void> {
    const id = parseId(userId, 'userId');
    const ids = postIds.map((pid) => parseId(pid, 'postId'));

    await this.prisma.$transaction(
      async (tx) => {
        // 检查用户是否存在
        const user = await tx.user.findUnique({ where: { userId: id } });
        if (!user) {
          throw new NotFoundException(`用户 ${userId} 不存在`);
        }

        // 验证职位存在
        if (ids.length > 0) {
          const posts = await tx.post.findMany({
            where: { postId: { in: ids } },
          });
          if (posts.length !== ids.length) {
            throw new BadRequestException('部分职位不存在');
          }
        }

        // 清除原有关联
        await tx.userPost.deleteMany({ where: { userId: id } });

        // 创建新关联
        if (ids.length > 0) {
          await tx.userPost.createMany({
            data: ids.map((postId) => ({ userId: id, postId })),
            skipDuplicates: true,
          });
        }

        this.logger.log(`Assigned ${ids.length} posts to user ${userId}`);
      },
      { timeout: 10_000 },
    );
  }

  /**
   * 重置用户密码
   * @param userId 用户 ID（字符串）
   * @param newPassword 新密码
   */
  async resetPassword(userId: string, newPassword: string): Promise<void> {
    const id = parseId(userId, 'userId');

    const user = await this.prisma.user.findUnique({ where: { userId: id } });
    if (!user) {
      throw new NotFoundException(`用户 ${userId} 不存在`);
    }

    await this.prisma.user.update({
      where: { userId: id },
      data: {
        password: newPassword, // 实际应使用 bcrypt 加密
        updateTime: new Date(),
      },
    });

    this.logger.log(`Reset password for user ${userId}`);
  }
}
