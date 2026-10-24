import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsPhoneNumber,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

/**
 * 创建用户 DTO
 */
export class CreateUserDto {
  @IsString()
  @MaxLength(64)
  userName!: string;

  @IsString()
  @MaxLength(100)
  nickName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsPhoneNumber('CN')
  phoneNumber?: string;

  @IsOptional()
  @IsIn(['0', '1', '2'])
  sex?: string;

  @IsString()
  @MinLength(6)
  @MaxLength(255)
  password!: string;

  @IsOptional()
  @IsIn(['0', '1'])
  status?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(0|[1-9][0-9]*)$/, { message: 'deptId 必须是十进制字符串' })
  deptId?: string;

  @IsOptional()
  @IsString({ each: true })
  @Matches(/^(0|[1-9][0-9]*)$/, {
    each: true,
    message: '每个 roleId 必须是十进制字符串',
  })
  roleIds?: string[];

  @IsOptional()
  @IsString({ each: true })
  @Matches(/^(0|[1-9][0-9]*)$/, {
    each: true,
    message: '每个 postId 必须是十进制字符串',
  })
  postIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
