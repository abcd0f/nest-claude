import { BigIntId, ListWithSearchAndStatusDto } from '@app/common';
import { IsOptional } from 'class-validator';

/**
 * 职位列表查询 DTO
 *
 * 继承 `ListWithSearchAndStatusDto`，可用字段为：`page`、`pageSize`、`orderByColumn`、
 * `isAsc`、`search`、`status`，以及可选的精确部门筛选 `deptId`。
 *
 * `search` 同时模糊匹配 `postCode` 与 `postName`。
 */
export class ListPostDto extends ListWithSearchAndStatusDto {
  /** 精确部门 ID；根部门展示全部岗位时不传。 */
  @IsOptional()
  @BigIntId()
  deptId?: bigint;
}
