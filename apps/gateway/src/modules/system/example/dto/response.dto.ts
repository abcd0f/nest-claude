import { DateFormat } from '@app/core';
import { Expose, Type } from 'class-transformer';

/** 成功返回内容 */
export class ResponseUserDto {
  /**
   * 用户id
   */
  @Expose()
  @Type(() => String)
  id!: string;

  /**
   * 更新时间
   */
  @Expose()
  @DateFormat(undefined, { toClassOnly: true })
  updateTime: string | null;
}
