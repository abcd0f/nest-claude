import { ListWithStatusDto } from '@app/common';

/**
 * 部门列表查询 DTO
 *
 * 继承 `ListWithStatusDto`，理论可用字段为：`page`、`pageSize`、`orderByColumn`、
 * `isAsc`、`status`（0 启用 / 1 停用）。
 *
 * 注意：`GET /system/dept` 实际返回 `DeptResponseDto[]` 完整数组，不包装分页结构，
 * 因此 `page` / `pageSize` 目前不生效，仅 `status` 参与筛选。
 */
export class ListDeptDto extends ListWithStatusDto {}
