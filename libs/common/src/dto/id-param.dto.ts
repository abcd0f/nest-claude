import { IsString, Matches } from 'class-validator';

/**
 * 单个 ID 路径参数 DTO
 * 用于 GET /resource/:id 类型的接口
 */
export class IdParamDto {
  /**
   * 资源 ID
   *
   * 以十进制字符串传输：主键在库中是 BigInt，超出 JS `Number` 安全整数范围后
   * 直接当数字传会丢精度，因此对外一律用字符串，服务端用 `parseId()` 转回 BigInt。
   * @example "1"
   */
  @IsString({ message: 'id 必须是字符串' })
  @Matches(/^(0|[1-9]\d*)$/, {
    message: 'id 必须是十进制字符串',
  })
  id!: string;
}

/**
 * 带有通用 ID 路径参数的基类
 * 其他 DTO 可继承此类来获得 id 字段验证
 */
export class IdParamBaseDto {
  /**
   * 资源 ID
   *
   * 十进制字符串，禁止前导零；非数字或负数返回 422。
   * @example "1"
   */
  @IsString({ message: 'id 必须是字符串' })
  @Matches(/^(0|[1-9]\d*)$/, {
    message: 'id 必须是十进制字符串',
  })
  id!: string;
}
