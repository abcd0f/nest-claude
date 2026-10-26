import { ListWithSearchAndStatusDto } from '@app/common';

/**
 * 职位列表查询 DTO
 *
 * 继承 `ListWithSearchAndStatusDto`，可用字段为：`page`、`pageSize`、`orderByColumn`、
 * `isAsc`、`search`、`status`。
 *
 * `search` 同时模糊匹配 `postCode` 与 `postName`。
 */
export class ListPostDto extends ListWithSearchAndStatusDto {}
