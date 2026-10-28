import { BigIntId } from '@app/common';

export class OperIdParamDto {
  @BigIntId()
  operId!: bigint;
}
