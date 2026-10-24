import { IsArray, IsString, Matches } from 'class-validator';

/**
 * 分配职位给用户 DTO
 */
export class AssignPostsDto {
  @IsArray()
  @IsString({ each: true })
  @Matches(/^(0|[1-9]\d*)$/, { each: true, message: '每个 postId 必须是十进制字符串' })
  postIds!: string[];
}
