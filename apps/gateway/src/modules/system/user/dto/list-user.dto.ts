import { ListWithSearchAndStatusDto } from '@app/common';
import { IsOptional, IsString, Matches } from 'class-validator';

/**
 * 用户列表查询 DTO
 *
 * 继承 `ListWithSearchAndStatusDto`，可用字段为：`page`、`pageSize`、`orderByColumn`、
 * `isAsc`、`search`、`status`，另加本类的 `deptId`。
 *
 * `search` 同时模糊匹配 `userName` 与 `nickName`。
 */
export class ListUserDto extends ListWithSearchAndStatusDto {
  /**
   * 部门 ID
   *
   * 十进制字符串，按精确部门筛选；不传则不限部门。
   * @example "100"
   */
  @IsOptional()
  @IsString()
  @Matches(/^(0|[1-9]\d*)$/, { message: 'deptId 必须是十进制字符串' })
  deptId?: string;
}
