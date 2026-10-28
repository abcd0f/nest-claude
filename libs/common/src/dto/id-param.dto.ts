import { BigIntId } from '../decorators/bigint-id.decorator.js';

/**
 * 单个 ID 路径参数 DTO
 * 用于 GET /resource/:id 类型的接口
 */
export class IdParamDto {
  /**
   * 资源 ID
   *
   * 以十进制字符串传输，DTO 校验后转换为 `bigint`，避免经过 JS `Number` 丢失精度。
   * @example "1"
   */
  @BigIntId()
  id!: bigint;
}

/**
 * 带有通用 ID 路径参数的基类
 * 其他 DTO 可继承此类来获得 id 字段验证
 */
export class IdParamBaseDto {
  /**
   * 资源 ID
   *
   * 十进制字符串，DTO 转换为 `bigint`；非法值返回 422。
   * @example "1"
   */
  @BigIntId()
  id!: bigint;
}
