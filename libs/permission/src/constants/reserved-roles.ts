/**
 * 保留的角色编码常量
 *
 * 这些角色具有特殊权限和保护机制
 */
export const RESERVED_ROLES = {
  /**
   * 超级管理员角色编码
   *
   * 特殊权限：
   * 1. PermissionGuard 检测到该角色时，直接放行
   * 2. DataScopeService 检测到该角色时，返回全部数据
   * 3. 不能删除该角色
   * 4. 必须保留至少一个拥有该角色的启用用户
   */
  SUPER_ADMIN: 'superadmin',
} as const;

/**
 * 判断角色键列表中是否包含超级管理员角色
 *
 * @param roleKeys 角色编码列表
 * @returns 是否是超级管理员
 */
export function isSuperAdmin(roleKeys: readonly string[]): boolean {
  return roleKeys.includes(RESERVED_ROLES.SUPER_ADMIN);
}
