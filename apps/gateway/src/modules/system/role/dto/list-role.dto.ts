import { ListWithSearchAndStatusDto } from '@app/common';

/**
 * 角色列表查询 DTO
 *
 * 继承 `ListWithSearchAndStatusDto`，可用字段为：`page`、`pageSize`、`orderByColumn`、
 * `isAsc`、`search`、`status`。
 *
 * `search` 同时模糊匹配 `roleName` 与 `roleKey`。
 */
export class ListRoleDto extends ListWithSearchAndStatusDto {}
