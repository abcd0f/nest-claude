import { IsBoolean, IsInt, IsString, Min } from 'class-validator';
import { defineConfigDomain } from '../core/define-domain.js';
import { integerParser } from '../core/parsers.js';

/**
 * 认证配置
 */
export class AuthConfig {
  /**
   * JWT 访问令牌密钥
   * 生产环境必须使用强随机密钥，不能提交到代码仓库
   */
  @IsString()
  accessTokenSecret!: string;

  /**
   * JWT 刷新令牌密钥
   * 必须与访问令牌密钥不同
   */
  @IsString()
  refreshTokenSecret!: string;

  /**
   * 访问令牌有效期（秒）
   * 建议：15分钟 - 1小时
   */
  @IsInt()
  @Min(60)
  accessTokenTtl!: number;

  /**
   * 刷新令牌有效期（秒）
   * 建议：7天 - 30天
   */
  @IsInt()
  @Min(86400)
  refreshTokenTtl!: number;

  /**
   * JWT 签发者（issuer）
   */
  @IsString()
  issuer!: string;

  /**
   * JWT 受众（audience）
   */
  @IsString()
  audience!: string;

  /**
   * 是否启用刷新令牌轮换
   * 启用后每次刷新都会废弃旧令牌，提高安全性
   */
  @IsBoolean()
  refreshTokenRotation!: boolean;

  /**
   * 密码重置令牌有效期（秒）
   * 建议：15分钟 - 1小时
   */
  @IsInt()
  @Min(60)
  passwordResetTokenTtl!: number;
}

/**
 * 认证配置域定义
 */
export const authDomain = defineConfigDomain({
  name: 'auth',
  schema: AuthConfig,
  defaults: {
    // 默认密钥仅用于开发环境，生产环境必须覆盖
    accessTokenSecret: 'CHANGE_ME_IN_PRODUCTION_ACCESS_TOKEN_SECRET',
    refreshTokenSecret: 'CHANGE_ME_IN_PRODUCTION_REFRESH_TOKEN_SECRET',
    // 访问令牌 30 分钟
    accessTokenTtl: 1800,
    // 刷新令牌 7 天
    refreshTokenTtl: 604800,
    issuer: 'nest-admin',
    audience: 'nest-admin',
    refreshTokenRotation: true,
    // 密码重置令牌 30 分钟
    passwordResetTokenTtl: 1800,
  },
  parsers: {
    'access-token-ttl': integerParser,
    'refresh-token-ttl': integerParser,
    'refresh-token-rotation': (value) => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') {
        return value.toLowerCase() === 'true';
      }
      return Boolean(value);
    },
    'password-reset-token-ttl': integerParser,
  },
});

/**
 * 认证配置注入令牌
 */
export const authConfig = authDomain.token;
