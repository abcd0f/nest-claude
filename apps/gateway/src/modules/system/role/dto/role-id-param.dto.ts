import { IsString, Matches } from 'class-validator';

/**
 * 角色 ID 路径参数 DTO
 */
export class RoleIdParamDto {
  /**
   * 角色 ID
   *
   * 十进制字符串，禁止前导零；格式非法返回 422。
   * @example "1"
   */
  @IsString()
  @Matches(/^(0|[1-9]\d*)$/, { message: 'roleId 必须是十进制字符串' })
  roleId!: string;
}
