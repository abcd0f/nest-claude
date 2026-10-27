import { DateFormat } from '@app/core/decorators/index.js';
import { Expose, Transform } from 'class-transformer';

/**
 * 部门响应 DTO
 */
export class DeptResponseDto {
  /**
   * 部门 ID
   *
   * 库中为 BigInt，序列化时转成十进制字符串。
   * @example "100"
   */
  @Expose()
  @Transform(({ value }) => value?.toString(), { toPlainOnly: true })
  deptId!: string;

  /**
   * 父部门 ID
   *
   * 根节点为 `"0"`。
   * @example "0"
   */
  @Expose()
  @Transform(({ value }) => value?.toString(), { toPlainOnly: true })
  parentId!: string;

  /**
   * 部门名称
   */
  @Expose()
  deptName!: string;

  /**
   * 显示顺序
   */
  @Expose()
  orderNum!: number;

  /**
   * 负责人用户 ID
   *
   * 未设置时为 null。
   */
  @Expose()
  @Transform(({ value }) => value?.toString(), { toPlainOnly: true })
  leaderId?: string | null;

  /**
   * 部门状态：0 启用、1 停用
   */
  @Expose()
  status!: string;

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
