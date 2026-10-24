import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * 创建职位 DTO
 */
export class CreatePostDto {
  @IsString()
  @MaxLength(64)
  postCode!: string;

  @IsString()
  @MaxLength(64)
  postName!: string;

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
