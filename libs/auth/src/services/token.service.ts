import { Injectable } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';

/**
 * JWT Token payload 接口
 * 用于 Token 签发和验证
 */
export interface AccessTokenPayload {
  /**
   * 用户 ID（字符串格式）
   * 对应 JWT 标准 claim 'sub'
   */
  sub: string;

  /**
   * 会话 ID（字符串格式）
   * 用于会话管理和 Token 撤销
   */
  sid: string;

  /**
   * JWT ID
   * 用于 Token 唯一标识和黑名单
   */
  jti?: string;

  /**
   * 签发时间（Unix 时间戳）
   * 自动由 JwtService 添加
   */
  iat?: number;

  /**
   * 过期时间（Unix 时间戳）
   * 自动由 JwtService 添加
   */
  exp?: number;

  /**
   * 发行者
   * 标识 Token 的发行方
   */
  iss?: string;

  /**
   * 受众
   * 标识 Token 的预期接收方
   */
  aud?: string;
}

/**
 * Token 配置接口
 * 用于初始化 TokenService
 */
export interface TokenConfig {
  /**
   * JWT 签名密钥
   */
  secret: string;

  /**
   * 访问 Token 过期时间（秒）
   * 推荐 15 分钟 - 1 小时
   */
  accessTokenTtl: number;

  /**
   * 刷新 Token 过期时间（秒）
   * 推荐 7-30 天
   */
  refreshTokenTtl: number;

  /**
   * JWT 发行者
   */
  issuer: string;

  /**
   * JWT 受众
   */
  audience: string;

  /**
   * JWT 算法
   * 默认 'HS256'
   */
  algorithm?: string;
}

/**
 * Token 服务
 * 负责 JWT 签发、验证和刷新 Token 管理
 *
 * @note 不在 payload 中放置长期权威权限快照，只放身份和会话标识
 * @note 密码等敏感信息永不写入 Token
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: TokenConfig,
  ) {}

  /**
   * 签发访问令牌（Access Token）
   *
   * @param userId 用户 ID（字符串）
   * @param sessionId 会话 ID（字符串）
   * @param jti JWT ID，可选
   * @returns 签发的 Token
   *
   * @example
   * const token = await tokenService.signAccessToken('123', 'session-456');
   */
  async signAccessToken(userId: string, sessionId: string, jti?: string): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: userId,
      sid: sessionId,
      jti,
    };

    const signOptions: JwtSignOptions = {
      expiresIn: this.config.accessTokenTtl,
      issuer: this.config.issuer,
      audience: this.config.audience,
      algorithm: (this.config.algorithm || 'HS256') as any,
    };

    return this.jwtService.signAsync(payload, signOptions);
  }

  /**
   * 签发刷新令牌（Refresh Token）
   *
   * @param userId 用户 ID（字符串）
   * @param sessionId 会话 ID（字符串）
   * @param jti JWT ID
   * @returns 签发的刷新 Token
   *
   * @example
   * const refreshToken = await tokenService.signRefreshToken('123', 'session-456', 'jti-789');
   */
  async signRefreshToken(userId: string, sessionId: string, jti: string): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: userId,
      sid: sessionId,
      jti,
    };

    const signOptions: JwtSignOptions = {
      expiresIn: this.config.refreshTokenTtl,
      issuer: this.config.issuer,
      audience: this.config.audience,
      algorithm: (this.config.algorithm || 'HS256') as any,
    };

    return this.jwtService.signAsync(payload, signOptions);
  }

  /**
   * 验证访问令牌
   *
   * @param token 要验证的 Token
   * @returns 解析后的 Token payload
   * @throws UnauthorizedException 如果 Token 无效、过期或格式错误
   *
   * @example
   * try {
   *   const payload = await tokenService.verifyAccessToken(token);
   *   console.log(payload.sub); // 用户 ID
   * } catch (error) {
   *   console.error('Token 无效');
   * }
   */
  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    return this.jwtService.verifyAsync<AccessTokenPayload>(token, {
      issuer: this.config.issuer,
      audience: this.config.audience,
    });
  }

  /**
   * 验证刷新令牌
   *
   * @param token 要验证的刷新 Token
   * @returns 解析后的 Token payload
   * @throws UnauthorizedException 如果 Token 无效或过期
   */
  async verifyRefreshToken(token: string): Promise<AccessTokenPayload> {
    return this.jwtService.verifyAsync<AccessTokenPayload>(token, {
      issuer: this.config.issuer,
      audience: this.config.audience,
    });
  }

  /**
   * 从 Token 字符串中提取用户 ID
   * 不进行验证，仅用于提前解析
   *
   * @param token 要解析的 Token
   * @returns 用户 ID，如果无法解析返回 null
   */
  extractUserId(token: string): string | null {
    try {
      const decoded = this.jwtService.decode<AccessTokenPayload>(token);
      return decoded?.sub ?? null;
    } catch {
      return null;
    }
  }

  /**
   * 计算访问 Token 的过期时间（毫秒）
   */
  getAccessTokenExpiresInMs(): number {
    return this.config.accessTokenTtl * 1000;
  }

  /**
   * 计算刷新 Token 的过期时间（毫秒）
   */
  getRefreshTokenExpiresInMs(): number {
    return this.config.refreshTokenTtl * 1000;
  }
}
