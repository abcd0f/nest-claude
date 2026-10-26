import { Audit, LoginLogService, OperationType } from '@app/audit';
import { AuthService, LoginDto, Public } from '@app/auth';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * 认证控制器
 * 提供登录、登出、刷新Token等接口
 */
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
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Req() request: any) {
    const clientIp = this.extractIp(request);
    const userAgent = request.headers['user-agent'] || 'unknown';

    try {
      const result = await this.authService.login(loginDto, clientIp);

      // 记录登录成功日志
      await this.loginLogService.logSuccess(loginDto.username, clientIp, userAgent);

      return {
        code: 200,
        message: '登录成功',
        data: result,
      };
    } catch (error) {
      // 记录登录失败日志
      const reason = error instanceof Error ? error.message : '登录失败';
      await this.loginLogService.logFailure(loginDto.username, clientIp, userAgent, reason);

      throw error;
    }
  }

  /**
   * 登出接口
   */
  @Post('logout')
  @Audit({ title: '用户登出', operationType: OperationType.LOGOUT })
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() request: any) {
    const user = (request as unknown as { user?: { username?: string } }).user;
    const clientIp = this.extractIp(request);
    const userAgent = request.headers['user-agent'] || 'unknown';

    if (user?.username) {
      await this.loginLogService.logLogout(user.username, clientIp, userAgent);
    }

    // TODO: Implement token blacklist or session revocation
    // await this.authService.logout(userId, sessionId);
  }

  /**
   * 刷新Token接口
   */
  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  async refresh(@Body('refreshToken') refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('缺少刷新令牌');
    }

    const result = await this.authService.refreshToken(refreshToken);

    return {
      code: 200,
      message: 'Token刷新成功',
      data: result,
    };
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
