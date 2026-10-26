import { IsString, Matches } from 'class-validator';

/**
 * 职位 ID 路径参数 DTO
 */
export class PostIdParamDto {
  /**
   * 职位 ID
   *
   * 十进制字符串，禁止前导零；格式非法返回 422。
   * @example "1"
   */
  @IsString()
  @Matches(/^(0|[1-9]\d*)$/, { message: 'postId 必须是十进制字符串' })
  postId!: string;
}
