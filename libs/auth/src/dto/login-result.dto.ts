import { Expose, Type } from 'class-transformer';

/**
 * Token 响应 DTO
 * 登录和刷新 Token 接口的返回结构
 */
export class TokenDto {
  /**
   * 访问令牌（Access Token）
   * 用于后续 HTTP 请求的 Authorization Bearer 头
   */
  @Expose()
  accessToken!: string;

  /**
   * 访问令牌过期时间（秒）
   * 客户端可根据此值判断何时需要刷新 Token
   */
  @Expose()
  expiresIn!: number;

  /**
   * 刷新令牌（Refresh Token）
   * 用于获取新的 Access Token，仅在第一次登录时返回
   * 后续刷新 Token 时可选返回
   */
  @Expose()
  refreshToken?: string;

  /**
   * 刷新令牌过期时间（秒）
   * 仅在返回 refreshToken 时包含
   */
  @Expose()
  refreshTokenExpiresIn?: number;

  /**
   * Token 类型
   * 固定值 "Bearer"，表示使用 Bearer token 认证方案
   */
  @Expose()
  tokenType!: string;
}

/**
 * 登录结果 DTO
 * 登录接口的返回结构，包含 Token 和用户基础信息
 */
export class LoginResultDto {
  /**
   * Token 信息
   */
  @Expose()
  @Type(() => TokenDto)
  token!: TokenDto;

  /**
   * 用户 ID（字符串格式，避免 JavaScript 精度问题）
   */
  @Expose()
  userId!: string;

  /**
   * 用户名
   */
  @Expose()
  username!: string;

  /**
   * 真实姓名
   */
  @Expose()
  realName!: string;
}
