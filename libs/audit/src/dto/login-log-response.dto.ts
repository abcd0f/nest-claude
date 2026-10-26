import { Expose, Transform } from 'class-transformer';

/**
 * 登录日志响应 DTO
 */
export class LoginLogResponseDto {
  /**
   * 访问 ID
   *
   * 库中为 BigInt，序列化时转成十进制字符串。
   * @example "1"
   */
  @Expose()
  @Transform(({ value }) => value?.toString(), { toPlainOnly: true })
  infoId!: string;

  /**
   * 登录账号
   */
  @Expose()
  userName!: string;

  /**
   * 登录 IP
   */
  @Expose()
  ipaddr?: string;

  /**
   * 客户端标识（User-Agent 原文）
   */
  @Expose()
  userAgent?: string;

  /**
   * 登录状态：0 成功、1 失败
   */
  @Expose()
  status!: string;

  /**
   * 提示消息
   *
   * 失败时记录原因（如「密码错误」「账号已停用」）。
   */
  @Expose()
  msg?: string;

  /**
   * 登录时间
   */
  @Expose()
  loginTime!: Date;
}
