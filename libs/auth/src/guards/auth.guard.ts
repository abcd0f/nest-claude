import { parseId } from '@app/common';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth.service.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { TokenService } from '../services/token.service.js';

/**
 * 认证守卫（AuthGuard）
 *
 * 职责：
 * 1. 识别公开路由（@Public 装饰器）
 * 2. 提取 Bearer Token
 * 3. 验证 Token 的签名、有效期和发行者
 * 4. 从数据库加载用户主体
 * 5. 设置到请求上下文，供后续 middleware/controller 使用
 *
 * 流程：
 * - 如果路由标记为 @Public，直接放行
 * - 否则必须提供有效的 Bearer Token
 * - Token 过期、无效或用户不存在都返回 401
 * - 用户已停用或已删除返回 401
 *
 * 执行顺序：
 * - 在 PermissionGuard 之前执行
 * - 是全局 Guard，应通过 APP_GUARD 在 CoreModule 注册
 *
 * @note 不在此处检查功能权限，权限检查由 PermissionGuard 负责
 * @note 不在此处检查数据范围，数据范围由 service/query policy 负责
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. 检查路由是否标记为公开
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      this.logger.debug('Public route, skipping authentication');
      return true;
    }

    // 2. 提取 Bearer Token
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      this.logger.warn('Missing authentication token');
      throw new UnauthorizedException('缺少认证令牌');
    }

    try {
      // 3. 验证 Token
      const payload = await this.tokenService.verifyAccessToken(token);

      // 4. 加载用户主体
      const userId = parseId(payload.sub, 'userId');
      const user = await this.authService.getCurrentUser(userId);

      if (!user) {
        this.logger.warn(`User not found: ${payload.sub}`);
        throw new UnauthorizedException('用户不存在');
      }

      // 5. 检查用户状态
      if (user.status !== '0' || user.delFlag !== '0') {
        this.logger.warn(`User is disabled or deleted: ${userId}`);
        throw new UnauthorizedException('用户已被停用或删除');
      }

      // 6. 设置到请求上下文
      // getCurrentUser 无法感知 JWT，这里回填会话 ID 供控制器透出
      user.sessionId = payload.sid;
      request.user = user;
      request.token = payload;

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.warn(
        `Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new UnauthorizedException('令牌无效或已过期');
    }
  }

  /**
   * 从 HTTP Authorization 头提取 Bearer Token
   *
   * 预期格式：
   * Authorization: Bearer <token>
   *
   * @param request Fastify/Express request 对象
   * @returns Token 字符串，如果不存在返回 undefined
   */
  private extractTokenFromHeader(request: any): string | undefined {
    const authHeader = request.headers?.authorization;
    if (!authHeader || typeof authHeader !== 'string') {
      return undefined;
    }

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
