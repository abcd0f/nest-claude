import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from '../auth.service.js';
import { LoginDto } from '../dto/login.dto.js';
import { LoginResultDto, TokenDto } from '../dto/login-result.dto.js';
import { Public } from '../decorators/public.decorator.js';
import { CurrentUser } from '../decorators/current-user.decorator.js';
import { UserPrincipal } from '../types/user-principal.type.js';

/**
 * 认证控制器
 *
 * 提供以下 API 端点：
 * - POST /auth/login - 用户登录
 * - POST /auth/logout - 用户登出
 * - POST /auth/refresh - 刷新访问令牌
 * - GET /auth/me - 获取当前用户信息
 * - GET /auth/permissions - 获取当前用户权限列表
 *
 * 这是仅有的几个 @Public 路由之一（除了 /login 和 /refresh）
 */
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * 用户登录接口
   *
   * @param dto 登录请求（用户名、密码）
   * @param userAgent 请求 User-Agent 头
   * @param xForwardedFor X-Forwarded-For 头（用于代理后的真实 IP）
   * @returns 登录结果，包含 Token 和用户基础信息
   *
   * @example
   * curl -X POST http://localhost:3000/auth/login \
   *   -H "Content-Type: application/json" \
   *   -d '{"username": "admin", "password": "password123"}'
   *
   * Response:
   * {
   *   "token": {
   *     "accessToken": "eyJhbGc...",
   *     "expiresIn": 3600,
   *     "refreshToken": "eyJhbGc...",
   *     "refreshTokenExpiresIn": 604800,
   *     "tokenType": "Bearer"
   *   },
   *   "userId": "1",
   *   "username": "admin",
   *   "realName": "Admin User"
   * }
   */
  @Post('login')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: '用户登录' })
  @ApiResponse({
    status: 200,
    description: '登录成功，返回 Token 和用户信息',
    type: LoginResultDto,
  })
  @ApiResponse({
    status: 401,
    description: '用户名或密码错误',
  })
  @ApiResponse({
    status: 400,
    description: '账户已被停用或删除',
  })
  async login(
    @Body() dto: LoginDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-forwarded-for') xForwardedFor?: string,
  ): Promise<LoginResultDto> {
    // 优先使用 X-Forwarded-For（来自代理），其次用 user-agent 做日志
    const clientIp = xForwardedFor?.split(',')[0]?.trim();

    this.logger.debug(
      `Login attempt for user: ${dto.username} from IP: ${clientIp}`,
    );

    const result = await this.authService.login(dto, clientIp);

    this.logger.log(
      `User login successful: ${result.userId} (${result.username})`,
    );

    return result;
  }

  /**
   * 用户登出接口
   *
   * @param user 当前认证用户
   *
   * @example
   * curl -X POST http://localhost:3000/auth/logout \
   *   -H "Authorization: Bearer <token>"
   *
   * Response: HTTP 204
   */
  @Post('logout')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({ summary: '用户登出' })
  @ApiResponse({
    status: 204,
    description: '登出成功',
  })
  @ApiResponse({
    status: 401,
    description: '未认证',
  })
  async logout(@CurrentUser() user: UserPrincipal): Promise<void> {
    await this.authService.logout(user.userId, user.sessionId);
    this.logger.log(`User logged out: ${user.userId}`);
  }

  /**
   * 刷新访问令牌接口
   *
   * 使用刷新令牌获取新的访问令牌，延长用户会话
   *
   * @param refreshToken 刷新令牌（从登录或上次刷新获取）
   * @returns 新的 Token 信息（不包含刷新令牌本身）
   *
   * @example
   * curl -X POST http://localhost:3000/auth/refresh \
   *   -H "Content-Type: application/json" \
   *   -d '{"refreshToken": "eyJhbGc..."}'
   *
   * Response:
   * {
   *   "accessToken": "eyJhbGc...",
   *   "expiresIn": 3600,
   *   "tokenType": "Bearer"
   * }
   */
  @Post('refresh')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: '刷新访问令牌' })
  @ApiResponse({
    status: 200,
    description: '刷新成功，返回新的访问令牌',
    type: TokenDto,
  })
  @ApiResponse({
    status: 401,
    description: '刷新令牌无效或已过期',
  })
  async refreshToken(
    @Body('refreshToken') refreshToken: string,
  ): Promise<TokenDto> {
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new Error('Missing or invalid refreshToken');
    }

    const result = await this.authService.refreshToken(refreshToken);
    this.logger.debug('Token refreshed successfully');
    return result;
  }

  /**
   * 获取当前用户信息接口
   *
   * 返回当前认证用户的完整信息
   * 用于客户端初始化用户上下文
   *
   * @param user 当前认证用户
   * @returns 用户详细信息
   *
   * @example
   * curl -X GET http://localhost:3000/auth/me \
   *   -H "Authorization: Bearer <token>"
   *
   * Response:
   * {
   *   "userId": "1",
   *   "username": "admin",
   *   "realName": "Admin User",
   *   "deptId": "1",
   *   "roleKeys": ["admin", "user"],
   *   "status": "0",
   *   "delFlag": "0"
   * }
   */
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户信息' })
  @ApiResponse({
    status: 200,
    description: '返回当前用户信息',
    type: UserPrincipal,
  })
  @ApiResponse({
    status: 401,
    description: '未认证',
  })
  async getCurrentUser(@CurrentUser() user: UserPrincipal): Promise<UserPrincipal> {
    this.logger.debug(`Retrieved user info for: ${user.userId}`);
    return user;
  }

  /**
   * 获取当前用户权限列表接口
   *
   * 返回当前用户的权限编码列表
   * 仅用于前端按钮显示，不是后端授权依据
   *
   * 后端授权检查通过 PermissionGuard 独立执行
   *
   * @param user 当前认证用户
   * @returns 权限编码数组
   *
   * @example
   * curl -X GET http://localhost:3000/auth/permissions \
   *   -H "Authorization: Bearer <token>"
   *
   * Response:
   * {
   *   "permissions": [
   *     "system:user:view",
   *     "system:user:add",
   *     "system:user:edit"
   *   ]
   * }
   */
  @Get('permissions')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户权限列表' })
  @ApiResponse({
    status: 200,
    description: '返回权限编码数组',
  })
  @ApiResponse({
    status: 401,
    description: '未认证',
  })
  async getPermissions(
    @CurrentUser() user: UserPrincipal,
  ): Promise<{ permissions: string[] }> {
    const permissions = Array.from(user.permissionCodes);
    this.logger.debug(
      `Retrieved ${permissions.length} permissions for user: ${user.userId}`,
    );
    return { permissions };
  }
}
