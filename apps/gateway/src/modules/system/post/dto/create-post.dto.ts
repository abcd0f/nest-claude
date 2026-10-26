import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * 创建职位 DTO
 */
export class CreatePostDto {
  /**
   * 职位编码
   *
   * 全局唯一，重复时返回 400。最长 64 字符。
   * @example "ceo"
   */
  @IsString()
  @MaxLength(64)
  postCode!: string;

  /**
   * 职位名称
   *
   * 最长 64 字符。
   * @example "董事长"
   */
  @IsString()
  @MaxLength(64)
  postName!: string;

  /**
   * 显示顺序
   *
   * 升序排列，缺省 0。
   * @example 1
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  orderNum?: number;

  /**
   * 职位状态：0 启用、1 停用
   *
   * 缺省启用。
   * @example "0"
   */
  @IsOptional()
  @IsIn(['0', '1'])
  status?: string;

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
