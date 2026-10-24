import { Expose, Transform } from 'class-transformer';

/**
 * 菜单响应 DTO
 */
export class MenuResponseDto {
  @Expose()
  @Transform(({ value }) => value?.toString(), { toPlainOnly: true })
  menuId!: string;

  @Expose()
  @Transform(({ value }) => value?.toString(), { toPlainOnly: true })
  parentId!: string;

  @Expose()
  menuName!: string;

  @Expose()
  menuType!: string;

  @Expose()
  orderNum!: number;

  @Expose()
  path?: string | null;

  @Expose()
  component?: string | null;

  @Expose()
  query?: string | null;

  @Expose()
  isFrame!: string;

  @Expose()
  isCache!: string;

  @Expose()
  visible!: string;

  @Expose()
  status!: string;

  @Expose()
  perms?: string | null;

  @Expose()
  icon?: string | null;

  @Expose()
  createTime!: Date;

  @Expose()
  updateTime?: Date | null;

  @Expose()
  remark?: string | null;
}

/**
 * 菜单树节点 DTO
 */
export class MenuTreeDto extends MenuResponseDto {
  @Expose()
  children?: MenuTreeDto[];
}
