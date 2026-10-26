import { IsString, Matches } from 'class-validator';

/**
 * 用户 ID 路径参数 DTO
 */
export class UserIdParamDto {
  @IsString()
  @Matches(/^(0|[1-9]\d*)$/, { message: 'userId 必须是十进制字符串' })
  userId!: string;
}
