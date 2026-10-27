import type { AuthConfig } from '@app/config';
import { authConfig } from '@app/config';
import { Inject, Injectable } from '@nestjs/common';
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
    @Inject(authConfig.KEY) private readonly config: AuthConfig,
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
      expiresIn: `${this.config.accessTokenTtl}s`,
      issuer: this.config.issuer,
      audience: this.config.audience,
      secret: this.config.accessTokenSecret,
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
      expiresIn: `${this.config.refreshTokenTtl}s`,
      issuer: this.config.issuer,
      audience: this.config.audience,
      secret: this.config.refreshTokenSecret,
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
      secret: this.config.accessTokenSecret,
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
      secret: this.config.refreshTokenSecret,
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
   * 解码访问令牌，忽略过期时间
   *
   * 只用于「令牌已过期，但仍需识别是哪个会话」的场景（登出）。
   * 签名、issuer、audience 仍然严格校验，伪造或篡改的令牌一律返回 null。
   *
   * @param token 访问令牌
   * @returns 解析后的 payload；令牌无效或签名不匹配返回 null
   */
  async decodeExpiredAccessToken(token: string): Promise<AccessTokenPayload | null> {
    return this.verifyIgnoringExpiration(token, this.config.accessTokenSecret);
  }

  /**
   * 解码刷新令牌，忽略过期时间
   *
   * 语义同 {@link decodeExpiredAccessToken}，使用刷新令牌密钥验签。
   *
   * @param token 刷新令牌
   * @returns 解析后的 payload；令牌无效或签名不匹配返回 null
   */
  async decodeExpiredRefreshToken(token: string): Promise<AccessTokenPayload | null> {
    return this.verifyIgnoringExpiration(token, this.config.refreshTokenSecret);
  }

  /** 验签但跳过 exp 校验；任何校验失败都归为 null，不向调用方抛错 */
  private async verifyIgnoringExpiration(
    token: string,
    secret: string,
  ): Promise<AccessTokenPayload | null> {
    if (!token) return null;

    try {
      return await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret,
        issuer: this.config.issuer,
        audience: this.config.audience,
        ignoreExpiration: true,
      });
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
