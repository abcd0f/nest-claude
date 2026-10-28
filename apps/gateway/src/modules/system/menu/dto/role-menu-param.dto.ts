import { BigIntId } from '@app/common';

export class RoleMenuParamDto {
  @BigIntId()
  roleId!: bigint;
}
