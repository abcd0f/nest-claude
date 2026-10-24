import { IsArray, IsString, Matches } from 'class-validator';

/**
 * 分配角色给用户 DTO
 */
export class AssignRolesDto {
  @IsArray()
  @IsString({ each: true })
  @Matches(/^(0|[1-9]\d*)$/, { each: true, message: '每个 roleId 必须是十进制字符串' })
  roleIds!: string[];
}
