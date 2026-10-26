import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';

/**
 * 登录日志查询 DTO
 */
export class LoginLogQueryDto {
  /** 登录账号 */
  @IsOptional()
  @IsString()
  userName?: string;

  /** 登录IP */
  @IsOptional()
  @IsString()
  ipaddr?: string;

  /** 登录状态：0 成功、1 失败 */
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
