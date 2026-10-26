import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from './base.dto.js';

/**
 * 带关键字搜索的列表查询 DTO
 */
export class ListWithSearchDto extends PageQueryDto {
  /**
   * 关键字搜索
   */
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim?.() || undefined)
  search?: string;
}

/**
 * 带状态筛选的列表查询 DTO
 */
export class ListWithStatusDto extends PageQueryDto {
  /**
   * 状态：0=启用 1=停用
   */
  @IsOptional()
  @IsString()
  status?: string;
}

/**
 * 带状态和关键字的列表查询 DTO
 */
export class ListWithSearchAndStatusDto extends ListWithSearchDto {
  /**
   * 状态：0=启用 1=停用
   */
  @IsOptional()
  @IsString()
  status?: string;
}

/**
 * 带部门筛选的列表查询 DTO
 */
export class ListWithDeptDto extends PageQueryDto {
  /**
   * 部门 ID
   */
  @IsOptional()
  @IsString()
  deptId?: string;
}
