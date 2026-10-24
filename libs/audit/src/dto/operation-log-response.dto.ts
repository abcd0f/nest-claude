import { Expose, Transform } from 'class-transformer';

/**
 * 操作日志响应 DTO
 */
export class OperationLogResponseDto {
  @Expose()
  @Transform(({ value }) => value?.toString(), { toPlainOnly: true })
  operId!: string;

  @Expose()
  title?: string;

  @Expose()
  method?: string;

  @Expose()
  requestMethod?: string;

  @Expose()
  @Transform(({ value }) => value?.toString(), { toPlainOnly: true })
  operUserId?: string;

  @Expose()
  operUrl?: string;

  @Expose()
  operIp?: string;

  @Expose()
  operParam?: string;

  @Expose()
  status!: string;

  @Expose()
  errorMsg?: string;

  @Expose()
  costTime!: number;

  @Expose()
  operTime!: Date;
}
