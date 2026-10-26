import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * 创建角色 DTO
 */
export class CreateRoleDto {
  /**
   * 角色名称
   *
   * 展示用，最长 64 字符。
   * @example "系统管理员"
   */
  @IsString()
  @MaxLength(64)
  roleName!: string;

  /**
   * 角色权限字符串
   *
   * 全局唯一的角色标识，用于 `@Permission({ role })` 的兜底判定与前端按钮级判断。
   * 最长 64 字符，重复时返回 400。
   * @example "admin"
   */
  @IsString()
  @MaxLength(64)
  roleKey!: string;

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
   * 数据范围：1 全部、2 本部门、3 本部门及以下、4 仅本人、5 自定义部门
   *
   * 缺省为 4（仅本人）。选 5 时需另调「分配部门」接口写入 `sys_role_dept`，
   * 否则自定义范围为空，用户看不到任何数据。
   * @example "1"
   */
  @IsOptional()
  @IsIn(['1', '2', '3', '4', '5'])
  dataScope?: string;

  /**
   * 角色状态：0 启用、1 停用
   *
   * 缺省启用。停用后该角色不再参与权限与数据范围解析。
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
