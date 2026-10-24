import { Expose, Transform } from 'class-transformer';

/**
 * 部门响应 DTO
 */
export class DeptResponseDto {
  @Expose()
  @Transform(({ value }) => value?.toString(), { toPlainOnly: true })
  deptId!: string;

  @Expose()
  @Transform(({ value }) => value?.toString(), { toPlainOnly: true })
  parentId!: string;

  @Expose()
  deptName!: string;

  @Expose()
  orderNum!: number;

  @Expose()
  @Transform(({ value }) => value?.toString(), { toPlainOnly: true })
  leaderId?: string | null;

  @Expose()
  status!: string;

  @Expose()
  createTime!: Date;

  @Expose()
  updateTime?: Date | null;

  @Expose()
  remark?: string | null;
}

/**
 * 部门树节点 DTO
 */
export class DeptTreeDto extends DeptResponseDto {
  @Expose()
  children?: DeptTreeDto[];
}
