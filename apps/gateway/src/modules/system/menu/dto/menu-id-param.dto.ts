import { BigIntId } from '@app/common';

/**
 * 菜单 ID 路径参数 DTO
 */
export class MenuIdParamDto {
  /**
   * 菜单 ID
   *
   * 十进制字符串，禁止前导零；格式非法返回 422。
   * @example "100"
   */
  @BigIntId()
  menuId!: bigint;
}
