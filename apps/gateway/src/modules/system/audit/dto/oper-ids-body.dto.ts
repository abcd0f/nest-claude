import { BigIntId } from '@app/common';
import { IsArray } from 'class-validator';

export class OperIdsBodyDto {
  @IsArray()
  @BigIntId({ each: true })
  operIds!: bigint[];
}
