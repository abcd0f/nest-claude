import { PrismaService } from '@app/database';
import { Injectable, Logger } from '@nestjs/common';

/**
 * 权限服务
 *
 * 职责：
 * - 解析用户权限（从数据库加载用户的所有有效权限）
 * - 权限缓存管理（基于用户权限版本号）
 * - 权限失效通知（用户或角色权限变更时）
 */
@Injectable()
export class PermissionService {
  private readonly logger = new Logger(PermissionService.name);

  // 内存缓存：userId + version -> Set<permissionCode>
  // 简单的 Map 缓存，生产环境可替换为 Redis
  private readonly cache = new Map<string, Set<string>>();

  // 缓存 TTL（毫秒），默认 1 小时
  private readonly cacheTtl = 3600 * 1000;

  // 缓存过期时间记录
  private readonly cacheExpiry = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 解析用户的所有有效权限
   *
   * 流程：
   * 1. 获取用户权限版本号
   * 2. 尝试从缓存读取
   * 3. 缓存未命中时从数据库查询
   * 4. 查询路径：User -> UserRole -> RolePermission -> Permission
   * 5. 过滤所有停用/删除的用户、角色、权限
   * 6. 缓存结果
   *
   * @param userId 用户 ID
   * @returns 用户拥有的权限编码集合
   */
  async resolveUserPermissions(userId: bigint): Promise<Set<string>> {
    // 1. 获取用户权限版本
    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: { permissionVersion: true, status: true, delFlag: true },
    });

    // 用户不存在或已停用/删除，返回空权限
    if (!user || user.status !== '0' || user.delFlag !== '0') {
      this.logger.debug(`User ${userId} is invalid or not found, returning empty permissions`);
      return new Set();
    }

    // 2. 尝试从缓存读取
    const cacheKey = this.getCacheKey(userId, user.permissionVersion);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.logger.debug(
        `Permission cache hit for user ${userId} version ${user.permissionVersion}`,
      );
      return cached;
    }

    // 3. 从数据库查询
    this.logger.debug(`Permission cache miss for user ${userId}, querying database`);
    const permissions = await this.queryUserPermissions(userId);

    // 4. 缓存结果
    this.setCache(cacheKey, permissions);

    return permissions;
  }

  /**
   * 从数据库查询用户权限
   *
   * 查询路径：User -> UserRole -> Role -> RolePermission -> Permission
   * 过滤条件：
   * - 用户：status='0', delFlag='0'
   * - 角色：status='0', delFlag='0'
   * - 权限：status='0'
   *
   * @param userId 用户 ID
   * @returns 权限编码集合
   */
  private async queryUserPermissions(userId: bigint): Promise<Set<string>> {
    const permissions = await this.prisma.permission.findMany({
      where: {
        status: '0', // 权限启用
        roles: {
          some: {
            role: {
              status: '0', // 角色启用
              delFlag: '0', // 角色未删除
              users: {
                some: {
                  userId,
                  user: {
                    status: '0', // 用户启用
                    delFlag: '0', // 用户未删除
                  },
                },
              },
            },
          },
        },
      },
      select: { code: true },
    });

    const permSet = new Set(permissions.map((p) => p.code));
    this.logger.debug(`User ${userId} has ${permSet.size} permissions: ${[...permSet].join(', ')}`);
    return permSet;
  }

  /**
   * 失效指定用户的权限缓存
   *
   * 使用场景：
   * - 用户的角色分配变更
   * - 用户状态变更（停用/启用/删除）
   *
   * @param userIds 用户 ID 列表
   */
  async invalidateUserPermissions(userIds: bigint[]): Promise<void> {
    if (userIds.length === 0) return;

    this.logger.log(`Invalidating permissions for ${userIds.length} users`);

    // 递增用户的权限版本号
    await this.prisma.user.updateMany({
      where: { userId: { in: userIds } },
      data: { permissionVersion: { increment: 1 } },
    });

    // 清除内存缓存
    this.clearCacheForUsers(userIds);

    this.logger.log(
      `Successfully invalidated permissions for users: ${userIds.map((id) => id.toString()).join(', ')}`,
    );
  }

  /**
   * 失效指定角色关联的所有用户的权限缓存
   *
   * 使用场景：
   * - 角色的权限分配变更（菜单授权）
   * - 角色状态变更（停用/启用/删除）
   *
   * @param roleId 角色 ID
   */
  async invalidateRolePermissions(roleId: bigint): Promise<void> {
    this.logger.log(`Invalidating permissions for role ${roleId}`);

    // 查询拥有该角色的所有用户
    const userRoles = await this.prisma.userRole.findMany({
      where: { roleId },
      select: { userId: true },
    });

    if (userRoles.length === 0) {
      this.logger.debug(`No users found for role ${roleId}`);
      return;
    }

    const userIds = userRoles.map((ur) => ur.userId);

    // 失效这些用户的权限缓存
    await this.invalidateUserPermissions(userIds);

    this.logger.log(
      `Invalidated permissions for ${userIds.length} users affected by role ${roleId}`,
    );
  }

  /**
   * 清除所有缓存
   *
   * 使用场景：
   * - 批量权限变更
   * - 系统维护
   */
  clearAllCache(): void {
    this.logger.warn('Clearing all permission cache');
    this.cache.clear();
    this.cacheExpiry.clear();
  }

  /**
   * 获取缓存键
   * 格式：user:perms:{userId}:{version}
   */
  private getCacheKey(userId: bigint, version: number): string {
    return `user:perms:${userId}:${version}`;
  }

  /**
   * 从缓存获取权限集合
   * 如果缓存已过期，返回 null
   */
  private getFromCache(key: string): Set<string> | null {
    const expiry = this.cacheExpiry.get(key);
    if (!expiry || Date.now() > expiry) {
      // 缓存已过期
      this.cache.delete(key);
      this.cacheExpiry.delete(key);
      return null;
    }

    return this.cache.get(key) ?? null;
  }

  /**
   * 设置缓存
   */
  private setCache(key: string, value: Set<string>): void {
    this.cache.set(key, value);
    this.cacheExpiry.set(key, Date.now() + this.cacheTtl);

    // 定期清理过期缓存（简单策略）
    this.cleanupExpiredCache();
  }

  /**
   * 清除指定用户的所有缓存
   */
  private clearCacheForUsers(userIds: bigint[]): void {
    for (const userId of userIds) {
      // 清除该用户的所有版本缓存
      const prefix = `user:perms:${userId}:`;
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
          this.cacheExpiry.delete(key);
        }
      }
    }
  }

  /**
   * 清理过期缓存
   * 简单策略：缓存数量超过 1000 时清理
   */
  private cleanupExpiredCache(): void {
    if (this.cache.size < 1000) return;

    const now = Date.now();
    for (const [key, expiry] of this.cacheExpiry.entries()) {
      if (now > expiry) {
        this.cache.delete(key);
        this.cacheExpiry.delete(key);
      }
    }
  }
}
