import { parseId } from '@app/common/utils/bigint.util.js';
import { PrismaService } from '@app/database';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { paginate, makePageMeta } from '@app/common/utils/page.util.js';
import { andWhere } from '@app/common/utils/where.util.js';
import { PageResponseDto } from '@app/common/dto/base.dto.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { RoleResponseDto } from './dto/role-response.dto.js';
import { ListRoleDto } from './dto/list-role.dto.js';
import { MenuService } from '../menu/menu.service.js';

/**
 * 角色服务
 *
 * 职责：
 * - 角色 CRUD
 * - 菜单分配（委托给 MenuService）
 * - 数据范围管理
 * - 列表查询
 */
@Injectable()
export class RoleService {
  private readonly logger = new Logger(RoleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly menuService: MenuService,
  ) {}

  /**
   * 获取角色详情
   * @param roleId 角色 ID（字符串）
   * @returns 角色详情
   */
  async getRoleById(roleId: string): Promise<RoleResponseDto> {
    const id = parseId(roleId, 'roleId');
    const role = await this.prisma.role.findUnique({
      where: { roleId: id },
    });

    if (!role) {
      throw new NotFoundException(`角色 ${roleId} 不存在`);
    }

    return plainToInstance(RoleResponseDto, role, { excludeExtraneousValues: true });
  }

  /**
   * 创建角色
   * @param dto 创建角色 DTO
   * @returns 创建的角色
   */
  async createRole(dto: CreateRoleDto): Promise<RoleResponseDto> {
    // 检查角色编码是否重复
    const existing = await this.prisma.role.findFirst({
      where: { roleKey: dto.roleKey },
    });

    if (existing) {
      throw new BadRequestException(`角色编码 ${dto.roleKey} 已存在`);
    }

    const role = await this.prisma.role.create({
      data: {
        roleName: dto.roleName,
        roleKey: dto.roleKey,
        orderNum: dto.orderNum ?? 0,
        dataScope: dto.dataScope ?? '4',
        status: dto.status ?? '0',
        remark: dto.remark,
      },
    });

    this.logger.log(`Created role ${role.roleId}: ${role.roleName}`);

    return plainToInstance(RoleResponseDto, role, { excludeExtraneousValues: true });
  }

  /**
   * 更新角色
   * @param roleId 角色 ID（字符串）
   * @param dto 更新角色 DTO
   * @returns 更新后的角色
   */
  async updateRole(roleId: string, dto: UpdateRoleDto): Promise<RoleResponseDto> {
    const id = parseId(roleId, 'roleId');

    // 检查角色是否存在
    const existing = await this.prisma.role.findUnique({ where: { roleId: id } });
    if (!existing) {
      throw new NotFoundException(`角色 ${roleId} 不存在`);
    }

    // 如果更改角色编码，检查是否重复
    if (dto.roleKey && dto.roleKey !== existing.roleKey) {
      const conflict = await this.prisma.role.findFirst({
        where: { roleKey: dto.roleKey },
      });
      if (conflict) {
        throw new BadRequestException(`角色编码 ${dto.roleKey} 已存在`);
      }
    }

    const role = await this.prisma.role.update({
      where: { roleId: id },
      data: {
        ...(dto.roleName && { roleName: dto.roleName }),
        ...(dto.roleKey && { roleKey: dto.roleKey }),
        ...(dto.orderNum !== undefined && { orderNum: dto.orderNum }),
        ...(dto.dataScope && { dataScope: dto.dataScope }),
        ...(dto.status && { status: dto.status }),
        updateTime: new Date(),
        remark: dto.remark,
      },
    });

    this.logger.log(`Updated role ${role.roleId}: ${role.roleName}`);

    return plainToInstance(RoleResponseDto, role, { excludeExtraneousValues: true });
  }

  /**
   * 删除角色
   * @param roleId 角色 ID（字符串）
   */
  async deleteRole(roleId: string): Promise<void> {
    const id = parseId(roleId, 'roleId');

    await this.prisma.$transaction(
      async (tx) => {
        const role = await tx.role.findUnique({
          where: { roleId: id },
          include: {
            users: true,
          },
        });

        if (!role) {
          throw new NotFoundException(`角色 ${roleId} 不存在`);
        }

        // 检查是否有用户引用
        if (role.users.length > 0) {
          throw new BadRequestException(
            `角色 ${roleId} 被用户引用，无法删除。请先解除用户关联。`,
          );
        }

        // 删除角色菜单关联
        await tx.roleMenu.deleteMany({ where: { roleId: id } });

        // 删除角色权限关联
        await tx.rolePermission.deleteMany({ where: { roleId: id } });

        // 删除角色部门关联
        await tx.roleDept.deleteMany({ where: { roleId: id } });

        // 删除角色
        await tx.role.delete({ where: { roleId: id } });

        this.logger.log(`Deleted role ${roleId}`);
      },
      { timeout: 10_000 },
    );
  }

  /**
   * 获取角色列表
   * @param dto 列表查询 DTO
   * @returns 分页响应
   */
  async listRoles(dto: ListRoleDto): Promise<PageResponseDto<RoleResponseDto>> {
    const { skip, take, page, pageSize } = paginate({
      page: dto.page,
      pageSize: dto.pageSize,
    });

    const where = andWhere(
      dto.status ? { status: dto.status } : null,
      dto.search
        ? {
            OR: [
              { roleName: { contains: dto.search } },
              { roleKey: { contains: dto.search } },
            ],
          }
        : null,
      { delFlag: '0' },
    );

    const [items, total] = await Promise.all([
      this.prisma.role.findMany({
        where,
        skip,
        take,
        orderBy: { orderNum: 'asc' },
      }),
      this.prisma.role.count({ where }),
    ]);

    const roleDtos = items.map((item) =>
      plainToInstance(RoleResponseDto, item, { excludeExtraneousValues: true }),
    );

    return {
      items: roleDtos,
      meta: makePageMeta(page, pageSize, total),
    };
  }

  /**
   * 分配菜单给角色（委托给 MenuService）
   * @param roleId 角色 ID（字符串）
   * @param menuIds 菜单 ID 列表（字符串数组）
   */
  async assignMenus(roleId: string, menuIds: string[]): Promise<void> {
    return this.menuService.assignMenusToRole(roleId, menuIds);
  }

  /**
   * 分配部门给角色（数据范围自定义）
   * @param roleId 角色 ID（字符串）
   * @param deptIds 部门 ID 列表（字符串数组）
   */
  async assignDepts(roleId: string, deptIds: string[]): Promise<void> {
    const id = parseId(roleId, 'roleId');
    const ids = deptIds.map((did) => parseId(did, 'deptId'));

    await this.prisma.$transaction(
      async (tx) => {
        // 检查角色是否存在
        const role = await tx.role.findUnique({ where: { roleId: id } });
        if (!role) {
          throw new NotFoundException(`角色 ${roleId} 不存在`);
        }

        // 验证部门存在
        if (ids.length > 0) {
          const depts = await tx.dept.findMany({
            where: { deptId: { in: ids } },
          });
          if (depts.length !== ids.length) {
            throw new BadRequestException('部分部门不存在');
          }
        }

        // 清除原有关联
        await tx.roleDept.deleteMany({ where: { roleId: id } });

        // 创建新关联
        if (ids.length > 0) {
          await tx.roleDept.createMany({
            data: ids.map((deptId) => ({ roleId: id, deptId })),
            skipDuplicates: true,
          });
        }

        this.logger.log(`Assigned ${ids.length} depts to role ${roleId}`);
      },
      { timeout: 10_000 },
    );
  }
}
