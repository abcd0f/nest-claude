import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

/**
 * 创建菜单 DTO
 */
export class CreateMenuDto {
  @IsString()
  @Matches(/^(0|[1-9]\d*)$/, { message: 'parentId 必须是十进制字符串' })
  parentId!: string;

  @IsString()
  @MaxLength(64)
  menuName!: string;

  @IsIn(['M', 'C', 'F'], { message: 'menuType 必须是 M/C/F' })
  menuType!: string;

  @IsInt()
  @Min(0)
  orderNum!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  path?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  component?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  query?: string;

  @IsOptional()
  @IsIn(['0', '1'])
  isFrame?: string;

  @IsOptional()
  @IsIn(['0', '1'])
  isCache?: string;

  @IsOptional()
  @IsIn(['0', '1'])
  visible?: string;

  @IsOptional()
  @IsIn(['0', '1'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  perms?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
