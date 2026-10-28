import { andWhere, makePageMeta, PageResponseDto, paginate, toDto, toPageDto } from '@app/common';
import { PrismaService } from '@app/database';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MenuService } from '../menu/menu.service.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { ListRoleDto } from './dto/list-role.dto.js';
import { RoleResponseDto } from './dto/role-response.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';

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
   * @param roleId 角色 ID（bigint）
   * @returns 角色详情
   */
  async getRoleById(roleId: bigint): Promise<RoleResponseDto> {
    const role = await this.prisma.role.findUnique({
      where: { roleId },
    });

    if (!role) {
      throw new NotFoundException(`角色 ${roleId} 不存在`);
    }

    return toDto(RoleResponseDto, role);
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

    return toDto(RoleResponseDto, role);
  }

  /**
   * 更新角色
   * @param roleId 角色 ID（bigint）
   * @param dto 更新角色 DTO
   * @returns 更新后的角色
   */
  async updateRole(roleId: bigint, dto: UpdateRoleDto): Promise<RoleResponseDto> {
    // 检查角色是否存在
    const existing = await this.prisma.role.findUnique({ where: { roleId } });
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
      where: { roleId },
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

    return toDto(RoleResponseDto, role);
  }

  /**
   * 删除角色
   * @param roleId 角色 ID（bigint）
   */
  async deleteRole(roleId: bigint): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        const role = await tx.role.findUnique({
          where: { roleId },
          include: {
            users: true,
          },
        });

        if (!role) {
          throw new NotFoundException(`角色 ${roleId} 不存在`);
        }

        // 检查是否有用户引用
        if (role.users.length > 0) {
          throw new BadRequestException(`角色 ${roleId} 被用户引用，无法删除。请先解除用户关联。`);
        }

        // 删除角色菜单关联
        await tx.roleMenu.deleteMany({ where: { roleId } });

        // 删除角色权限关联
        await tx.rolePermission.deleteMany({ where: { roleId } });

        // 删除角色部门关联
        await tx.roleDept.deleteMany({ where: { roleId } });

        // 删除角色
        await tx.role.delete({ where: { roleId } });

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
            OR: [{ roleName: { contains: dto.search } }, { roleKey: { contains: dto.search } }],
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

    return toPageDto(RoleResponseDto, {
      items,
      meta: makePageMeta(page, pageSize, total),
    });
  }

  /**
   * 分配菜单给角色（委托给 MenuService）
   * @param roleId 角色 ID（bigint）
   * @param menuIds 菜单 ID 列表（bigint 数组）
   */
  async assignMenus(roleId: bigint, menuIds: bigint[]): Promise<void> {
    return this.menuService.assignMenusToRole(roleId, menuIds);
  }

  /**
   * 分配部门给角色（数据范围自定义）
   * @param roleId 角色 ID（bigint）
   * @param deptIds 部门 ID 列表（bigint 数组）
   */
  async assignDepts(roleId: bigint, deptIds: bigint[]): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        // 检查角色是否存在
        const role = await tx.role.findUnique({ where: { roleId } });
        if (!role) {
          throw new NotFoundException(`角色 ${roleId} 不存在`);
        }

        // 验证部门存在
        if (deptIds.length > 0) {
          const depts = await tx.dept.findMany({
            where: { deptId: { in: deptIds } },
          });
          if (depts.length !== deptIds.length) {
            throw new BadRequestException('部分部门不存在');
          }
        }

        // 清除原有关联
        await tx.roleDept.deleteMany({ where: { roleId } });

        // 创建新关联
        if (deptIds.length > 0) {
          await tx.roleDept.createMany({
            data: deptIds.map((deptId) => ({ roleId, deptId })),
            skipDuplicates: true,
          });
        }

        this.logger.log(`Assigned ${deptIds.length} depts to role ${roleId}`);
      },
      { timeout: 10_000 },
    );
  }
}
