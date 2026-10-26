import {
  IsEmail,
  IsIn,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/**
 * 更新用户 DTO
 */
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nickName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsPhoneNumber('CN')
  phoneNumber?: string;

  @IsOptional()
  @IsIn(['0', '1', '2'])
  sex?: string;

  @IsOptional()
  @IsIn(['0', '1'])
  status?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(0|[1-9]\d*)$/, { message: 'deptId 必须是十进制字符串' })
  deptId?: string;

  @IsOptional()
  @IsString({ each: true })
  @Matches(/^(0|[1-9]\d*)$/, {
    each: true,
    message: '每个 roleId 必须是十进制字符串',
  })
  roleIds?: string[];

  @IsOptional()
  @IsString({ each: true })
  @Matches(/^(0|[1-9]\d*)$/, {
    each: true,
    message: '每个 postId 必须是十进制字符串',
  })
  postIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
