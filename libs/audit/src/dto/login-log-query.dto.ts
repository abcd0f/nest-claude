import { Transform, Type } from 'class-transformer';
import { IsDate, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { transformAuditQueryDate } from './audit-query-date.transformer.js';

/**
 * 登录日志查询 DTO
 *
 * 所有字段均可选，全部省略时按登录时间倒序返回第 1 页。
 */
export class LoginLogQueryDto {
  /**
   * 登录账号
   *
   * 精确匹配，不支持模糊搜索。
   */
  @IsOptional()
  @IsString()
  userName?: string;

  /**
   * 登录 IP
   *
   * 精确匹配；IPv4 / IPv6 均以原始字符串存储。
   */
  @IsOptional()
  @IsString()
  ipaddr?: string;

  /**
   * 登录状态：0 成功、1 失败
   */
  @IsOptional()
  @IsIn(['0', '1'])
  status?: '0' | '1';

  /**
   * 时间范围起点（含）
   *
   * 由全局 `ValidationPipe({ transform: true })` 转换为 `Date`。
   * 与 `endTime` 配合做闭区间筛选，单独传一端也生效。
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

  /**
   * 页码，从 1 开始
   *
   * 注意：本 DTO 未继承 `PageQueryDto`，页码与页大小在此单独声明，
   * 默认值 1 / 10 与 common 分页常量不同。
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /**
   * 每页数量，默认 10
   *
   * 本 DTO 未做上限校验，与 `PageQueryDto` 的 200 上限不一致。
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 10;
}
