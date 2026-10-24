import { Expose, Transform } from 'class-transformer';

/**
 * 登录日志响应 DTO
 */
export class LoginLogResponseDto {
  @Expose()
  @Transform(({ value }) => value?.toString(), { toPlainOnly: true })
  infoId!: string;

  @Expose()
  userName!: string;

  @Expose()
  ipaddr?: string;

  @Expose()
  userAgent?: string;

  @Expose()
  status!: string;

  @Expose()
  msg?: string;

  @Expose()
  loginTime!: Date;
}
