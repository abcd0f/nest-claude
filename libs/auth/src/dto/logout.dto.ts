import { IsOptional, IsString } from 'class-validator';

/**
 * 登出请求 DTO
 *
 * access token 过期后，前端通常已经把本地令牌清掉、不再发送 Authorization 头，
 * 此时靠请求体里的 refreshToken 定位要撤销的会话。
 *
 * 请求参数由全局 `ValidationPipe({ transform: true })` 校验。
 */
export class LogoutDto {
  /**
   * 刷新令牌
   *
   * 可选。Authorization 头携带了签名有效的 access token（含已过期）时可以不传；
   * 两者都拿不到时接口仍返回成功，但会话不会被撤销，只能等 TTL 自然到期。
   */
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
