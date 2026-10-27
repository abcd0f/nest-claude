import type { AuthConfig } from '@app/config';
import { CacheModule } from '@app/cache';
import { authConfig } from '@app/config';
import { CryptoModule } from '@app/crypto';
import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './guards/auth.guard.js';
import { RefreshTokenStore } from './services/refresh-token.store.js';
import { SessionStore } from './services/session.store.js';
import { TokenService } from './services/token.service.js';

/**
 * 认证模块（AuthModule）
 *
 * 职责：
 * - 用户登录和身份验证
 * - JWT Token 签发和验证
 * - 会话管理
 *
 * 不提供 HTTP 控制器：`/auth/*` 路由统一由 apps 层的
 * `AuthGatewayController` 注册。本模块若再注册控制器，
 * 会导致同一路由被注册两次（Fastify FST_ERR_DUPLICATED_ROUTE）。
 *
 * 导出：
 * - AuthService：认证业务逻辑
 * - TokenService：Token 管理
 * - AuthGuard：全局认证守卫
 *
 * 依赖：
 * - DatabaseModule：数据库访问
 * - CryptoModule：密码哈希服务
 * - JwtModule：JWT 处理
 *
 * 配置：
 * JWT 配置从 authConfig 注入，包含：
 * - JWT 访问令牌和刷新令牌密钥
 * - Token 过期时间（访问和刷新）
 * - 发行者和受众标识
 * - 刷新令牌轮换策略
 *
 * 使用方式：
 * 1. 在 AppModule 中导入 AuthModule
 * 2. 在 CoreModule 中通过 APP_GUARD 注册 AuthGuard
 * 3. 使用 @Public() 标记公开路由
 * 4. 使用 @CurrentUser() 注入当前用户
 * 5. 在需要权限检查的路由上使用 @Permission() 装饰器
 *
 * @example
 * // app.module.ts
 * @Module({
 *   imports: [AuthModule, CoreModule, ...],
 * })
 * export class AppModule {}
 *
 * @example
 * // core.module.ts
 * @Module({
 *   providers: [
 *     { provide: APP_GUARD, useClass: AuthGuard },
 *   ],
 * })
 * export class CoreModule {}
 */
@Module({
  imports: [
    DatabaseModule,
    CryptoModule,
    CacheModule,
    JwtModule.registerAsync({
      inject: [authConfig.KEY],
      useFactory: (config: AuthConfig) => ({
        secret: config.accessTokenSecret,
        signOptions: {
          expiresIn: `${config.accessTokenTtl}s`,
          issuer: config.issuer,
          audience: config.audience,
        },
      }),
    }),
  ],
  providers: [TokenService, RefreshTokenStore, SessionStore, AuthService, AuthGuard],
  // SessionStore 需导出：AuthGuard 在 CoreModule 中通过 APP_GUARD useClass 重新实例化，
  // 依赖要在 CoreModule 的注入上下文里可解析。
  exports: [AuthService, TokenService, AuthGuard, SessionStore],
})
export class AuthModule {}
