import { DateFormat } from '@app/core/decorators/index.js';
import { Expose, Transform } from 'class-transformer';

/**
 * 操作日志响应 DTO
 */
export class OperationLogResponseDto {
  /**
   * 操作日志 ID
   *
   * 库中为 BigInt，序列化时转成十进制字符串。
   * @example "1"
   */
  @Expose()
  @Transform(({ value }) => value?.toString(), { toPlainOnly: true })
  operId!: string;

  /**
   * 模块标题
   */
  @Expose()
  title?: string;

  /**
   * 控制器方法（全限定名）
   * @example "UserController.create"
   */
  @Expose()
  method?: string;

  /**
   * HTTP 请求方式
   * @example "POST"
   */
  @Expose()
  requestMethod?: string;

  /**
   * 操作人用户 ID
   *
   * 库中为 BigInt，序列化时转成十进制字符串；未登录场景可能为空。
   */
  @Expose()
  @Transform(({ value }) => value?.toString(), { toPlainOnly: true })
  operUserId?: string;

  /**
   * 请求地址
   */
  @Expose()
  operUrl?: string;

  /**
   * 操作 IP
   */
  @Expose()
  operIp?: string;

  /**
   * 请求参数
   *
   * 落库前已做脱敏，密码类字段被替换，可直接展示。
   */
  @Expose()
  operParam?: string;

  /**
   * 操作状态：0 成功、1 失败
   */
  @Expose()
  status!: string;

  /**
   * 错误消息
   *
   * 仅失败时写入，成功时为空。
   */
  @Expose()
  errorMsg?: string;

  /**
   * 耗时（毫秒）
   */
  @Expose()
  costTime!: number;

  /**
   * 操作时间
   */
  @Expose()
  @DateFormat()
  operTime!: Date;
}
