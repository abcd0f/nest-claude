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
} from '@nestjs/common';
import { CreateMenuDto } from './dto/create-menu.dto.js';
import { MenuIdParamDto } from './dto/menu-id-param.dto.js';
import { MenuResponseDto, MenuTreeDto } from './dto/menu-response.dto.js';
import { RoleMenuTreeDto } from './dto/role-menu-tree.dto.js';
import { UpdateMenuDto } from './dto/update-menu.dto.js';
import { MenuService } from './menu.service.js';

/**
 * 菜单管理控制器
 */
@Controller('system/menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  /**
   * 获取菜单树
   * GET /system/menu/tree
   */
  @Get('tree')
  async getMenuTree(): Promise<MenuTreeDto[]> {
    return this.menuService.getMenuTree();
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
  @HttpCode(HttpStatus.CREATED)
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
  @HttpCode(HttpStatus.NO_CONTENT)
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
