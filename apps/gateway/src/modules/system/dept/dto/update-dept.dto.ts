import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

/**
 * 更新部门 DTO
 *
 * 所有字段均可选，只更新传入的字段；未传字段保持原值。
 */
export class UpdateDeptDto {
  /**
   * 父部门 ID
   *
   * 十进制字符串。变更时不能指向自身或自身的后代，否则形成环。
   * @example "0"
   */
  @IsOptional()
  @IsString()
  @Matches(/^(0|[1-9]\d*)$/, { message: 'parentId 必须是十进制字符串' })
  parentId?: string;

  /**
   * 部门名称
   *
   * 最长 64 字符。
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  deptName?: string;

  /**
   * 显示顺序
   *
   * 同级内升序排列。
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
