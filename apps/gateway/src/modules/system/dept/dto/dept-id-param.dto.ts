import { IsString, Matches } from 'class-validator';

/**
 * 部门 ID 路径参数 DTO
 */
export class DeptIdParamDto {
  @IsString()
  @Matches(/^(0|[1-9][0-9]*)$/, { message: 'deptId 必须是十进制字符串' })
  deptId!: string;
}
