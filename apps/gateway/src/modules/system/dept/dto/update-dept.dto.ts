import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

/**
 * 更新部门 DTO
 */
export class UpdateDeptDto {
  @IsOptional()
  @IsString()
  @Matches(/^(0|[1-9][0-9]*)$/, { message: 'parentId 必须是十进制字符串' })
  parentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  deptName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  orderNum?: number;

  @IsOptional()
  @IsString()
  @Matches(/^(0|[1-9][0-9]*)$/, { message: 'leaderId 必须是十进制字符串' })
  leaderId?: string;

  @IsOptional()
  @IsIn(['0', '1'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
