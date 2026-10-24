import { IsArray, IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

/**
 * 分配菜单给角色 DTO
 */
export class AssignMenusToRoleDto {
  @IsArray()
  @IsString({ each: true })
  @Matches(/^(0|[1-9]\d*)$/, { each: true, message: '每个 menuId 必须是十进制字符串' })
  menuIds!: string[];

  @IsOptional()
  @IsBoolean()
  menuCheckStrictly?: boolean;
}
