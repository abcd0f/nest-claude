import { asBoolean, asObject, asStrictInteger, asString, defineConfigDomain } from '../core/index.js';

/**
 * 认证配置
 */
export interface AuthConfig {
  /**
   * JWT 访问令牌密钥
   * 生产环境必须使用强随机密钥，不能提交到代码仓库
   */
  accessTokenSecret: string;

  /**
   * JWT 刷新令牌密钥
   * 必须与访问令牌密钥不同
   */
  refreshTokenSecret: string;

  /**
   * 访问令牌有效期（秒）
   * 建议：15分钟 - 1小时
   */
  accessTokenTtl: number;

  /**
   * 刷新令牌有效期（秒）
   * 建议：7天 - 30天
   */
  refreshTokenTtl: number;

  /**
   * JWT 签发者（issuer）
   */
  issuer: string;

  /**
   * JWT 受众（audience）
   */
  audience: string;

  /**
   * 是否启用刷新令牌轮换
   * 启用后每次刷新都会废弃旧令牌，提高安全性
   */
  refreshTokenRotation: boolean;

  /**
   * 密码重置令牌有效期（秒）
   * 建议：15分钟 - 1小时
   */
  passwordResetTokenTtl: number;
}

/**
 * 认证配置域定义
 */
export const authDomain = defineConfigDomain<AuthConfig>({
  namespace: 'auth',
  parse(raw): AuthConfig {
    const value = asObject(raw, 'auth');
    return {
      accessTokenSecret: asString(
        value['access-token-secret'],
        'auth.access-token-secret',
        'CHANGE_ME_IN_PRODUCTION_ACCESS_TOKEN_SECRET',
      ),
      refreshTokenSecret: asString(
        value['refresh-token-secret'],
        'auth.refresh-token-secret',
        'CHANGE_ME_IN_PRODUCTION_REFRESH_TOKEN_SECRET',
      ),
      accessTokenTtl: asStrictInteger(value['access-token-ttl'], 'auth.access-token-ttl', 1800, 60),
      refreshTokenTtl: asStrictInteger(value['refresh-token-ttl'], 'auth.refresh-token-ttl', 604800, 86400),
      issuer: asString(value.issuer, 'auth.issuer', 'nest-admin'),
      audience: asString(value.audience, 'auth.audience', 'nest-admin'),
      refreshTokenRotation: asBoolean(value['refresh-token-rotation'], 'auth.refresh-token-rotation', true),
      passwordResetTokenTtl: asStrictInteger(
        value['password-reset-token-ttl'],
        'auth.password-reset-token-ttl',
        1800,
        60,
      ),
    };
  },
});

/**
 * 认证配置注入令牌
 */
export const authConfig = authDomain.token;
