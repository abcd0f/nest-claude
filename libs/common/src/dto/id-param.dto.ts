import { IsString, Matches } from 'class-validator';

/**
 * 单个 ID 路径参数 DTO
 * 用于 GET /resource/:id 类型的接口
 */
export class IdParamDto {
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
  @IsString({ message: 'id 必须是字符串' })
  @Matches(/^(0|[1-9]\d*)$/, {
    message: 'id 必须是十进制字符串',
  })
  id!: string;
}
