import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * 重置密码 DTO
 *
 * 管理员为指定用户直接设置新密码，不需要提供旧密码，也不校验新旧是否相同。
 */
export class ResetPasswordDto {
  /**
   * 新密码
   *
   * 6~255 字符。**当前实现直接落库、未做哈希**（见 `UserService.resetPassword`），
   * 安全修复前不要依赖此字段的存储形态。
   */
  @IsString()
  @MinLength(6)
  @MaxLength(255)
  newPassword!: string;
}
