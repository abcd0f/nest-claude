import { Expose, Transform } from 'class-transformer';

/**
 * 用户响应 DTO
 */
export class UserResponseDto {
  @Expose()
  @Transform(({ value }) => value?.toString(), { toPlainOnly: true })
  userId!: string;

  @Expose()
  userName!: string;

  @Expose()
  nickName!: string;

  @Expose()
  email?: string | null;

  @Expose()
  phoneNumber?: string | null;

  @Expose()
  sex?: string;

  @Expose()
  @Transform(({ value }) => value?.toString(), { toPlainOnly: true })
  deptId?: string | null;

  @Expose()
  status!: string;

  @Expose()
  loginIp?: string | null;

  @Expose()
  loginDate?: Date | null;

  @Expose()
  createTime!: Date;

  @Expose()
  updateTime?: Date | null;

  @Expose()
  remark?: string | null;
}
