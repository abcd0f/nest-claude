import { AuditModule } from '@app/audit';
import { AuthModule } from '@app/auth';
import { Module } from '@nestjs/common';
import { AuthGatewayController } from './auth-gateway.controller.js';

/**
 * 认证网关模块
 * 提供登录、登出、刷新Token等HTTP接口
 */
@Module({
  imports: [AuthModule, AuditModule],
  controllers: [AuthGatewayController],
})
export class AuthGatewayModule {}
