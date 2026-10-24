import { Body, Controller, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { MenuService } from '../menu/menu.service.js';
import { AssignMenusToRoleDto } from './dto/assign-menus-to-role.dto.js';

/**
 * 角色管理控制器
 */
@Controller('system/role')
export class RoleController {
  constructor(private readonly menuService: MenuService) {}

  /**
   * 分配菜单给角色
   * PUT /system/role/:roleId/menus
   */
  @Put(':roleId/menus')
  @HttpCode(HttpStatus.NO_CONTENT)
  async assignMenusToRole(
    @Param('roleId') roleId: string,
    @Body() dto: AssignMenusToRoleDto,
  ): Promise<void> {
    return this.menuService.assignMenusToRole(roleId, dto.menuIds);
  }
}
