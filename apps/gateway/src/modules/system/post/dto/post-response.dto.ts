import { Expose, Transform } from 'class-transformer';

/**
 * 职位响应 DTO
 */
export class PostResponseDto {
  @Expose()
  @Transform(({ value }) => value?.toString(), { toPlainOnly: true })
  postId!: string;

  @Expose()
  postCode!: string;

  @Expose()
  postName!: string;

  @Expose()
  orderNum!: number;

  @Expose()
  status!: string;

  @Expose()
  createTime!: Date;

  @Expose()
  updateTime?: Date | null;

  @Expose()
  remark?: string | null;
}
