import { Expose, Transform } from 'class-transformer';

/**
 * 角色响应 DTO
 */
export class RoleResponseDto {
  @Expose()
  @Transform(({ value }) => value?.toString(), { toPlainOnly: true })
  roleId!: string;

  @Expose()
  roleName!: string;

  @Expose()
  roleKey!: string;

  @Expose()
  orderNum!: number;

  @Expose()
  dataScope!: string;

  @Expose()
  status!: string;

  @Expose()
  createTime!: Date;

  @Expose()
  updateTime?: Date | null;

  @Expose()
  remark?: string | null;
}
