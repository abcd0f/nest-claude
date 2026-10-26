import { IsString, Matches } from 'class-validator';

/**
 * 职位 ID 路径参数 DTO
 */
export class PostIdParamDto {
  @IsString()
  @Matches(/^(0|[1-9]\d*)$/, { message: 'postId 必须是十进制字符串' })
  postId!: string;
}
