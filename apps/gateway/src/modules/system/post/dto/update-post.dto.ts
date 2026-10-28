import { BigIntId } from '@app/common';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * 更新职位 DTO
 *
 * 所有字段均可选，只更新传入的字段；未传字段保持原值。
 */
export class UpdatePostDto {
  /**
   * 职位编码
   *
   * 全局唯一；仅在取值变化时才做重复校验。最长 64 字符。
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  postCode?: string;

  /**
   * 职位名称
   *
   * 最长 64 字符。
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  postName?: string;

  /**
   * 显示顺序
   *
   * 升序排列。
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  orderNum?: number;

  /**
   * 职位状态：0 启用、1 停用
   */
  @IsOptional()
  @IsIn(['0', '1'])
  status?: string;

  /** 所属部门 ID；传 null 表示清除部门关联。 */
  @IsOptional()
  @BigIntId()
  deptId?: bigint | null;

  /**
   * 备注
   *
   * 最长 500 字符。
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
