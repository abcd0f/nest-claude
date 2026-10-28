import { PageQueryDto } from '@app/common/dto/base.dto.js';
import { GlobalValidationPipe } from '@app/core/pipes/global-validation.pipe.js';
import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { LoginLogQueryDto } from './login-log-query.dto.js';
import { OperationLogQueryDto } from './operation-log-query.dto.js';

describe('审计查询 dto', () => {
  const pipe = new GlobalValidationPipe();

  it.each([
    ['login', LoginLogQueryDto],
    ['operation', OperationLogQueryDto],
  ])('全局管道把 %s 日志的时间和分页参数转换为目标类型', async (_name, metatype) => {
    const dto = await pipe.transform(
      {
        endTime: '2026-10-17 23:59:59',
        page: '1',
        pageSize: '10',
        startTime: '2026-10-14 00:00:00',
      },
      { data: '', metatype, type: 'query' },
    );

    expect(dto).toBeInstanceOf(metatype);
    expect(dto).toBeInstanceOf(PageQueryDto);
    expect(dto.startTime).toBeInstanceOf(Date);
    expect(dto.endTime).toBeInstanceOf(Date);
    expect(dto.startTime?.toISOString()).toBe('2026-10-13T16:00:00.000Z');
    expect(dto.endTime?.toISOString()).toBe('2026-10-17T15:59:59.000Z');
    expect(dto.page).toBe(1);
    expect(dto.pageSize).toBe(10);
  });

  it.each([
    ['login', LoginLogQueryDto],
    ['operation', OperationLogQueryDto],
  ])('未传分页参数时 %s 日志 DTO 使用公共默认值', async (_name, metatype) => {
    const dto = await pipe.transform({}, { data: '', metatype, type: 'query' });

    expect(dto).toBeInstanceOf(PageQueryDto);
    expect(dto.page).toBe(1);
    expect(dto.pageSize).toBe(20);
  });

  it('拒绝无法转换为日期的查询参数', async () => {
    await expect(
      pipe.transform(
        { startTime: 'not-a-date' },
        { data: '', metatype: LoginLogQueryDto, type: 'query' },
      ),
    ).rejects.toMatchObject({ status: HttpStatus.UNPROCESSABLE_ENTITY });
  });
});
