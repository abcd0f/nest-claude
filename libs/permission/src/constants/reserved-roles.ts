/**
 * 系统保留的角色键常量
 * 这些角色具有特殊的语义和保护机制
 */
export const RESERVED_ROLES = {
  /**
   * 超级管理员角色
   * 拥有此角色的用户将：
   * 1. 在权限判定时自动通过
   * 2. 在数据范围计算时获得全部数据
   * 3. 受保护不能被删除（至少保留一个启用的超级管理员用户）
   */
  SUPER_ADMIN: 'superadmin',
} as const;

/**
 * 检查角色列表中是否包含超级管理员角色
 * @param roleKeys - 角色键列表
 * @returns 如果包含超级管理员角色返回 true，否则 false
 */
export function isSuperAdmin(roleKeys: string[] | ReadonlyArray<string>): boolean {
  return roleKeys.includes(RESERVED_ROLES.SUPER_ADMIN);
}

/**
 * 检查单个角色键是否为超级管理员角色
 */
export function isSuperAdminRole(roleKey: string): boolean {
  return roleKey === RESERVED_ROLES.SUPER_ADMIN;
}

/**
 * 系统保留的权限编码前缀
 * 用于标识系统内置的权限，不应由应用代码覆盖
 */
export const RESERVED_PERMISSION_PREFIXES = [
  'system:', // 系统管理权限
] as const;

/**
 * 检查权限编码是否以保留前缀开头
 */
export function isReservedPermission(permissionCode: string): boolean {
  return RESERVED_PERMISSION_PREFIXES.some(prefix =>
    permissionCode.startsWith(prefix),
  );
}
