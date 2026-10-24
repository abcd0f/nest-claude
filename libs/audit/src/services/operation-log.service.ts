import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@app/database';
import type { OperationAuditContext } from '../types/index.js';

/**
 * 操作日志服务
 */
@Injectable()
export class OperationLogService {
  private readonly logger = new Logger(OperationLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 记录操作日志
   */
  async log(context: OperationAuditContext): Promise<void> {
    try {
      await this.prisma.operLog.create({
        data: {
          title: context.title,
          method: context.method,
          requestMethod: context.requestMethod,
          operUserId: context.operUserId,
          operUrl: context.operUrl,
          operIp: context.operIp,
          operParam: context.operParam,
          status: context.status,
          errorMsg: context.errorMsg,
          costTime: context.costTime,
        },
      });
    } catch (error) {
      // 日志记录失败不应阻断业务流程，只记录错误
      this.logger.error(
        `Failed to log operation: ${context.method}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
