import { IsString, Matches } from 'class-validator';

/**
 * 菜单 ID 路径参数 DTO
 */
export class MenuIdParamDto {
  @IsString()
  @Matches(/^(0|[1-9]\d*)$/, { message: 'menuId 必须是十进制字符串' })
  menuId!: string;
}
