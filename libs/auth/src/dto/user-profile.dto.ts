import { Expose, Transform } from 'class-transformer';

/**
 * 当前登录用户信息响应 DTO
 *
 * 与 `UserPrincipal` 的区别：
 * - `userId` / `deptId` 由 BigInt 转成十进制字符串，避免 JSON 序列化抛错
 * - `permissionCodes` 由 Set 转成字符串数组
 * - 不输出 `delFlag` 等内部字段
 */
export class UserProfileDto {
  /**
   * 用户 ID
   * @example "1"
   */
  @Expose()
  @Transform(({ value }) => value?.toString(), { toPlainOnly: true })
  userId!: string;

  /**
   * 登录账号
   * @example "admin"
   */
  @Expose()
  username!: string;

  /**
   * 真实姓名
   * @example "超级管理员"
   */
  @Expose()
  realName!: string;

  /**
   * 所属部门 ID
   *
   * 未分配部门时为 null。
   */
  @Expose()
  @Transform(({ value }) => (value === null || value === undefined ? null : value.toString()), {
    toPlainOnly: true,
  })
  deptId!: null | string;

  /**
   * 有效角色编码列表
   * @example ["superadmin"]
   */
  @Expose()
  roleKeys!: string[];

  /**
   * 权限编码列表
   *
   * 超级管理员固定返回 `["*:*:*"]`。
   * @example ["system:user:view", "system:user:add"]
   */
  @Expose()
  @Transform(({ value }) => (Array.isArray(value) ? value : Array.from(value ?? [])), {
    toPlainOnly: true,
  })
  permissionCodes!: string[];

  /**
   * 权限版本号
   */
  @Expose()
  permissionVersion!: number;

  /**
   * 当前 JWT 会话 ID
   */
  @Expose()
  sessionId!: string;

  /**
   * 用户状态：0 正常、1 停用
   */
  @Expose()
  status!: string;

  /**
   * Token 签发时间（Unix 秒）
   */
  @Expose()
  issuedAt!: number;

  /**
   * Token 过期时间（Unix 秒）
   */
  @Expose()
  expiresAt!: number;
}
