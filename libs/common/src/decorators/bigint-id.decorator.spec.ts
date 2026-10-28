import { GlobalValidationPipe } from '@app/core/pipes/global-validation.pipe.js';
import { HttpStatus } from '@nestjs/common';
import { IsArray, IsOptional } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { BigIntId } from './bigint-id.decorator.js';

class BigIntDto {
  @BigIntId()
  id!: bigint;

  @IsOptional()
  @BigIntId()
  optionalId?: bigint;

  @IsArray()
  @BigIntId({ each: true })
  ids!: bigint[];
}

describe('bigIntId', () => {
  const pipe = new GlobalValidationPipe();
  const metadata = { data: '', metatype: BigIntDto, type: 'body' as const };

  it('validates and transforms single values and arrays without losing precision', async () => {
    const dto = await pipe.transform(
      {
        id: '9007199254740993',
        ids: ['1', '9223372036854775807'],
        optionalId: '0',
      },
      metadata,
    );

    expect(dto.id).toBe(9007199254740993n);
    expect(dto.optionalId).toBe(0n);
    expect(dto.ids).toEqual([1n, 9223372036854775807n]);
  });

  it('treats an empty optional ID as omitted', async () => {
    const dto = await pipe.transform({ id: '1', ids: [], optionalId: '' }, metadata);

    expect(dto.optionalId).toBeUndefined();
  });

  it.each(['01', '-1', '1.5', 1])('rejects invalid ID values with HTTP 422: %s', async (id) => {
    await expect(pipe.transform({ id, ids: [] }, metadata)).rejects.toMatchObject({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
    });
  });

  it('rejects an invalid array item with HTTP 422', async () => {
    await expect(
      pipe.transform({ id: '1', ids: ['1', 'bad'] }, metadata),
    ).rejects.toMatchObject({ status: HttpStatus.UNPROCESSABLE_ENTITY });
  });

  it('rejects scalar values for array fields', async () => {
    await expect(
      pipe.transform({ id: '1', ids: '2' }, metadata),
    ).rejects.toMatchObject({ status: HttpStatus.UNPROCESSABLE_ENTITY });
  });
});
