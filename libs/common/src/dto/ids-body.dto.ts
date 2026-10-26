import { IsArray, IsString, Matches, MinLength } from 'class-validator';

/**
 * 批量 ID 请求体 DTO
 * 用于批量删除、更新等操作：POST /resource/batch 或 DELETE /resource/batch
 */
export class IdsBodyDto {
  /**
   * 资源 ID 列表
   *
   * 至少一个元素，元素为十进制字符串（理由同 `IdParamDto.id`）。
   * 空数组返回 422，而不是静默执行空操作。
   * @example ["1","2","3"]
   */
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
  /**
   * 资源 ID 列表
   *
   * 至少一个元素，元素为十进制字符串。
   * @example ["1","2","3"]
   */
  @IsArray({ message: 'ids 必须是数组' })
  @MinLength(1, { message: 'ids 至少需要一个 ID' })
  @IsString({ each: true, message: 'ids 中的每个元素必须是字符串' })
  @Matches(/^(0|[1-9]\d*)$/, {
    each: true,
    message: 'ids 中的每个元素必须是十进制字符串',
  })
  ids!: string[];
}
