import { IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * 登录请求 DTO
 * 用于用户登录接口的输入参数校验
 */
export class LoginDto {
  /**
   * 用户名
   * 必填，最少 3 字符
   */
  @IsString()
  @IsNotEmpty({ message: '用户名不能为空' })
  @MinLength(3, { message: '用户名至少 3 个字符' })
  username!: string;

  /**
   * 密码
   * 必填，最少 6 字符
   */
  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(6, { message: '密码至少 6 个字符' })
  password!: string;
}
