import { Expose, Transform } from 'class-transformer';

/**
 * 菜单响应 DTO
 */
export class MenuResponseDto {
  /**
   * 菜单 ID
   *
   * 库中为 BigInt，序列化时转成十进制字符串。
   * @example "1"
   */
  @Expose()
  @Transform(({ value }) => value?.toString(), { toPlainOnly: true })
  menuId!: string;

  /**
   * 父菜单 ID
   *
   * 根节点为 `"0"`。
   * @example "0"
   */
  @Expose()
  @Transform(({ value }) => value?.toString(), { toPlainOnly: true })
  parentId!: string;

  /**
   * 菜单名称
   */
  @Expose()
  menuName!: string;

  /**
   * 菜单类型：M 目录、C 菜单、F 按钮
   */
  @Expose()
  menuType!: string;

  /**
   * 显示顺序
   */
  @Expose()
  orderNum!: number;

  /**
   * 路由地址
   */
  @Expose()
  path?: string | null;

  /**
   * 前端组件路径
   */
  @Expose()
  component?: string | null;

  /**
   * 路由参数
   */
  @Expose()
  query?: string | null;

  /**
   * 是否外链：0 是、1 否
   */
  @Expose()
  isFrame!: string;

  /**
   * 是否缓存：0 缓存、1 不缓存
   */
  @Expose()
  isCache!: string;

  /**
   * 是否隐藏：0 显示、1 隐藏
   */
  @Expose()
  visible!: string;

  /**
   * 菜单状态：0 启用、1 停用
   */
  @Expose()
  status!: string;

  /**
   * 操作权限标识
   *
   * 未配置权限的菜单（通常是 M 目录）为 null。
   * @example "system:user:add"
   */
  @Expose()
  perms?: string | null;

  /**
   * 菜单图标
   */
  @Expose()
  icon?: string | null;

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

/**
 * 菜单树节点 DTO
 *
 * 在菜单响应字段基础上附加子节点，用于返回菜单树结构。
 */
export class MenuTreeDto extends MenuResponseDto {
  /**
   * 子菜单
   *
   * 叶子节点为空数组或不返回。
   */
  @Expose()
  children?: MenuTreeDto[];
}
