import { IsArray, IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

/**
 * 分配菜单给角色 DTO
 *
 * 每次调用为全量替换：传入的菜单列表会覆盖角色原有的菜单与权限关联，
 * 服务端只把其中「有权限且权限已启用」的 C / F 节点写入 `sys_role_permission`。
 */
export class AssignMenusToRoleDto {
  /**
   * 菜单 ID 列表
   *
   * 十进制字符串数组，全量替换。需包含所有需要授权的父级节点，
   * 服务端不会自动补全祖先菜单。
   * @example ["1","100","1001"]
   */
  @IsArray()
  @IsString({ each: true })
  @Matches(/^(0|[1-9]\d*)$/, { each: true, message: '每个 menuId 必须是十进制字符串' })
  menuIds!: string[];

  /**
   * 父子节点是否联动
   *
   * 兼容 RuoYi 前端树组件的字段，**当前实现未使用**：服务端按 `menuIds`
   * 原样落库，不做父子推导，因此勾选父节点不会自动带上子节点。
   * @example false
   */
  @IsOptional()
  @IsBoolean()
  menuCheckStrictly?: boolean;
}
