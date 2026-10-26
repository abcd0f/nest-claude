import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
import { LoginLogController } from './controllers/login-log.controller.js';
import { OperationLogController } from './controllers/operation-log.controller.js';
import { AuditQueryService } from './services/audit-query.service.js';

/**
 * 审计查询模块
 * 提供登录日志和操作日志的查询、删除接口
 */
@Module({
  imports: [DatabaseModule],
  controllers: [LoginLogController, OperationLogController],
  providers: [AuditQueryService],
  exports: [AuditQueryService],
})
export class AuditQueryModule {}
