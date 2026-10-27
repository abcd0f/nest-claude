import type { UserPrincipal } from '@app/auth';
import { CurrentUser } from '@app/auth';
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateMenuDto } from './dto/create-menu.dto.js';
import { ListMenuDto } from './dto/list-menu.dto.js';
import { MenuIdParamDto } from './dto/menu-id-param.dto.js';
import { MenuResponseDto, MenuTreeDto } from './dto/menu-response.dto.js';
import { MenuRouteDto } from './dto/menu-route.dto.js';
import { RoleMenuTreeDto } from './dto/role-menu-tree.dto.js';
import { UpdateMenuDto } from './dto/update-menu.dto.js';
import { MenuService } from './menu.service.js';

/**
 * 菜单管理控制器
 *
 * 这里有两类"菜单接口"，职责完全不同，不要混用：
 * - `GET /system/menu/routes` 前端路由记录（`RouteRecordStringComponent[]`），
 *   供 `getAllMenusApi()` 生成动态路由与侧边栏。
 * - `GET /system/menu/list` 菜单管理表格用的扁平表记录（含 F 按钮）。
 *
 * 注意：本控制器的路由顺序不能随意调整。`@Get('list')`、`@Get('routes')`
 * 必须写在 `@Get(':menuId')` 之前，否则会被 `:menuId` 当成菜单 ID 匹配走
 * （然后因 `list` / `routes` 不是十进制字符串报 422）。
 */
@ApiTags('System - Menu')
@Controller('system/menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  /**
   * 获取菜单列表（表格用，扁平结构，不分页）
   * GET /system/menu/list?menuName=&status=0&visible=0&parentId=
   */
  @Get('list')
  async listMenus(@Query() dto: ListMenuDto): Promise<MenuResponseDto[]> {
    return this.menuService.listMenus(dto);
  }

  /**
   * 获取菜单树
   * GET /system/menu/tree
   */
  @Get('tree')
  async getMenuTree(): Promise<MenuTreeDto[]> {
    return this.menuService.getMenuTree();
  }

  /**
   * 获取当前用户可访问的菜单路由
   *
   * 前端 `getAllMenusApi()` 的数据源，返回值必须符合
   * `RouteRecordStringComponent[]`：`component` 是字符串标识，前端用它查
   * `layoutMap` / `pageMap` 后再交给 vue-router 注册。
   * GET /system/menu/routes
   */
  @Get('routes')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户可访问的菜单路由' })
  async getUserMenuRoutes(@CurrentUser() user: UserPrincipal): Promise<MenuRouteDto[]> {
    return this.menuService.getUserMenuRoutes(user.userId, user.roleKeys);
  }

  /**
   * 获取菜单详情
   * GET /system/menu/:menuId
   */
  @Get(':menuId')
  async getMenuById(@Param() params: MenuIdParamDto): Promise<MenuResponseDto> {
    return this.menuService.getMenuById(params.menuId);
  }

  /**
   * 创建菜单
   * POST /system/menu
   */
  @Post()
  async createMenu(@Body() dto: CreateMenuDto): Promise<MenuResponseDto> {
    return this.menuService.createMenu(dto);
  }

  /**
   * 更新菜单
   * PUT /system/menu/:menuId
   */
  @Put(':menuId')
  async updateMenu(
    @Param() params: MenuIdParamDto,
    @Body() dto: UpdateMenuDto,
  ): Promise<MenuResponseDto> {
    return this.menuService.updateMenu(params.menuId, dto);
  }

  /**
   * 删除菜单
   * DELETE /system/menu/:menuId
   */
  @Delete(':menuId')
  async deleteMenu(@Param() params: MenuIdParamDto): Promise<void> {
    return this.menuService.deleteMenu(params.menuId);
  }

  /**
   * 获取角色菜单树
   * GET /system/menu/role/:roleId
   */
  @Get('role/:roleId')
  async getRoleMenuTree(@Param('roleId') roleId: string): Promise<RoleMenuTreeDto> {
    return this.menuService.getRoleMenuTree(roleId);
  }
}
