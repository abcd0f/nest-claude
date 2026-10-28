import { BigIntId } from '@app/common';
import { IsArray } from 'class-validator';

/**
 * 分配部门给角色（数据范围） DTO
 *
 * 仅当角色的 `dataScope` 为 `5`（自定义部门）时才有意义。每次调用为全量替换：
 * 传入的列表会覆盖角色原有的部门关联。
 */
export class AssignDeptsDto {
  /**
   * 部门 ID 列表
   *
   * 十进制字符串数组，全量替换。传空数组表示清空自定义范围，
   * 此时若 `dataScope` 仍为 5，用户将看不到任何数据。
   * @example ["100","101"]
   */
  @IsArray()
  @BigIntId({ each: true })
  deptIds!: bigint[];
}
