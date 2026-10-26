import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

/**
 * 创建部门 DTO
 */
export class CreateDeptDto {
  /**
   * 父部门 ID
   *
   * 十进制字符串，根节点固定为 `"0"`。
   * @example "0"
   */
  @IsString()
  @Matches(/^(0|[1-9]\d*)$/, { message: 'parentId 必须是十进制字符串' })
  parentId!: string;

  /**
   * 部门名称
   *
   * 最长 64 字符。
   * @example "研发部"
   */
  @IsString()
  @MaxLength(64)
  deptName!: string;

  /**
   * 显示顺序
   *
   * 同级内升序排列，缺省 0。
   * @example 1
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  orderNum?: number;

  /**
   * 负责人用户 ID
   *
   * 十进制字符串，须对应用户表中的 `userId`。
   */
  @IsOptional()
  @IsString()
  @Matches(/^(0|[1-9]\d*)$/, { message: 'leaderId 必须是十进制字符串' })
  leaderId?: string;

  /**
   * 部门状态：0 启用、1 停用
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
