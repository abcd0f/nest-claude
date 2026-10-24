import { Module, Global } from '@nestjs/common';
import { DatabaseModule } from '@app/database';
import { LoginLogService } from './services/login-log.service.js';
import { OperationLogService } from './services/operation-log.service.js';
import { SensitiveDataService } from './services/sensitive-data.service.js';
import { AuditInterceptor } from './interceptors/audit.interceptor.js';

/**
 * 审计模块
 * 提供登录日志、操作日志、敏感数据脱敏等功能
 */
@Global()
@Module({
  imports: [DatabaseModule],
  providers: [
    LoginLogService,
    OperationLogService,
    SensitiveDataService,
    AuditInterceptor,
  ],
  exports: [
    LoginLogService,
    OperationLogService,
    SensitiveDataService,
    AuditInterceptor,
  ],
})
export class AuditModule {}
