import { IsArray, IsString, Matches, MinLength } from 'class-validator';

/**
 * 批量 ID 请求体 DTO
 * 用于批量删除、更新等操作：POST /resource/batch 或 DELETE /resource/batch
 */
export class IdsBodyDto {
  @IsArray({ message: 'ids 必须是数组' })
  @MinLength(1, { message: 'ids 至少需要一个 ID' })
  @IsString({ each: true, message: 'ids 中的每个元素必须是字符串' })
  @Matches(/^(0|[1-9]\d*)$/, {
    each: true,
    message: 'ids 中的每个元素必须是十进制字符串',
  })
  ids!: string[];
}

/**
 * 带有通用 ID 列表请求体的基类
 */
export class IdsBodyBaseDto {
  @IsArray({ message: 'ids 必须是数组' })
  @MinLength(1, { message: 'ids 至少需要一个 ID' })
  @IsString({ each: true, message: 'ids 中的每个元素必须是字符串' })
  @Matches(/^(0|[1-9]\d*)$/, {
    each: true,
    message: 'ids 中的每个元素必须是十进制字符串',
  })
  ids!: string[];
}
