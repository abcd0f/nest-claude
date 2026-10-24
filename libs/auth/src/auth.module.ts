import { CryptoModule } from '@app/crypto';
import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { AuthController } from './controllers/auth.controller.js';
import { AuthGuard } from './guards/auth.guard.js';
import { TokenConfig, TokenService } from './services/token.service.js';

/**
 * 认证模块（AuthModule）
 *
 * 职责：
 * - 用户登录和身份验证
 * - JWT Token 签发和验证
 * - 会话管理
 * - 认证 API 端点
 *
 * 导出：
 * - AuthService：认证业务逻辑
 * - TokenService：Token 管理
 * - AuthGuard：全局认证守卫
 * - AuthController：认证 API
 *
 * 依赖：
 * - DatabaseModule：数据库访问
 * - CryptoModule：密码哈希服务
 * - JwtModule：JWT 处理
 *
 * 配置：
 * JWT 配置从 AuthConfig 环境变量注入，包含：
 * - JWT 签名密钥
 * - Token 过期时间（访问和刷新）
 * - 发行者和受众标识
 *
 * 使用方式：
 * 1. 在 AppModule 中导入 AuthModule
 * 2. 在 CoreModule 中通过 APP_GUARD 注册 AuthGuard
 * 3. 使用 @Public() 标记公开路由
 * 4. 使用 @CurrentUser() 注入当前用户
 * 5. 在需要权限检查的路由上使用 @Permission() 装饰器（待 PermissionModule 实现）
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
    JwtModule.registerAsync({
      useFactory: async (): Promise<any> => {
        // TODO: 从 ConfigService 注入 JWT 配置
        // 临时使用默认配置，生产环境必须从安全配置来源加载
        return {
          secret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
          signOptions: {
            expiresIn: '1h', // 访问 Token 过期时间
            issuer: process.env.JWT_ISSUER || 'nest-admin',
            audience: process.env.JWT_AUDIENCE || 'nest-admin-client',
          },
        };
      },
    }),
  ],
  providers: [
    TokenService,
    {
      provide: 'TOKEN_CONFIG',
      useFactory: (): TokenConfig => ({
        secret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
        accessTokenTtl: parseInt(process.env.JWT_ACCESS_TOKEN_TTL || '3600'), // 1 小时
        refreshTokenTtl: parseInt(process.env.JWT_REFRESH_TOKEN_TTL || '604800'), // 7 天
        issuer: process.env.JWT_ISSUER || 'nest-admin',
        audience: process.env.JWT_AUDIENCE || 'nest-admin-client',
        algorithm: process.env.JWT_ALGORITHM || 'HS256',
      }),
    },
    {
      provide: TokenService,
      useFactory: (jwtService: any, config: TokenConfig) => {
        return new TokenService(jwtService, config);
      },
      inject: ['JwtService', 'TOKEN_CONFIG'],
    },
    AuthService,
    AuthGuard,
  ],
  controllers: [AuthController],
  exports: [AuthService, TokenService, AuthGuard],
})
export class AuthModule {}
