import type { UserPrincipal } from '@app/auth';
import { LoginLogService } from '@app/audit';
import { AuthService, CurrentUser, LoginDto, Public, UserProfileDto } from '@app/auth';
import { toDto } from '@app/common';
import { Body, Controller, Get, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/**
 * 认证控制器（网关层唯一 HTTP 入口）
 *
 * 这是 `/auth/*` 的唯一控制器。libs/auth 只提供 Service / Guard，
 * 不再注册任何 controller —— 否则同一路由会被注册两次，
 * Fastify 会抛 FST_ERR_DUPLICATED_ROUTE。
 *
 * 提供以下接口：
 * - POST /auth/login       用户登录（记录登录成功/失败日志）
 * - POST /auth/logout      用户登出（记录登出日志）
 * - POST /auth/refresh     刷新访问令牌
 * - GET  /auth/info        获取当前用户信息
 * - GET  /auth/permissions 获取当前用户权限编码
 *
 * 注意：返回值一律返回裸业务数据，统一响应体由全局 ResponseInterceptor 包装，
 * 不要在控制器里手写 { code, data, message }，否则会被二次包裹。
 */
@ApiTags('Authentication')
@Controller('auth')
export class AuthGatewayController {
  constructor(
    private readonly authService: AuthService,
    private readonly loginLogService: LoginLogService,
  ) {}

  /**
   * 登录接口
   */
  @Post('login')
  @Public()
  async login(@Body() loginDto: LoginDto, @Req() request: any) {
    const clientIp = this.extractIp(request);
    const userAgent = request.headers['user-agent'] || 'unknown';

    try {
      const result = await this.authService.login(loginDto, clientIp);

      // 记录登录成功日志
      await this.loginLogService.logSuccess(loginDto.username, clientIp, userAgent);

      return result;
    } catch (error) {
      // 记录登录失败日志
      const reason = error instanceof Error ? error.message : '登录失败';
      await this.loginLogService.logFailure(loginDto.username, clientIp, userAgent, reason);

      throw error;
    }
  }

  /**
   * 登出接口
   *
   * 必须返回 200 + 响应体：204 No Content 按 HTTP 规范不带 body，
   * Fastify 会直接丢弃控制器返回值，前端拿不到任何提示语。
   *
   * 返回的 `message` 位于 `data` 内（全局 ResponseInterceptor 会把顶层
   * `message` 固定写成「操作成功」，与本接口无关）。
   */
  @Post('logout')
  @ApiBearerAuth()
  async logout(@Req() request: any): Promise<string> {
    const user = (request as unknown as { user?: { username?: string } }).user;
    const clientIp = this.extractIp(request);
    const userAgent = request.headers['user-agent'] || 'unknown';

    if (user?.username) {
      await this.loginLogService.logLogout(user.username, clientIp, userAgent);
    }

    // TODO: Implement token blacklist or session revocation
    // await this.authService.logout(userId, sessionId);

    return '退出成功';
  }

  /**
   * 刷新Token接口
   */
  @Post('refresh')
  @Public()
  async refresh(@Body('refreshToken') refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('缺少刷新令牌');
    }

    return this.authService.refreshToken(refreshToken);
  }

  /**
   * 获取当前用户信息
   *
   * 用户主体由全局 AuthGuard 校验并写入 request.user。
   * 这里转换为 `UserProfileDto` 再返回：`UserPrincipal` 含 BigInt 与 Set，
   * 直接交给 Fastify 序列化会抛 `Do not know how to serialize a BigInt`。
   */
  @Get('info')
  @ApiBearerAuth()
  getCurrentUser(@CurrentUser() user: UserPrincipal): UserProfileDto {
    console.log(user, '1111111111');

    return toDto(UserProfileDto, user);
  }

  /**
   * 获取当前用户权限编码列表
   *
   * 仅用于前端按钮级显隐，不作为后端授权依据（授权由 PermissionGuard 独立执行）。
   */
  @Get('permissions')
  @ApiBearerAuth()
  getPermissions(@CurrentUser() user: UserPrincipal): string[] {
    return Array.from(user.permissionCodes);
  }

  /**
   * 提取客户端 IP
   */
  private extractIp(request: any): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return ip?.trim() || 'unknown';
    }

    return request.ip || 'unknown';
  }
}
