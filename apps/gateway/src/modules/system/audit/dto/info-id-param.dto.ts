import { BigIntId } from '@app/common';

export class InfoIdParamDto {
  @BigIntId()
  infoId!: bigint;
}
