import { IsArray, IsString, Matches } from 'class-validator';

/**
 * 分配职位给用户 DTO
 *
 * 全量替换语义：传入的列表覆盖用户原有的职位关联，传空数组等于清空。
 */
export class AssignPostsDto {
  /**
   * 职位 ID 列表
   *
   * 十进制字符串数组，全量替换。任一 ID 不存在时返回 400。
   * @example ["1","2"]
   */
  @IsArray()
  @IsString({ each: true })
  @Matches(/^(0|[1-9]\d*)$/, { each: true, message: '每个 postId 必须是十进制字符串' })
  postIds!: string[];
}
