import { ListWithStatusDto } from '@app/common';

/**
 * 部门列表查询 DTO
 *
 * 继承 `ListWithStatusDto`，可用字段为：`page`、`pageSize`、`orderByColumn`、
 * `isAsc`、`status`（0 启用 / 1 停用）。
 *
 * `GET /system/dept/list` 返回 `PageResponseDto<DeptResponseDto>`，`page` / `pageSize`
 * 生效（缺省 1 / 20，`pageSize` 上限 200）。
 */
export class ListDeptDto extends ListWithStatusDto {}
