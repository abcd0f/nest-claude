import { IsArray, IsString, Matches } from 'class-validator';

/**
 * 分配部门给角色（数据范围） DTO
 */
export class AssignDeptsDto {
  @IsArray()
  @IsString({ each: true })
  @Matches(/^(0|[1-9]\d*)$/, { each: true, message: '每个 deptId 必须是十进制字符串' })
  deptIds!: string[];
}
