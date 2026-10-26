import { IsString, Matches } from 'class-validator';

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
  @IsString()
  @Matches(/^(0|[1-9]\d*)$/, { message: 'deptId 必须是十进制字符串' })
  deptId!: string;
}
