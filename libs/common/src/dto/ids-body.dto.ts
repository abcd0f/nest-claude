import { IsArray, MinLength } from 'class-validator';
import { BigIntId } from '../decorators/bigint-id.decorator.js';

/**
 * 批量 ID 请求体 DTO
 * 用于批量删除、更新等操作：POST /resource/batch 或 DELETE /resource/batch
 */
export class IdsBodyDto {
  /**
   * 资源 ID 列表
   *
   * 至少一个十进制 ID，DTO 转换为 `bigint[]`。
   * 空数组返回 422，而不是静默执行空操作。
   * @example ["1","2","3"]
   */
  @IsArray({ message: 'ids 必须是数组' })
  @MinLength(1, { message: 'ids 至少需要一个 ID' })
  @BigIntId({ each: true })
  ids!: bigint[];
}

/**
 * 带有通用 ID 列表请求体的基类
 */
export class IdsBodyBaseDto {
  /**
   * 资源 ID 列表
   *
   * 至少一个十进制 ID，DTO 转换为 `bigint[]`。
   * @example ["1","2","3"]
   */
  @IsArray({ message: 'ids 必须是数组' })
  @MinLength(1, { message: 'ids 至少需要一个 ID' })
  @BigIntId({ each: true })
  ids!: bigint[];
}
