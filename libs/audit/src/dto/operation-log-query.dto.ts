import { PageQueryDto } from '@app/common/dto/base.dto.js';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { transformAuditQueryDate } from './audit-query-date.transformer.js';

/**
 * 操作日志查询 DTO
 *
 * 所有字段均可选，全部省略时按操作时间倒序返回第 1 页。
 */
export class OperationLogQueryDto extends PageQueryDto {
  /**
   * 模块标题
   *
   * 精确匹配，取值为 `@Audit({ title })` 装饰器上声明的标题。
   */
  @IsOptional()
  @IsString()
  title?: string;

  /**
   * 操作人用户 ID
   *
   * 十进制字符串；格式非法时返回 422，此处未自定义错误消息，
   * 返回的是 class-validator 默认提示。
   */
  @IsOptional()
  @Matches(/^(0|[1-9]\d*)$/)
  operUserId?: string;

  /**
   * 操作状态：0 成功、1 失败
   */
  @IsOptional()
  @IsIn(['0', '1'])
  status?: '0' | '1';

  /**
   * 时间范围起点（含）
   *
   * 由全局 `ValidationPipe({ transform: true })` 转换为 `Date`。
   */
  @IsOptional()
  @Type(() => Date)
  @Transform(transformAuditQueryDate, { toClassOnly: true })
  @IsDate()
  startTime?: Date;

  /**
   * 时间范围终点（含）
   *
   * 由全局 `ValidationPipe({ transform: true })` 转换为 `Date`。
   */
  @IsOptional()
  @Type(() => Date)
  @Transform(transformAuditQueryDate, { toClassOnly: true })
  @IsDate()
  endTime?: Date;
}
