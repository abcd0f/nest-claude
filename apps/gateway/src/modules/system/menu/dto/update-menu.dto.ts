import { CreateMenuDto } from './create-menu.dto.js';

/**
 * 更新菜单 DTO
 *
 * 直接继承创建 DTO，因此语义是 **PUT 全量覆盖**，不是部分更新：
 * `parentId`、`menuName`、`menuType`、`orderNum` 仍为必填，调用方必须提交完整对象。
 *
 * 唯一需要留意的差异在 `perms`：服务端按 `perms?.trim() || null` 落库，
 * 不传等于清空该菜单的权限（若权限已被角色引用，删除会被拒绝）。
 */
export class UpdateMenuDto extends CreateMenuDto {}
