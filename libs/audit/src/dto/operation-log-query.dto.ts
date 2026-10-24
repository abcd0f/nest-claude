import { IsOptional, IsString, IsIn, Matches } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 操作日志查询 DTO
 */
export class OperationLogQueryDto {
  /** 模块标题 */
  @IsOptional()
  @IsString()
  title?: string;

  /** 操作人用户ID */
  @IsOptional()
  @Matches(/^(0|[1-9][0-9]*)$/)
  operUserId?: string;

  /** 操作状态：0 成功、1 失败 */
  @IsOptional()
  @IsIn(['0', '1'])
  status?: '0' | '1';

  /** 开始时间 */
  @IsOptional()
  @Type(() => Date)
  startTime?: Date;

  /** 结束时间 */
  @IsOptional()
  @Type(() => Date)
  endTime?: Date;

  /** 页码 */
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  /** 每页数量 */
  @IsOptional()
  @Type(() => Number)
  pageSize?: number = 10;
}
