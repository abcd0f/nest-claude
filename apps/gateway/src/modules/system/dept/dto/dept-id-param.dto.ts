import { BigIntId } from '@app/common';

/**
 * 部门 ID 路径参数 DTO
 */
export class DeptIdParamDto {
  /**
   * 部门 ID
   *
   * 十进制字符串，禁止前导零；格式非法返回 422。
   * @example "100"
   */
  @BigIntId()
  deptId!: bigint;
}
