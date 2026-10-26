import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';

/**
 * 菜单列表查询 DTO（表格用）
 *
 * 用于 `GET /system/menu/list`，返回**扁平**列表，前端 `el-table` 用
 * `row-key="menuId"` + `tree-props` 自行拼树 —— 所以这里不分页，
 * 分页会把父子节点切到不同页，树永远拼不完整。
 *
 * 注意：项目未注册全局 `ValidationPipe`，query 参数到控制器时仍是字符串，
 * 装饰器只作为接口文档与约定，实际校验在 service 里做。
 */
export class ListMenuDto {
  /**
   * 菜单名称，模糊匹配
   * @example "用户"
   */
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim?.() || undefined)
  menuName?: string;

  /**
   * 菜单状态：`0` 启用、`1` 停用
   * @example "0"
   */
  @IsOptional()
  @IsString()
  @IsIn(['0', '1'])
  status?: string;

  /**
   * 是否显示：`0` 显示、`1` 隐藏
   * @example "0"
   */
  @IsOptional()
  @IsString()
  @IsIn(['0', '1'])
  visible?: string;

  /**
   * 父菜单 ID，按父节点筛选（传 `"0"` 只看顶级菜单）
   * @example "1"
   */
  @IsOptional()
  @IsString()
  parentId?: string;
}
