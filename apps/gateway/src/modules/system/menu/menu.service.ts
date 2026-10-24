import { PrismaService } from '@app/database';
import { parseId } from '@app/common/utils/bigint.util.js';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateMenuDto } from './dto/create-menu.dto.js';
import { UpdateMenuDto } from './dto/update-menu.dto.js';
import { MenuResponseDto, MenuTreeDto } from './dto/menu-response.dto.js';
import { RoleMenuTreeDto } from './dto/role-menu-tree.dto.js';
import { plainToInstance } from 'class-transformer';

/**
 * 菜单服务
 *
 * 职责：
 * - 菜单 CRUD
 * - 菜单树构建
 * - 菜单-权限同步
 * - 角色菜单授权
 */
@Injectable()
export class MenuService {
  private readonly logger = new Logger(MenuService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 获取菜单树
   * @returns 菜单树结构
   */
  async getMenuTree(): Promise<MenuTreeDto[]> {
    const menus = await this.prisma.menu.findMany({
      orderBy: [{ orderNum: 'asc' }, { menuId: 'asc' }],
    });

    const menuDtos = menus.map((menu) =>
      plainToInstance(MenuResponseDto, menu, { excludeExtraneousValues: true }),
    );

    return this.buildTree(menuDtos, 0n);
  }

  /**
   * 获取菜单详情
   * @param menuId 菜单 ID（字符串）
   * @returns 菜单详情
   */
  async getMenuById(menuId: string): Promise<MenuResponseDto> {
    const id = parseId(menuId, 'menuId');
    const menu = await this.prisma.menu.findUnique({
      where: { menuId: id },
    });

    if (!menu) {
      throw new NotFoundException(`菜单 ${menuId} 不存在`);
    }

    return plainToInstance(MenuResponseDto, menu, { excludeExtraneousValues: true });
  }

  /**
   * 创建菜单
   * @param dto 创建菜单 DTO
   * @returns 创建的菜单
   */
  async createMenu(dto: CreateMenuDto): Promise<MenuResponseDto> {
    const parentId = parseId(dto.parentId, 'parentId');

    // 校验菜单类型与字段匹配
    this.validateMenuTypeFields(dto);

    // 校验父菜单存在（非根节点）
    if (parentId !== 0n) {
      await this.checkParentExists(parentId);
    }

    return await this.prisma.$transaction(
      async (tx) => {
        // 创建菜单
        const menu = await tx.menu.create({
          data: {
            parentId,
            menuName: dto.menuName,
            menuType: dto.menuType,
            orderNum: dto.orderNum,
            path: dto.path,
            component: dto.component,
            query: dto.query,
            isFrame: dto.isFrame ?? '1',
            isCache: dto.isCache ?? '0',
            visible: dto.visible ?? '0',
            status: dto.status ?? '0',
            perms: dto.perms?.trim() || null,
            icon: dto.icon,
            remark: dto.remark,
          },
        });

        // 同步权限表
        await this.syncPermissionFromMenu(tx, menu);

        this.logger.log(`Created menu ${menu.menuId}: ${menu.menuName}`);

        return plainToInstance(MenuResponseDto, menu, { excludeExtraneousValues: true });
      },
      { timeout: 10_000 },
    );
  }

  /**
   * 更新菜单
   * @param menuId 菜单 ID（字符串）
   * @param dto 更新菜单 DTO
   * @returns 更新后的菜单
   */
  async updateMenu(menuId: string, dto: UpdateMenuDto): Promise<MenuResponseDto> {
    const id = parseId(menuId, 'menuId');
    const parentId = parseId(dto.parentId, 'parentId');

    // 校验菜单类型与字段匹配
    this.validateMenuTypeFields(dto);

    // 校验父菜单存在且不形成环
    if (parentId !== 0n) {
      await this.checkParentValid(parentId, id);
    }

    return await this.prisma.$transaction(
      async (tx) => {
        // 检查菜单是否存在
        const existing = await tx.menu.findUnique({
          where: { menuId: id },
        });

        if (!existing) {
          throw new NotFoundException(`菜单 ${menuId} 不存在`);
        }

        // 更新菜单
        const menu = await tx.menu.update({
          where: { menuId: id },
          data: {
            parentId,
            menuName: dto.menuName,
            menuType: dto.menuType,
            orderNum: dto.orderNum,
            path: dto.path,
            component: dto.component,
            query: dto.query,
            isFrame: dto.isFrame,
            isCache: dto.isCache,
            visible: dto.visible,
            status: dto.status,
            perms: dto.perms?.trim() || null,
            icon: dto.icon,
            remark: dto.remark,
            updateTime: new Date(),
          },
        });

        // 同步权限表
        await this.syncPermissionFromMenu(tx, menu);

        this.logger.log(`Updated menu ${menu.menuId}: ${menu.menuName}`);

        return plainToInstance(MenuResponseDto, menu, { excludeExtraneousValues: true });
      },
      { timeout: 10_000 },
    );
  }

  /**
   * 删除菜单
   * @param menuId 菜单 ID（字符串）
   */
  async deleteMenu(menuId: string): Promise<void> {
    const id = parseId(menuId, 'menuId');

    await this.prisma.$transaction(
      async (tx) => {
        // 检查菜单是否存在
        const menu = await tx.menu.findUnique({
          where: { menuId: id },
          include: {
            permission: {
              include: {
                roles: true,
              },
            },
          },
        });

        if (!menu) {
          throw new NotFoundException(`菜单 ${menuId} 不存在`);
        }

        // 检查是否有子菜单
        const childCount = await tx.menu.count({
          where: { parentId: id },
        });

        if (childCount > 0) {
          throw new BadRequestException(`菜单 ${menuId} 存在子菜单，无法删除`);
        }

        // 检查权限是否被角色引用
        if (menu.permission && menu.permission.roles.length > 0) {
          throw new BadRequestException(
            `菜单 ${menuId} 关联的权限被角色引用，无法删除。请先取消角色授权。`,
          );
        }

        // 删除权限（如果存在且未被引用）
        if (menu.permission) {
          await tx.permission.delete({
            where: { permissionId: menu.permission.permissionId },
          });
        }

        // 删除菜单
        await tx.menu.delete({
          where: { menuId: id },
        });

        this.logger.log(`Deleted menu ${menuId}`);
      },
      { timeout: 10_000 },
    );
  }

  /**
   * 获取角色的菜单树
   * @param roleId 角色 ID（字符串）
   * @returns 角色菜单树和已选中的菜单 ID
   */
  async getRoleMenuTree(roleId: string): Promise<RoleMenuTreeDto> {
    const id = parseId(roleId, 'roleId');

    // 获取所有启用的菜单
    const allMenus = await this.prisma.menu.findMany({
      where: {
        status: '0',
      },
      orderBy: [{ orderNum: 'asc' }, { menuId: 'asc' }],
    });

    // 获取角色已分配的菜单 ID
    const roleMenus = await this.prisma.roleMenu.findMany({
      where: { roleId: id },
      select: { menuId: true },
    });

    const checkedKeys = roleMenus.map((rm) => rm.menuId.toString());

    const menuDtos = allMenus.map((menu) =>
      plainToInstance(MenuResponseDto, menu, { excludeExtraneousValues: true }),
    );

    const tree = this.buildTree(menuDtos, 0n);

    return plainToInstance(
      RoleMenuTreeDto,
      { menus: tree, checkedKeys },
      { excludeExtraneousValues: true },
    );
  }

  /**
   * 分配菜单给角色
   * 同时同步 RoleMenu 和 RolePermission
   *
   * @param roleId 角色 ID（字符串）
   * @param menuIds 菜单 ID 列表（字符串数组）
   */
  async assignMenusToRole(roleId: string, menuIds: string[]): Promise<void> {
    const id = parseId(roleId, 'roleId');
    const ids = menuIds.map((mid) => parseId(mid, 'menuId'));

    await this.prisma.$transaction(
      async (tx) => {
        // 1. 清除原有关联
        await tx.roleMenu.deleteMany({ where: { roleId: id } });
        await tx.rolePermission.deleteMany({ where: { roleId: id } });

        if (ids.length === 0) {
          this.logger.log(`Cleared all menus for role ${roleId}`);
          return;
        }

        // 2. 批量查询菜单
        const menus = await tx.menu.findMany({
          where: {
            menuId: { in: ids },
            status: '0',
          },
          include: {
            permission: {
              select: { permissionId: true, status: true },
            },
          },
        });

        if (menus.length !== ids.length) {
          throw new BadRequestException('部分菜单不存在或已停用');
        }

        // 3. 创建 RoleMenu
        await tx.roleMenu.createMany({
          data: menus.map((m) => ({ roleId: id, menuId: m.menuId })),
          skipDuplicates: true,
        });

        // 4. 创建 RolePermission（仅 C/F 且有权限且权限启用的菜单）
        const permissions = menus
          .filter((m) => m.permission && m.permission.status === '0')
          .map((m) => ({ roleId: id, permissionId: m.permission!.permissionId }));

        if (permissions.length > 0) {
          await tx.rolePermission.createMany({
            data: permissions,
            skipDuplicates: true,
          });
        }

        this.logger.log(
          `Assigned ${menus.length} menus and ${permissions.length} permissions to role ${roleId}`,
        );
      },
      { timeout: 10_000 },
    );
  }

  /**
   * 同步菜单的权限记录
   * 核心逻辑：
   * 1. M 类型不产生权限
   * 2. C/F 类型但没有 perms，解除权限绑定
   * 3. C/F 类型有 perms，创建或更新权限
   */
  private async syncPermissionFromMenu(tx: any, menu: any): Promise<void> {
    // M 类型不产生权限
    if (menu.menuType === 'M') {
      return;
    }

    // C/F 类型但没有 perms，解除权限绑定
    if (!menu.perms) {
      const existing = await tx.permission.findUnique({
        where: { menuId: menu.menuId },
      });
      if (existing) {
        await tx.permission.update({
          where: { permissionId: existing.permissionId },
          data: { menuId: null },
        });
        this.logger.debug(`Unlinked permission from menu ${menu.menuId}`);
      }
      return;
    }

    // 检查权限编码是否被其它菜单占用
    const conflict = await tx.permission.findFirst({
      where: {
        code: menu.perms,
        menuId: { not: menu.menuId },
      },
    });

    if (conflict) {
      throw new ConflictException(`权限编码 ${menu.perms} 已被其它菜单占用`);
    }

    // 获取或创建权限
    const existing = await tx.permission.findUnique({
      where: { menuId: menu.menuId },
    });

    if (existing) {
      // 更新权限
      await tx.permission.update({
        where: { permissionId: existing.permissionId },
        data: {
          code: menu.perms,
          name: menu.menuName,
          status: menu.status,
        },
      });
      this.logger.debug(`Updated permission for menu ${menu.menuId}`);
    } else {
      // 检查是否已存在相同 code 的权限（未绑定菜单）
      const existingByCode = await tx.permission.findUnique({
        where: { code: menu.perms },
      });

      if (existingByCode) {
        // 绑定到当前菜单
        await tx.permission.update({
          where: { permissionId: existingByCode.permissionId },
          data: {
            menuId: menu.menuId,
            name: menu.menuName,
            status: menu.status,
          },
        });
        this.logger.debug(`Linked existing permission to menu ${menu.menuId}`);
      } else {
        // 新建权限
        await tx.permission.create({
          data: {
            code: menu.perms,
            name: menu.menuName,
            status: menu.status,
            menuId: menu.menuId,
          },
        });
        this.logger.debug(`Created permission for menu ${menu.menuId}`);
      }
    }
  }

  /**
   * 校验菜单类型与字段匹配
   */
  private validateMenuTypeFields(dto: CreateMenuDto | UpdateMenuDto): void {
    const { menuType, path, component, perms } = dto;

    if (menuType === 'M') {
      // 目录：不允许 perms
      if (perms) {
        throw new BadRequestException('目录（M）不允许设置权限标识');
      }
    } else if (menuType === 'C') {
      // 菜单：必须有 path 和 component
      if (!path) {
        throw new BadRequestException('菜单（C）必须设置路由地址');
      }
      if (!component) {
        throw new BadRequestException('菜单（C）必须设置组件路径');
      }
    } else if (menuType === 'F') {
      // 按钮：不允许 path 和 component
      if (path) {
        throw new BadRequestException('按钮（F）不允许设置路由地址');
      }
      if (component) {
        throw new BadRequestException('按钮（F）不允许设置组件路径');
      }
    }
  }

  /**
   * 检查父菜单是否存在
   */
  private async checkParentExists(parentId: bigint): Promise<void> {
    const parent = await this.prisma.menu.findUnique({
      where: { menuId: parentId },
    });

    if (!parent) {
      throw new BadRequestException(`父菜单 ${parentId} 不存在`);
    }
  }

  /**
   * 检查父菜单是否有效（存在且不形成环）
   */
  private async checkParentValid(parentId: bigint, currentMenuId: bigint): Promise<void> {
    await this.checkParentExists(parentId);

    // 检查是否形成环：父菜单不能是当前菜单的后代
    const descendants = await this.getDescendantIds(currentMenuId);
    if (descendants.includes(parentId)) {
      throw new BadRequestException('父菜单不能是当前菜单的后代，会形成循环');
    }
  }

  /**
   * 获取菜单的所有后代 ID
   */
  private async getDescendantIds(menuId: bigint): Promise<bigint[]> {
    const descendants: bigint[] = [];
    const queue = [menuId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = await this.prisma.menu.findMany({
        where: { parentId: currentId },
        select: { menuId: true },
      });

      for (const child of children) {
        descendants.push(child.menuId);
        queue.push(child.menuId);
      }
    }

    return descendants;
  }

  /**
   * 构建菜单树
   */
  private buildTree(menus: MenuResponseDto[], parentId: bigint): MenuTreeDto[] {
    const tree: MenuTreeDto[] = [];

    for (const menu of menus) {
      if (menu.parentId === parentId.toString()) {
        const node = { ...menu, children: [] } as MenuTreeDto;
        const children = this.buildTree(menus, BigInt(menu.menuId));

        if (children.length > 0) {
          node.children = children;
        }

        tree.push(node);
      }
    }

    return tree;
  }
}
