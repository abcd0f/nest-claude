import type { MenuModel } from '@app/database/generated/prisma/models/Menu.js';
import type { MenuMetaDto } from './dto/menu-meta.dto.js';
import type { MenuRouteMetaDto } from './dto/menu-route.dto.js';
import { toDto, toDtoList } from '@app/common/dto/dto-transformer.js';
import { andWhere } from '@app/common/utils/where.util.js';
import { PrismaService } from '@app/database';
import { isSuperAdmin } from '@app/permission';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { isURL } from 'class-validator';
import { CreateMenuDto } from './dto/create-menu.dto.js';
import { ListMenuDto } from './dto/list-menu.dto.js';
import { MenuResponseDto, MenuTreeDto } from './dto/menu-response.dto.js';
import { MenuRouteDto } from './dto/menu-route.dto.js';
import { RoleMenuTreeDto } from './dto/role-menu-tree.dto.js';
import { UpdateMenuDto } from './dto/update-menu.dto.js';
import { resolveMenuRouteInfo } from './menu-route.util.js';

/** 目录（M）使用的布局组件标识，对应前端 `layoutMap.BasicLayout` */
const BASIC_LAYOUT_COMPONENT = 'BasicLayout';

/** 外链菜单使用的 iframe 容器组件标识，对应前端 `layoutMap.IFrameView` */
const IFRAME_COMPONENT = 'IFrameView';

/**
 * C 类型菜单未配置 component 时的兜底页面。
 *
 * 不能留空字符串：前端 `convertRoutes` 只在 `component` 为真值时才做映射，
 * 空值会原样交给 vue-router，渲染阶段直接报错。指向 404 页让数据问题可见。
 */
const NOT_FOUND_COMPONENT = '/_core/fallback/not-found.vue';

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

    const menuDtos = toDtoList(MenuResponseDto, menus);

    return this.buildTree(menuDtos, 0n);
  }

  /**
   * 获取菜单列表（表格用，扁平结构）
   *
   * 与 `getMenuTree()` 的区别：
   * - 本方法返回**扁平数组**，包含 F 类型（按钮），供菜单管理表格渲染；
   *   前端用 `row-key="menuId"` + `tree-props` 自己拼树。
   * - 不分页：菜单表是树表，分页会把父子切到不同页，树永远拼不完整。
   *
   * @param dto 查询条件（菜单名称模糊、状态、是否显示、父菜单 ID）
   * @returns 扁平菜单列表，按 `orderNum`、`menuId` 升序
   */
  async listMenus(dto: ListMenuDto): Promise<MenuResponseDto[]> {
    const where = andWhere(
      dto.menuName ? { menuName: { contains: dto.menuName } } : null,
      dto.status ? { status: dto.status } : null,
      dto.visible ? { visible: dto.visible } : null,
      dto.parentId === undefined ? null : { parentId: dto.parentId },
    );

    const menus = await this.prisma.menu.findMany({
      where,
      orderBy: [{ orderNum: 'asc' }, { menuId: 'asc' }],
    });

    const allMenus = await this.prisma.menu.findMany({
      orderBy: [{ orderNum: 'asc' }, { menuId: 'asc' }],
    });
    const routeInfo = resolveMenuRouteInfo(allMenus);
    return toDtoList(
      MenuResponseDto,
      menus.map((menu) => ({
        ...menu,
        routeName: routeInfo.get(menu.menuId)?.name,
      })),
    );
  }

  /**
   * 获取当前用户可访问的菜单路由（vben 后端路由模式）
   *
   * 与 `getMenuTree()` / `listMenus()` 的区别：本方法返回的是**前端路由记录**，
   * 不是菜单表数据。字段名与前端 `RouteRecordStringComponent` 一一对应，
   * 前端 `generateRoutesByBackend` 拿到后直接 `router.addRoute()`，不做任何映射。
   *
   * 过滤规则：
   * 1. 只取启用的目录、菜单、内嵌和外链节点，F（按钮）不返回。
   * 2. 超管（`superadmin`）返回全部；其他角色按 `sys_role_menu` 取并集。
   * 3. 授权集合会**补全祖先链**：只授权了子菜单没授权目录时，自动补上父目录，
   *    否则子菜单会因为父节点缺失在构建时被丢掉。
   * 4. 父节点被停用 → 整枝丢弃（与表格展示口径一致）。
   *
   * @param userId 当前用户 ID
   * @param roleKeys 当前用户有效角色键列表，用于判定超管
   * @returns 前端路由树（顶级为绝对路径，子级为相对路径）
   */
  async getUserMenuRoutes(userId: bigint, roleKeys: readonly string[]): Promise<MenuRouteDto[]> {
    // 菜单表规模是百级，一次性取出后在内存里做过滤与建树，
    // 避免按层级递归查库（N+1）。
    const menus = await this.prisma.menu.findMany({
      where: { status: '0', menuType: { in: ['M', 'C', 'E', 'L'] } },
      orderBy: [{ orderNum: 'asc' }, { menuId: 'asc' }],
    });

    if (menus.length === 0) {
      return [];
    }

    const grantedIds = await this.resolveGrantedMenuIds(userId, roleKeys);
    const menuById = new Map(menus.map((menu) => [menu.menuId.toString(), menu]));

    let included: MenuModel[];
    if (grantedIds === null) {
      // 超管：全量
      included = menus;
    } else {
      const keep = new Set<string>();
      for (const menuId of grantedIds) {
        let cursor = menuById.get(menuId);
        while (cursor) {
          const key = cursor.menuId.toString();
          if (keep.has(key)) {
            break;
          }
          keep.add(key);
          const parentKey = cursor.parentId.toString();
          cursor = parentKey === '0' ? undefined : menuById.get(parentKey);
        }
      }
      included = menus.filter((menu) => keep.has(menu.menuId.toString()));
    }

    // 建树前先按 parentId 分组，同时丢掉"父节点不在结果集里"的孤儿节点
    const includedIds = new Set(included.map((menu) => menu.menuId.toString()));
    const childrenOf = new Map<string, MenuModel[]>();
    const roots: MenuModel[] = [];

    for (const menu of included) {
      const parentKey = menu.parentId.toString();
      if (parentKey === '0') {
        roots.push(menu);
        continue;
      }
      if (!includedIds.has(parentKey)) {
        continue;
      }
      const siblings = childrenOf.get(parentKey) ?? [];
      siblings.push(menu);
      childrenOf.set(parentKey, siblings);
    }

    const routeInfo = resolveMenuRouteInfo(menus);

    return roots.map((menu) => this.buildRouteNode(menu, '', childrenOf, routeInfo).route);
  }

  /**
   * 解析当前用户被授权的菜单 ID 集合
   *
   * @returns `null` 表示超管（不做过滤）；空集合表示没有任何授权
   */
  private async resolveGrantedMenuIds(
    userId: bigint,
    roleKeys: readonly string[],
  ): Promise<null | Set<string>> {
    if (isSuperAdmin(roleKeys)) {
      return null;
    }

    const roles = await this.prisma.userRole.findMany({
      where: { userId, role: { status: '0', delFlag: '0' } },
      select: { roleId: true },
    });

    if (roles.length === 0) {
      return new Set<string>();
    }

    const roleMenus = await this.prisma.roleMenu.findMany({
      where: { roleId: { in: roles.map((role) => role.roleId) } },
      select: { menuId: true },
    });

    return new Set(roleMenus.map((roleMenu) => roleMenu.menuId.toString()));
  }

  /**
   * 把单个菜单节点转换成前端路由记录
   *
   * @param menu 菜单行
   * @param parentAbsolutePath 父节点的绝对路径，顶级传空字符串
   * @param childrenOf 已按 parentId 分组的子节点表
   * @param routeInfo 已解析的路由路径和名称
   * @returns 该节点的绝对路径与路由记录
   */
  private buildRouteNode(
    menu: MenuModel,
    parentAbsolutePath: string,
    childrenOf: Map<string, MenuModel[]>,
    routeInfo: ReturnType<typeof resolveMenuRouteInfo>,
  ): { absolutePath: string; route: MenuRouteDto } {
    const rawPath = (menu.path ?? '').trim();
    const isDirectory = menu.menuType === 'M';
    const isLink = menu.menuType === 'L';
    const isEmbedded = menu.menuType === 'E';
    // isFrame = '0' 表示"是外链"，此时 path 存的是 http(s) 地址
    const isExternal = menu.isFrame === '0' && /^https?:\/\//i.test(rawPath);

    let absolutePath: string;
    let routePath: string;

    if (isLink) {
      routePath = `/link/${menu.menuId}`;
      absolutePath = routePath;
    } else if (isExternal) {
      // URL 不能直接当路由路径，用 menuId 生成稳定的本地路径，
      // 真实地址放进 meta.iframeSrc
      routePath = `/iframe/${menu.menuId}`;
      absolutePath = routePath;
    } else if (rawPath.startsWith('/')) {
      // 库里存的是绝对路径：原样保留，vue-router 允许子路由使用绝对路径
      routePath = rawPath;
      absolutePath = rawPath;
    } else {
      // 相对路径（RuoYi 默认写法），与父路径拼接
      routePath = rawPath || `menu-${menu.menuId}`;
      absolutePath = parentAbsolutePath ? `${parentAbsolutePath}/${routePath}` : `/${routePath}`;
      if (!parentAbsolutePath) routePath = absolutePath;
    }

    let component: string;
    if (isExternal || isEmbedded) {
      component = IFRAME_COMPONENT;
    } else if (isDirectory || isLink) {
      component = BASIC_LAYOUT_COMPONENT;
    } else {
      component = menu.component?.trim() || NOT_FOUND_COMPONENT;
    }

    const meta: MenuRouteMetaDto = {
      ...(menu.meta as MenuMetaDto),
      title: menu.menuName,
      order: menu.orderNum,
      hideInMenu: menu.visible === '1',
    };

    if (menu.icon) {
      meta.icon = menu.icon;
    }
    if (menu.menuType === 'C' && !isExternal) {
      // is_cache = '0' 表示"缓存"
      meta.keepAlive = menu.isCache === '0';
    }
    if (isExternal) {
      meta.iframeSrc = rawPath;
    }
    const query = parseMenuQuery(menu.query);
    if (query) {
      meta.query = query;
    }

    const route: MenuRouteDto = {
      name: routeInfo.get(menu.menuId)!.name,
      path: routePath,
      component,
      meta,
    };

    const childMenus = childrenOf.get(menu.menuId.toString()) ?? [];
    if (childMenus.length > 0) {
      const children = childMenus.map((child) =>
        this.buildRouteNode(child, absolutePath, childrenOf, routeInfo),
      );
      route.children = children.map((child) => child.route);
      // 目录被点击时跳到第一个子菜单，避免落在空白页
      route.redirect = children[0]!.absolutePath;
    }

    return { absolutePath, route };
  }

  /**
   * 获取菜单详情
   * @param menuId 菜单 ID（bigint）
   * @returns 菜单详情
   */
  async getMenuById(menuId: bigint): Promise<MenuResponseDto> {
    const menu = await this.prisma.menu.findUnique({
      where: { menuId },
    });

    if (!menu) {
      throw new NotFoundException(`菜单 ${menuId} 不存在`);
    }

    const allMenus = await this.prisma.menu.findMany({
      orderBy: [{ orderNum: 'asc' }, { menuId: 'asc' }],
    });
    return toDto(MenuResponseDto, {
      ...menu,
      routeName: resolveMenuRouteInfo(allMenus).get(menuId)?.name,
    });
  }

  /**
   * 创建菜单
   * @param dto 创建菜单 DTO
   * @returns 创建的菜单
   */
  async createMenu(dto: CreateMenuDto): Promise<MenuResponseDto> {
    const parentId = dto.parentId;

    // 校验菜单类型与字段匹配
    this.validateMenuTypeFields(dto);
    await this.validateRouteIdentity(dto);

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
            routeName: dto.routeName?.trim() || null,
            meta: this.normalizeMeta(dto),
            orderNum: dto.orderNum,
            path: ['F', 'L'].includes(dto.menuType) ? null : dto.path,
            component: dto.menuType === 'C' ? dto.component : null,
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

        return toDto(MenuResponseDto, menu);
      },
      { timeout: 10_000 },
    );
  }

  /**
   * 更新菜单
   * @param dto 包含菜单 ID 和更新字段的 DTO
   * @returns 更新后的菜单
   */
  async updateMenu(dto: UpdateMenuDto): Promise<MenuResponseDto> {
    const menuId = dto.menuId;
    const parentId = dto.parentId;

    // 校验菜单类型与字段匹配
    this.validateMenuTypeFields(dto);
    await this.validateRouteIdentity(dto, menuId);

    // 校验父菜单存在且不形成环
    if (parentId !== 0n) {
      await this.checkParentExists(parentId);
    }

    return await this.prisma.$transaction(
      async (tx) => {
        // 检查菜单是否存在
        const existing = await tx.menu.findUnique({
          where: { menuId },
        });

        if (!existing) {
          throw new NotFoundException(`菜单 ${menuId} 不存在`);
        }

        if (
          ['F', 'L', 'E'].includes(dto.menuType) &&
          (await tx.menu.count({ where: { parentId: menuId } })) > 0
        ) {
          throw new BadRequestException('存在子菜单，不能改为按钮、内嵌或外链');
        }

        // 更新菜单
        const menu = await tx.menu.update({
          where: { menuId },
          data: {
            parentId,
            menuName: dto.menuName,
            menuType: dto.menuType,
            routeName: dto.routeName?.trim() || null,
            meta: this.normalizeMeta(dto),
            orderNum: dto.orderNum,
            path: ['F', 'L'].includes(dto.menuType) ? null : dto.path,
            component: dto.menuType === 'C' ? dto.component : null,
            query: dto.query,
            isFrame: dto.isFrame,
            isCache: dto.isCache,
            visible: dto.visible,
            status: dto.status,
            perms: dto.perms?.trim() || null,
            icon: dto.icon,
            remark: dto.remark,
          },
        });

        // 同步权限表
        await this.syncPermissionFromMenu(tx, menu);

        this.logger.log(`Updated menu ${menu.menuId}: ${menu.menuName}`);

        return toDto(MenuResponseDto, menu);
      },
      { timeout: 10_000 },
    );
  }

  /**
   * 删除菜单
   * @param menuId 菜单 ID（bigint）
   */
  async deleteMenu(menuId: bigint): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        // 检查菜单是否存在
        const menu = await tx.menu.findUnique({
          where: { menuId },
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
          where: { parentId: menuId },
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
          where: { menuId },
        });

        this.logger.log(`Deleted menu ${menuId}`);
      },
      { timeout: 10_000 },
    );
  }

  /**
   * 获取角色的菜单树
   * @param roleId 角色 ID（bigint）
   * @returns 角色菜单树和已选中的菜单 ID
   */
  async getRoleMenuTree(roleId: bigint): Promise<RoleMenuTreeDto> {
    // 获取所有启用的菜单
    const allMenus = await this.prisma.menu.findMany({
      where: {
        status: '0',
      },
      orderBy: [{ orderNum: 'asc' }, { menuId: 'asc' }],
    });

    // 获取角色已分配的菜单 ID
    const roleMenus = await this.prisma.roleMenu.findMany({
      where: { roleId },
      select: { menuId: true },
    });

    const checkedKeys = roleMenus.map((rm) => rm.menuId.toString());

    const menuDtos = toDtoList(MenuResponseDto, allMenus);

    const tree = this.buildTree(menuDtos, 0n);

    return toDto(RoleMenuTreeDto, { menus: tree, checkedKeys });
  }

  /**
   * 分配菜单给角色
   * 同时同步 RoleMenu 和 RolePermission
   *
   * @param roleId 角色 ID（bigint）
   * @param menuIds 菜单 ID 列表（bigint 数组）
   */
  async assignMenusToRole(roleId: bigint, menuIds: bigint[]): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        // 1. 清除原有关联
        await tx.roleMenu.deleteMany({ where: { roleId } });
        await tx.rolePermission.deleteMany({ where: { roleId } });

        if (menuIds.length === 0) {
          this.logger.log(`Cleared all menus for role ${roleId}`);
          return;
        }

        // 2. 批量查询菜单
        const menus = await tx.menu.findMany({
          where: {
            menuId: { in: menuIds },
            status: '0',
          },
          include: {
            permission: {
              select: { permissionId: true, status: true },
            },
          },
        });

        if (menus.length !== menuIds.length) {
          throw new BadRequestException('部分菜单不存在或已停用');
        }

        // 3. 创建 RoleMenu
        await tx.roleMenu.createMany({
          data: menus.map((m) => ({ roleId, menuId: m.menuId })),
          skipDuplicates: true,
        });

        // 4. 创建 RolePermission（仅 C/F 且有权限且权限启用的菜单）
        const permissions = menus
          .filter((m) => m.permission && m.permission.status === '0')
          .map((m) => ({ roleId, permissionId: m.permission!.permissionId }));

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
   * 有权限标识时创建或更新权限；清空时解绑。
   */
  private async syncPermissionFromMenu(tx: any, menu: any): Promise<void> {
    // 没有 perms 时解除权限绑定
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

    // 从编码解析资源与动作，便于按 resource 分组查询
    const { resource, action } = parsePermissionCode(menu.perms);

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
          resource,
          action,
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
            resource,
            action,
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
            resource,
            action,
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

    if (['M', 'C', 'E'].includes(menuType) && !path?.trim()) {
      throw new BadRequestException('目录、菜单和内嵌页面必须设置路由地址');
    }
    if (menuType === 'C') {
      // 菜单：必须有 path 和 component
      if (!component?.trim()) {
        throw new BadRequestException('菜单（C）必须设置组件路径');
      }
    } else if (menuType === 'F') {
      if (!perms?.trim()) throw new BadRequestException('按钮必须设置权限标识');
      // 按钮：不允许 path 和 component
      if (path) {
        throw new BadRequestException('按钮（F）不允许设置路由地址');
      }
      if (component) {
        throw new BadRequestException('按钮（F）不允许设置组件路径');
      }
    }
    const url =
      menuType === 'E' ? dto.meta?.iframeSrc : menuType === 'L' ? dto.meta?.link : undefined;
    if (
      ['E', 'L'].includes(menuType) &&
      (!url ||
        !isURL(url, { protocols: ['http', 'https'], require_protocol: true, require_tld: false }))
    ) {
      throw new BadRequestException('内嵌和外链必须设置有效的 HTTP(S) 地址');
    }
  }

  private normalizeMeta(dto: CreateMenuDto) {
    const meta = { ...dto.meta };
    if (dto.menuType === 'F') return {};
    if (dto.menuType !== 'E') delete meta.iframeSrc;
    if (dto.menuType !== 'L') delete meta.link;
    if (!['C', 'E'].includes(dto.menuType)) {
      delete meta.activePath;
      delete meta.affixTab;
    }
    if (!['M', 'C'].includes(dto.menuType)) delete meta.hideChildrenInMenu;
    if (dto.menuType === 'L') {
      delete meta.activeIcon;
      delete meta.hideInBreadcrumb;
      delete meta.hideInTab;
    }
    if (meta.badgeType !== 'normal') delete meta.badge;
    // Prisma JSON 不接受 undefined；表单清空字段时保存为空对象。
    return JSON.parse(JSON.stringify(meta));
  }

  private async validateRouteIdentity(dto: CreateMenuDto, menuId?: bigint) {
    if (menuId !== undefined && menuId === dto.parentId)
      throw new BadRequestException('不能选择自身作为上级菜单');
    const menus = await this.prisma.menu.findMany({
      orderBy: [{ orderNum: 'asc' }, { menuId: 'asc' }],
    });
    const before = resolveMenuRouteInfo(menus);
    if (
      dto.routeName &&
      [...before].some(([id, info]) => id !== menuId && info.name === dto.routeName?.trim())
    ) {
      throw new ConflictException('菜单名称已存在');
    }
    const candidateId = menuId ?? -1n;
    const candidate = {
      ...dto,
      menuId: candidateId,
      path: dto.path ?? null,
      routeName: dto.routeName ?? null,
      isFrame: dto.isFrame ?? '1',
    };
    let after: ReturnType<typeof resolveMenuRouteInfo>;
    try {
      after = resolveMenuRouteInfo([...menus.filter((menu) => menu.menuId !== menuId), candidate]);
    } catch {
      throw new BadRequestException('父菜单不能是当前菜单的后代');
    }
    const proposed = [...menus.filter((menu) => menu.menuId !== menuId), candidate];
    for (const menu of proposed.filter((item) => !['F', 'L'].includes(item.menuType))) {
      const path = after.get(menu.menuId)!.path;
      if (menu.menuId !== candidateId && path === before.get(menu.menuId)?.path) continue;
      if (
        proposed.some(
          (other) =>
            other.menuId !== menu.menuId &&
            other.menuType !== 'F' &&
            after.get(other.menuId)?.path === path,
        )
      ) {
        throw new ConflictException(`路由地址 ${path} 已存在`);
      }
    }
    if (
      dto.meta?.activePath &&
      !proposed.some(
        (menu) =>
          menu.menuId !== candidateId &&
          !['F', 'L'].includes(menu.menuType) &&
          after.get(menu.menuId)?.path === dto.meta?.activePath,
      )
    ) {
      throw new BadRequestException('激活路径必须指向已存在的菜单');
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
    if (!['M', 'C'].includes(parent.menuType) || parent.isFrame === '0') {
      throw new BadRequestException('只有目录和菜单可以作为上级菜单');
    }
  }

  /**
   * 构建菜单树
   */
  private buildTree(menus: MenuResponseDto[], parentId: bigint): MenuTreeDto[] {
    const tree: MenuTreeDto[] = [];
    // DTO 上的 @Transform 是 toPlainOnly，plainToInstance 之后 parentId/menuId
    // 仍是 BigInt，必须统一转成字符串再比较，否则根节点永远匹配不上。
    const parentIdText = parentId.toString();

    for (const menu of menus) {
      if (String(menu.parentId) === parentIdText) {
        // 必须保留 MenuTreeDto 实例原型：{...menu} 得到的普通对象会丢失
        // class-transformer 元数据，instanceToPlain 不再执行 @Transform，
        // 导致 menuId/parentId 的 BigInt 直接漏到 Fastify 序列化阶段报错。
        const node = Object.assign(new MenuTreeDto(), menu, { children: [] as MenuTreeDto[] });
        const menuId = typeof menu.menuId === 'bigint' ? menu.menuId : BigInt(String(menu.menuId));
        const children = this.buildTree(menus, menuId);

        if (children.length > 0) {
          node.children = children;
        }

        tree.push(node);
      }
    }

    return tree;
  }
}

/**
 * 从权限编码解析资源与动作
 *
 * 约定格式：`<module>:<resource>:<action>`，例如 `system:user:view` → resource=user, action=view
 * 兼容两段式 `user:view` 与更多层级 `system:user:profile:view`（取倒数两段）。
 * 解析失败时返回 null，不影响权限本身的创建。
 */
function parsePermissionCode(code: string): { resource: string | null; action: string | null } {
  const segments = code
    .split(':')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length < 2) {
    return { resource: null, action: null };
  }

  return {
    resource: segments[segments.length - 2] ?? null,
    action: segments[segments.length - 1] ?? null,
  };
}

/**
 * 解析 `sys_menu.query` 的 JSON 字符串
 *
 * 约定存 `{"id":"1"}` 这类对象。历史脏数据（`id=1` 形式）或非法 JSON 直接忽略：
 * 一个字段解析失败不应该让整个菜单接口 500。
 */
function parseMenuQuery(raw: null | string | undefined): Record<string, string> | undefined {
  const text = raw?.trim();
  if (!text) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch {
    // 忽略非法 JSON
  }

  return undefined;
}
