import { Expose, Transform } from 'class-transformer';

/**
 * 角色响应 DTO
 */
export class RoleResponseDto {
  /**
   * 角色 ID
   *
   * 库中为 BigInt，序列化时转成十进制字符串。
   * @example "1"
   */
  @Expose()
  @Transform(({ value }) => value?.toString(), { toPlainOnly: true })
  roleId!: string;

  /**
   * 角色名称
   */
  @Expose()
  roleName!: string;

  /**
   * 角色权限字符串
   * @example "admin"
   */
  @Expose()
  roleKey!: string;

  /**
   * 显示顺序
   */
  @Expose()
  orderNum!: number;

  /**
   * 数据范围：1 全部、2 本部门、3 本部门及以下、4 仅本人、5 自定义部门
   */
  @Expose()
  dataScope!: string;

  /**
   * 角色状态：0 启用、1 停用
   */
  @Expose()
  status!: string;

  /**
   * 创建时间
   */
  @Expose()
  createTime!: Date;

  /**
   * 更新时间
   *
   * 从未更新过时为 null。
   */
  @Expose()
  updateTime?: Date | null;

  /**
   * 备注
   */
  @Expose()
  remark?: string | null;
}
