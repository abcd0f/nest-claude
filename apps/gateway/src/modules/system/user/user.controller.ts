import { PageResponseDto } from '@app/common/dto/base.dto.js';
import { Permission } from '@app/permission';
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { AssignPostsDto } from './dto/assign-posts.dto.js';
import { AssignRolesDto } from './dto/assign-roles.dto.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { ListUserDto } from './dto/list-user.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UserIdParamDto } from './dto/user-id-param.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';
import { UserService } from './user.service.js';

/**
 * 用户管理控制器
 */
@Controller('system/user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * 获取用户列表
   * GET /system/user?page=1&pageSize=20&search=&status=0&deptId=
   */
  @Get('list')
  @Permission('system:user:view')
  async listUsers(@Query() dto: ListUserDto): Promise<PageResponseDto<UserResponseDto>> {
    return this.userService.listUsers(dto);
  }

  /**
   * 获取用户详情
   * GET /system/user/:userId
   */
  @Get(':userId')
  @Permission('system:user:view')
  async getUserById(@Param() params: UserIdParamDto): Promise<UserResponseDto> {
    return this.userService.getUserById(params.userId);
  }

  /**
   * 获取用户已分配的角色与岗位
   * GET /system/user/:userId/roles
   *
   * 供前端「分配角色」弹窗回显；`GET /system/user/:userId` 出于精简不回传关联 ID。
   */
  @Get(':userId/roles')
  @Permission('system:user:view')
  async getUserRoles(
    @Param() params: UserIdParamDto,
  ): Promise<{ postIds: string[]; roleIds: string[] }> {
    return this.userService.getUserRoles(params.userId);
  }

  /**
   * 创建用户
   * POST /system/user
   */
  @Post()
  @Permission('system:user:add')
  async createUser(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.userService.createUser(dto);
  }

  /**
   * 更新用户
   * PUT /system/user/:userId
   */
  @Put(':userId')
  @Permission('system:user:edit')
  async updateUser(
    @Param() params: UserIdParamDto,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.userService.updateUser(params.userId, dto);
  }

  /**
   * 删除用户
   * DELETE /system/user/:userId
   *
   * 返回 200 而不是 204：204 按 HTTP 规范不带响应体，前端
   * `defaultResponseInterceptor` 取不到 `code` 字段，会把成功请求当失败抛错。
   * 同仓先例：`POST /auth/logout` 也是因为这个原因从 204 改成 200。
   *
   */
  @Delete(':userId')
  @Permission('system:user:remove')
  async deleteUser(@Param() params: UserIdParamDto): Promise<void> {
    await this.userService.deleteUser(params.userId);
  }

  /**
   * 分配角色给用户
   * PUT /system/user/:userId/roles
   *
   * 全量替换语义。返回 200，原因同 `deleteUser`（204 无响应体，
   * 前端拦截器会误判为失败）。
   */
  @Put(':userId/roles')
  @Permission('system:user:assign')
  async assignRoles(@Param() params: UserIdParamDto, @Body() dto: AssignRolesDto): Promise<void> {
    await this.userService.assignRoles(params.userId, dto.roleIds);
  }

  /**
   * 分配职位给用户
   * PUT /system/user/:userId/posts
   *
   * 全量替换语义。返回 200，原因同 `deleteUser`。
   */
  @Put(':userId/posts')
  @Permission('system:user:assign')
  async assignPosts(@Param() params: UserIdParamDto, @Body() dto: AssignPostsDto): Promise<void> {
    await this.userService.assignPosts(params.userId, dto.postIds);
  }

  /**
   * 重置用户密码
   * PUT /system/user/:userId/password
   *
   * 返回 200，原因同 `deleteUser`。
   */
  @Put(':userId/password')
  @Permission('system:user:resetPwd')
  async resetPassword(
    @Param() params: UserIdParamDto,
    @Body() dto: ResetPasswordDto,
  ): Promise<void> {
    await this.userService.resetPassword(params.userId, dto.newPassword);
  }
}
