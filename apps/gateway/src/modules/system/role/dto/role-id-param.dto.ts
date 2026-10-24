import { IsString, Matches } from 'class-validator';

/**
 * 角色 ID 路径参数 DTO
 */
export class RoleIdParamDto {
  @IsString()
  @Matches(/^(0|[1-9]\d*)$/, { message: 'roleId 必须是十进制字符串' })
  roleId!: string;
}
