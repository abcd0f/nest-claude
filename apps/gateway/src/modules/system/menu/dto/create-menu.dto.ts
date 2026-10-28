import { BigIntId } from '@app/common';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * 创建菜单 DTO
 *
 * 菜单是权限体系的事实来源：`perms` 变化会自动同步 `sys_permission` 表，
 * 不需要单独维护权限数据（详见 `MenuService.syncPermissionFromMenu`）。
 */
export class CreateMenuDto {
  /**
   * 父菜单 ID
   *
   * 十进制字符串，根节点固定为 `"0"`。
   * @example "0"
   */
  @BigIntId()
  parentId!: bigint;

  /**
   * 菜单名称
   *
   * 最长 64 字符。
   * @example "用户管理"
   */
  @IsString()
  @MaxLength(64)
  menuName!: string;

  /**
   * 菜单类型：M 目录、C 菜单、F 按钮
   *
   * 只有 C / F 类型的菜单会绑定权限，M 类型仅用于分组。
   * @example "C"
   */
  @IsIn(['M', 'C', 'F'], { message: 'menuType 必须是 M/C/F' })
  menuType!: string;

  /**
   * 显示顺序
   *
   * 同级内升序排列，必填。
   * @example 1
   */
  @IsInt()
  @Min(0)
  orderNum!: number;

  /**
   * 路由地址
   *
   * 最长 200 字符；外链场景填完整 URL。
   * @example "user"
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  path?: string;

  /**
   * 前端组件路径
   *
   * 最长 255 字符，相对 `views/` 的路径。
   * @example "system/user/index"
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  component?: string;

  /**
   * 路由参数
   *
   * 以查询串形式拼接，最长 255 字符。
   * @example "id=1&type=2"
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  query?: string;

  /**
   * 是否外链：0 是、1 否
   *
   * 缺省 1（非外链）。
   * @example "1"
   */
  @IsOptional()
  @IsIn(['0', '1'])
  isFrame?: string;

  /**
   * 是否缓存：0 缓存、1 不缓存
   *
   * 缺省 0（缓存）。
   * @example "0"
   */
  @IsOptional()
  @IsIn(['0', '1'])
  isCache?: string;

  /**
   * 是否隐藏：0 显示、1 隐藏
   *
   * 缺省 0（显示）。隐藏的菜单不出现在侧边栏，但路由仍可访问。
   * @example "0"
   */
  @IsOptional()
  @IsIn(['0', '1'])
  visible?: string;

  /**
   * 菜单状态：0 启用、1 停用
   *
   * 缺省启用。停用会同步把对应权限置为停用，已授权的角色随之失去该权限。
   * @example "0"
   */
  @IsOptional()
  @IsIn(['0', '1'])
  status?: string;

  /**
   * 操作权限标识
   *
   * 形如 `模块:资源:动作`，全局唯一，最长 100 字符。保存菜单时会按此值
   * 自动创建 / 更新 / 解绑 `sys_permission` 记录；清空则删除对应权限
   * （若已被角色引用则拒绝）。
   *
   * 该值必须与 Controller 上 `@Permission('...')` 的入参完全一致，否则鉴权永远 403。
   * @example "system:user:add"
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  perms?: string;

  /**
   * 菜单图标
   *
   * 图标名或图标库标识，最长 100 字符。
   * @example "user"
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  icon?: string;

  /**
   * 备注
   *
   * 最长 500 字符。
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
