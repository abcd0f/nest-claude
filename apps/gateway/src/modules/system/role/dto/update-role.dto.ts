import { BigIntId } from '@app/common';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * 更新角色 DTO
 *
 * 所有字段均可选，只更新传入的字段；未传字段保持原值。
 */
export class UpdateRoleDto {
  /** 角色 ID */
  @BigIntId()
  roleId!: bigint;

  /**
   * 角色名称
   *
   * 最长 64 字符。
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  roleName?: string;

  /**
   * 角色权限字符串
   *
   * 全局唯一；仅在取值变化时才做重复校验。最长 64 字符。
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  roleKey?: string;

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
   * 数据范围：1 全部、2 本部门、3 本部门及以下、4 仅本人、5 自定义部门
   *
   * 改为 5 时需另调「分配部门」接口写入具体部门，否则自定义范围为空。
   */
  @IsOptional()
  @IsIn(['1', '2', '3', '4', '5'])
  dataScope?: string;

  /**
   * 角色状态：0 启用、1 停用
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
