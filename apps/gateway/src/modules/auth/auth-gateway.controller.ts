import type { UserPrincipal } from '@app/auth';
import { LoginLogService } from '@app/audit';
import { AuthService, CurrentUser, LoginDto, LogoutDto, Public, UserProfileDto } from '@app/auth';
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
   *
   * 标 `@Public` 是有意的：access token 过期后前端通常已清掉本地令牌、
   * 不再发送 Authorization 头，若仍要求认证，用户会卡在「登不出去」的 401 上。
   * 会话靠请求体里的 refreshToken 兜底定位，两者都拿不到时按已登出处理。
   *
   * 撤销范围仅限当前会话（JWT 的 `sid`）：刷新令牌与 access token 同时失效，
   * 其他设备已登录的会话不受影响。重复调用幂等。
   */
  @Post('logout')
  @Public()
  @ApiBearerAuth()
  async logout(@Body() dto: LogoutDto, @Req() request: any): Promise<string> {
    const clientIp = this.extractIp(request);
    const userAgent = request.headers['user-agent'] || 'unknown';

    const result = await this.authService.logout({
      accessToken: this.extractBearerToken(request),
      refreshToken: dto?.refreshToken,
    });

    // 识别不出会话也返回成功：登出必须幂等，不能因为「本来就没登录」而报错
    if (result?.username) {
      await this.loginLogService.logLogout(result.username, clientIp, userAgent);
    }

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

  /**
   * 提取 Authorization 头里的 Bearer Token
   *
   * 登出接口是 @Public，AuthGuard 不会代劳，只能自己解析。
   * 令牌允许已过期（由 AuthService 验签时跳过 exp），但不能缺失或格式错误。
   */
  private extractBearerToken(request: any): string | undefined {
    const authHeader = request.headers?.authorization;
    if (!authHeader || typeof authHeader !== 'string') {
      return undefined;
    }

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' && token ? token : undefined;
  }
}
