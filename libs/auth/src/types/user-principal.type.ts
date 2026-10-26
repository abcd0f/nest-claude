/**
 * 当前用户的主体信息
 * 这是从数据库和 JWT token 中加载的用户身份快照
 * 用于在 HTTP 请求的生命周期内传递用户信息
 *
 * @note 这是一个只读的快照，不应直接修改
 * @note 对应数据库中的 sys_user 记录
 */
export interface UserPrincipal {
  /**
   * 用户 ID（BigInt）
   * 对应 sys_user.user_id
   */
  userId: bigint;

  /**
   * 用户名
   * 对应 sys_user.username
   */
  username: string;

  /**
   * 昵称
   * 对应 sys_user.nick_name
   */
  nickName: string;

  /**
   * 部门 ID（可选）
   * 对应 sys_user.dept_id，用于数据范围计算
   */
  deptId: bigint | null;

  /**
   * 用户有效的角色键列表
   * 从 sys_user_role 和 sys_role 查询，只包含启用且未删除的角色
   */
  roleKeys: string[];

  /**
   * 用户拥有的权限编码集合
   * 由权限服务从 sys_role_permission -> sys_permission 解析而来
   * 可以通过缓存机制优化查询性能
   */
  permissionCodes: Set<string>;

  /**
   * 权限版本号
   * 对应 sys_user.permission_version
   * 用于权限缓存失效判断
   */
  permissionVersion: number;

  /**
   * JWT 会话 ID
   * 对应 JWT token 中的 'sid' claim
   * 用于会话管理和 token 撤销
   */
  sessionId: string;

  /**
   * 用户状态
   * '0' = 正常，'1' = 停用
   * 对应 sys_user.status
   */
  status: '0' | '1';

  /**
   * 删除标志
   * '0' = 未删除，'1' = 已删除
   * 对应 sys_user.del_flag
   */
  delFlag: '0' | '1';

  /**
   * Token 签发时间（Unix 时间戳）
   * 对应 JWT token 中的 'iat' claim
   */
  issuedAt: number;

  /**
   * Token 过期时间（Unix 时间戳）
   * 对应 JWT token 中的 'exp' claim
   */
  expiresAt: number;
}

/**
 * 用于 controller 中注入当前用户的参数装饰器
 * @example
 * @Get()
 * findAll(@CurrentUser() user: UserPrincipal) {
 *   console.log(user.userId);
 * }
 */
export type CurrentUserDecorator = (
  target: object,
  propertyKey?: string | symbol,
  parameterIndex?: number,
) => void;

/**
 * 检查用户是否有效（已启用且未删除）
 */
export function isUserValid(user: UserPrincipal): boolean {
  return user.status === '0' && user.delFlag === '0';
}

/**
 * 检查用户是否拥有指定的角色
 */
export function hasRole(user: UserPrincipal, roleKey: string): boolean {
  return user.roleKeys.includes(roleKey);
}

/**
 * 检查用户是否拥有指定的权限
 */
export function hasPermission(user: UserPrincipal, permissionCode: string): boolean {
  return user.permissionCodes.has(permissionCode);
}

/**
 * 检查用户是否拥有指定权限列表中的任意一个
 */
export function hasAnyPermission(user: UserPrincipal, permissionCodes: string[]): boolean {
  return permissionCodes.some((code) => user.permissionCodes.has(code));
}

/**
 * 检查用户是否同时拥有指定的所有权限
 */
export function hasAllPermissions(user: UserPrincipal, permissionCodes: string[]): boolean {
  return permissionCodes.every((code) => user.permissionCodes.has(code));
}
