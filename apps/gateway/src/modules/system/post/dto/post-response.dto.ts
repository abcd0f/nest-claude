import { DateFormat } from '@app/core/decorators/index.js';
import { Expose, Transform } from 'class-transformer';

/**
 * 职位响应 DTO
 */
export class PostResponseDto {
  /**
   * 职位 ID
   *
   * 库中为 BigInt，序列化时转成十进制字符串。
   * @example "1"
   */
  @Expose()
  @Transform(({ value }) => value?.toString(), { toPlainOnly: true })
  postId!: string;

  /**
   * 职位编码
   * @example "ceo"
   */
  @Expose()
  postCode!: string;

  /**
   * 职位名称
   */
  @Expose()
  postName!: string;

  /** 所属部门 ID（十进制字符串）；未分配时为 null。 */
  @Expose()
  deptId!: string | null;

  /**
   * 显示顺序
   */
  @Expose()
  orderNum!: number;

  /**
   * 职位状态：0 启用、1 停用
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
