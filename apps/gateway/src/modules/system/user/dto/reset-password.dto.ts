import { IsString, MinLength, MaxLength } from 'class-validator';

/**
 * 重置密码 DTO
 */
export class ResetPasswordDto {
  @IsString()
  @MinLength(6)
  @MaxLength(255)
  newPassword!: string;
}
