import { Expose } from 'class-transformer';
import { MenuTreeDto } from './menu-response.dto.js';

/**
 * 角色菜单树响应 DTO
 *
 * 用于角色授权页面：同时返回完整菜单树与当前角色已勾选的节点，
 * 避免前端二次请求拼装。
 */
export class RoleMenuTreeDto {
  /**
   * 完整菜单树
   *
   * 包含所有 M / C / F 节点，不受当前角色已有授权影响。
   */
  @Expose()
  menus!: MenuTreeDto[];

  /**
   * 已勾选的菜单 ID 列表
   *
   * 十进制字符串数组，元素对应 `MenuTreeDto.menuId`；前端树组件可直接作为
   * `checkedKeys` 使用。
   * @example ["1","100","1001"]
   */
  @Expose()
  checkedKeys!: string[];
}
