import { ListWithSearchAndStatusDto } from '@app/common';
import { IsOptional, IsString, Matches } from 'class-validator';

/**
 * 用户列表查询 DTO
 */
export class ListUserDto extends ListWithSearchAndStatusDto {
  /**
   * 部门 ID
   */
  @IsOptional()
  @IsString()
  @Matches(/^(0|[1-9]\d*)$/, { message: 'deptId 必须是十进制字符串' })
  deptId?: string;
}
