import { Expose } from 'class-transformer';
import { MenuTreeDto } from './menu-response.dto.js';

/**
 * 角色菜单树响应 DTO
 */
export class RoleMenuTreeDto {
  @Expose()
  menus!: MenuTreeDto[];

  @Expose()
  checkedKeys!: string[];
}
