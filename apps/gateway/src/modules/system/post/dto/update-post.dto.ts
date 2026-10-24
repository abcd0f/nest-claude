import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * 更新职位 DTO
 */
export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  postCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  postName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  orderNum?: number;

  @IsOptional()
  @IsIn(['0', '1'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
