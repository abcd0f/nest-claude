import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@app/database';
import type { LoginAuditContext } from '../types/index.js';

/**
 * 登录日志服务
 */
@Injectable()
export class LoginLogService {
  private readonly logger = new Logger(LoginLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 记录登录日志
   */
  async log(context: LoginAuditContext): Promise<void> {
    try {
      await this.prisma.loginLog.create({
        data: {
          userName: context.userName,
          ipaddr: context.ipaddr,
          userAgent: context.userAgent,
          status: context.status,
          msg: context.msg,
        },
      });
    } catch (error) {
      // 日志记录失败不应阻断业务流程，只记录错误
      this.logger.error(
        `Failed to log login attempt for user ${context.userName}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * 记录登录成功
   */
  async logSuccess(userName: string, ipaddr: string, userAgent: string): Promise<void> {
    await this.log({
      userName,
      ipaddr,
      userAgent,
      status: '0',
      msg: '登录成功',
    });
  }

  /**
   * 记录登录失败
   */
  async logFailure(userName: string, ipaddr: string, userAgent: string, reason: string): Promise<void> {
    await this.log({
      userName,
      ipaddr,
      userAgent,
      status: '1',
      msg: reason,
    });
  }

  /**
   * 记录登出
   */
  async logLogout(userName: string, ipaddr: string, userAgent: string): Promise<void> {
    await this.log({
      userName,
      ipaddr,
      userAgent,
      status: '0',
      msg: '登出成功',
    });
  }
}
