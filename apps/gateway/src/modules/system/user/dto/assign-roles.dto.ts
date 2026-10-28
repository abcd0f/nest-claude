import { BigIntId } from '@app/common';
import { IsArray } from 'class-validator';

/**
 * 分配角色给用户 DTO
 *
 * 全量替换语义：传入的列表覆盖用户原有的角色关联，传空数组等于清空，
 * 用户会立刻失去这些角色带来的全部权限。
 */
export class AssignRolesDto {
  /**
   * 角色 ID 列表
   *
   * 十进制字符串数组，全量替换。任一 ID 不存在时返回 400。
   * @example ["1","2"]
   */
  @IsArray()
  @BigIntId({ each: true })
  roleIds!: bigint[];
}
