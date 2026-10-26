import { IsString, Matches } from 'class-validator';

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
  @IsString()
  @Matches(/^(0|[1-9]\d*)$/, { message: 'menuId 必须是十进制字符串' })
  menuId!: string;
}
