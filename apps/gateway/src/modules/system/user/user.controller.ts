import { PageResponseDto } from '@app/common/dto/base.dto.js';
import { Permission } from '@app/permission';
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
  Query,
} from '@nestjs/common';
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
   * 获取用户详情
   * GET /system/user/:userId
   */
  @Get(':userId')
  @Permission('system:user:view')
  async getUserById(@Param() params: UserIdParamDto): Promise<UserResponseDto> {
    return this.userService.getUserById(params.userId);
  }

  /**
   * 创建用户
   * POST /system/user
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
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
   */
  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permission('system:user:remove')
  async deleteUser(@Param() params: UserIdParamDto): Promise<void> {
    return this.userService.deleteUser(params.userId);
  }

  /**
   * 获取用户列表
   * GET /system/user?page=1&pageSize=20&search=&status=0&deptId=
   */
  @Get()
  @Permission('system:user:view')
  async listUsers(@Query() dto: ListUserDto): Promise<PageResponseDto<UserResponseDto>> {
    return this.userService.listUsers(dto);
  }

  /**
   * 分配角色给用户
   * PUT /system/user/:userId/roles
   */
  @Put(':userId/roles')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permission('system:user:assign')
  async assignRoles(@Param() params: UserIdParamDto, @Body() dto: AssignRolesDto): Promise<void> {
    return this.userService.assignRoles(params.userId, dto.roleIds);
  }

  /**
   * 分配职位给用户
   * PUT /system/user/:userId/posts
   */
  @Put(':userId/posts')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permission('system:user:assign')
  async assignPosts(@Param() params: UserIdParamDto, @Body() dto: AssignPostsDto): Promise<void> {
    return this.userService.assignPosts(params.userId, dto.postIds);
  }

  /**
   * 重置用户密码
   * PUT /system/user/:userId/password
   */
  @Put(':userId/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permission('system:user:resetPwd')
  async resetPassword(
    @Param() params: UserIdParamDto,
    @Body() dto: ResetPasswordDto,
  ): Promise<void> {
    return this.userService.resetPassword(params.userId, dto.newPassword);
  }
}
