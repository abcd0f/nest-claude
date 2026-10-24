import type { UserPrincipal } from '@app/auth';
import type { FastifyRequest } from 'fastify';
import type { PermissionMetadata } from '../types/permission-metadata.type.js';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isSuperAdmin } from '../constants/reserved-roles.js';
import { PERMISSION_KEY } from '../decorators/permission.decorator.js';
import { Mode } from '../enums/mode.enum.js';
import { PermissionService } from '../permission.service.js';

/**
 * 权限守卫
 *
 * 职责：
 * - 读取 @Permission 装饰器声明的权限元数据
 * - 判断当前用户是否满足权限要求
 * - 支持 AND/OR 模式
 * - 支持超级管理员自动通过
 * - 支持角色兜底机制
 *
 * 执行顺序：
 * 1. AuthGuard 先执行，确保 request.user 已设置
 * 2. PermissionGuard 再执行，检查具体权限
 *
 * 策略：
 * - 无权限声明：只要求认证，不检查权限
 * - 有权限声明：必须满足权限要求
 * - 超级管理员：自动通过所有权限检查
 * - 认证失败返回 401，权限不足返回 403
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. 读取权限元数据（方法级覆盖类级）
    const permission = this.reflector.getAllAndOverride<PermissionMetadata | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 无权限声明，只要求认证（由 AuthGuard 保证）
    if (!permission) {
      return true;
    }

    // 2. 获取当前用户
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const user = (request as any).user as UserPrincipal | undefined;

    if (!user) {
      this.logger.warn('Permission guard executed but user is not authenticated');
      throw new UnauthorizedException('用户未认证');
    }

    // 3. 超级管理员自动通过
    if (isSuperAdmin(user.roleKeys)) {
      this.logger.debug(`User ${user.userId} is superadmin, bypassing permission check`);
      return true;
    }

    // 4. 检查角色兜底
    if (permission.role && user.roleKeys.includes(permission.role)) {
      this.logger.debug(
        `User ${user.userId} has fallback role '${permission.role}', allowing access`,
      );
      return true;
    }

    // 5. 解析用户权限（从缓存或数据库）
    const userPermissions = await this.permissionService.resolveUserPermissions(user.userId);

    // 6. 判定权限
    const hasPermission = this.checkPermission(permission, userPermissions);

    if (!hasPermission) {
      this.logger.warn(
        `User ${user.userId} (${user.username}) does not have required permissions: ${permission.value.join(', ')} (mode: ${permission.mode})`,
      );
      throw new ForbiddenException('权限不足');
    }

    this.logger.debug(
      `User ${user.userId} (${user.username}) passed permission check: ${permission.value.join(', ')} (mode: ${permission.mode})`,
    );
    return true;
  }

  /**
   * 检查权限
   *
   * @param required 要求的权限元数据
   * @param userPerms 用户拥有的权限集合
   * @returns 是否满足权限要求
   */
  private checkPermission(required: PermissionMetadata, userPerms: Set<string>): boolean {
    if (required.mode === Mode.AND) {
      // AND 模式：用户必须拥有所有指定的权限
      return required.value.every((p) => userPerms.has(p));
    }

    if (required.mode === Mode.OR) {
      // OR 模式：用户至少拥有一个指定的权限
      return required.value.some((p) => userPerms.has(p));
    }

    // 不应该到达这里（在装饰器中已校验）
    this.logger.error(`Invalid permission mode: ${required.mode}`);
    return false;
  }
}
