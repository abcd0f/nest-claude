import { DateFormat } from '@app/core/decorators/index.js';
import { Expose, Transform } from 'class-transformer';

/**
 * 用户响应 DTO
 *
 * 不包含 `password`、`delFlag`、`permissionVersion` 等内部字段。
 */
export class UserResponseDto {
  /**
   * 用户 ID
   *
   * 库中为 BigInt，序列化时转成十进制字符串。
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
  userName!: string;

  /**
   * 用户昵称
   */
  @Expose()
  nickName!: string;

  /**
   * 用户邮箱
   *
   * 未填写时为 null。
   */
  @Expose()
  email?: string | null;

  /**
   * 手机号
   *
   * 未填写时为 null。
   */
  @Expose()
  phoneNumber?: string | null;

  /**
   * 性别：0 男、1 女、2 未知
   */
  @Expose()
  sex?: string;

  /**
   * 所属部门 ID
   *
   * 未分配部门时为 null。
   */
  @Expose()
  @Transform(({ value }) => value?.toString(), { toPlainOnly: true })
  deptId?: string | null;

  /**
   * 用户状态：0 启用、1 停用
   */
  @Expose()
  status!: string;

  /**
   * 最后登录 IP
   *
   * 从未登录时为 null。
   */
  @Expose()
  loginIp?: string | null;

  /**
   * 最后登录时间
   *
   * 从未登录时为 null。
   */
  @Expose()
  @DateFormat()
  loginDate?: Date | null;

  /**
   * 创建时间
   */
  @Expose()
  @DateFormat()
  createTime!: Date;

  /**
   * 更新时间
   *
   * 从未更新过时为 null。
   */
  @Expose()
  @DateFormat()
  updateTime?: Date | null;

  /**
   * 备注
   */
  @Expose()
  remark?: string | null;
}
