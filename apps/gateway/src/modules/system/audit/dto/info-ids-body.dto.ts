import { BigIntId } from '@app/common';
import { IsArray } from 'class-validator';

export class InfoIdsBodyDto {
  @IsArray()
  @BigIntId({ each: true })
  infoIds!: bigint[];
}
