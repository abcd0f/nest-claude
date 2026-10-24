import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * 创建角色 DTO
 */
export class CreateRoleDto {
  @IsString()
  @MaxLength(64)
  roleName!: string;

  @IsString()
  @MaxLength(64)
  roleKey!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  orderNum?: number;

  @IsOptional()
  @IsIn(['1', '2', '3', '4', '5'])
  dataScope?: string;

  @IsOptional()
  @IsIn(['0', '1'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
