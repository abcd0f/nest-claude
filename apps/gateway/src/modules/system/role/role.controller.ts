import { PageResponseDto } from '@app/common/dto/base.dto.js';
import { Permission } from '@app/permission';
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { AssignDeptsDto } from './dto/assign-depts.dto.js';
import { AssignMenusToRoleDto } from './dto/assign-menus-to-role.dto.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { ListRoleDto } from './dto/list-role.dto.js';
import { RoleIdParamDto } from './dto/role-id-param.dto.js';
import { RoleResponseDto } from './dto/role-response.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { RoleService } from './role.service.js';

/**
 * 角色管理控制器
 */
@Controller('system/role')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  /**
   * 获取角色列表
   * GET /system/role?page=1&pageSize=20&search=&status=0
   */
  @Get('list')
  @Permission('system:role:view')
  async listRoles(@Query() dto: ListRoleDto): Promise<PageResponseDto<RoleResponseDto>> {
    return this.roleService.listRoles(dto);
  }

  /**
   * 获取角色详情
   * GET /system/role/:roleId
   */
  @Get(':roleId')
  @Permission('system:role:view')
  async getRoleById(@Param() params: RoleIdParamDto): Promise<RoleResponseDto> {
    return this.roleService.getRoleById(params.roleId);
  }

  /**
   * 创建角色
   * POST /system/role
   */
  @Post()
  @Permission('system:role:add')
  async createRole(@Body() dto: CreateRoleDto): Promise<RoleResponseDto> {
    return this.roleService.createRole(dto);
  }

  /**
   * 更新角色
   * PUT /system/role/:roleId
   */
  @Put(':roleId')
  @Permission('system:role:edit')
  async updateRole(
    @Param() params: RoleIdParamDto,
    @Body() dto: UpdateRoleDto,
  ): Promise<RoleResponseDto> {
    return this.roleService.updateRole(params.roleId, dto);
  }

  /**
   * 删除角色
   * DELETE /system/role/:roleId
   */
  @Delete(':roleId')
  @Permission('system:role:remove')
  async deleteRole(@Param() params: RoleIdParamDto): Promise<void> {
    return this.roleService.deleteRole(params.roleId);
  }

  /**
   * 分配菜单给角色
   * PUT /system/role/:roleId/menus
   */
  @Put(':roleId/menus')
  @Permission('system:role:assign')
  async assignMenusToRole(
    @Param() params: RoleIdParamDto,
    @Body() dto: AssignMenusToRoleDto,
  ): Promise<void> {
    return this.roleService.assignMenus(params.roleId, dto.menuIds);
  }

  /**
   * 分配部门给角色（数据范围自定义）
   * PUT /system/role/:roleId/depts
   */
  @Put(':roleId/depts')
  @Permission('system:role:scope')
  async assignDeptsToRole(
    @Param() params: RoleIdParamDto,
    @Body() dto: AssignDeptsDto,
  ): Promise<void> {
    return this.roleService.assignDepts(params.roleId, dto.deptIds);
  }
}
