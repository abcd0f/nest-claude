import type { LoginLogQueryDto, OperationLogQueryDto } from '@app/audit';
import { LoginLogResponseDto, OperationLogResponseDto } from '@app/audit';
import { parseId } from '@app/common';
import { PrismaService } from '@app/database';
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

/**
 * 审计查询服务
 */
@Injectable()
export class AuditQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 查询登录日志
   */
  async queryLoginLogs(query: LoginLogQueryDto) {
    const where: {
      userName?: { contains: string };
      ipaddr?: { contains: string };
      status?: string;
      loginTime?: { gte?: Date; lte?: Date };
    } = {};

    if (query.userName) {
      where.userName = { contains: query.userName };
    }

    if (query.ipaddr) {
      where.ipaddr = { contains: query.ipaddr };
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.startTime || query.endTime) {
      where.loginTime = {};
      if (query.startTime) {
        where.loginTime.gte = query.startTime;
      }
      if (query.endTime) {
        where.loginTime.lte = query.endTime;
      }
    }

    // 项目未注册全局 ValidationPipe，query 参数仍是字符串。
    // 这里显式转数字，否则 Prisma 的 skip/take 会因类型不符抛 PrismaClientValidationError。
    const page = Math.max(Number(query.page ?? 1) || 1, 1);
    const pageSize = Math.max(Number(query.pageSize ?? 10) || 10, 1);
    const skip = (page - 1) * pageSize;

    const [records, total] = await this.prisma.$transaction([
      this.prisma.loginLog.findMany({
        where,
        orderBy: { loginTime: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.loginLog.count({ where }),
    ]);

    return {
      records: plainToInstance(LoginLogResponseDto, records, {
        excludeExtraneousValues: true,
      }),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 查询操作日志
   */
  async queryOperationLogs(query: OperationLogQueryDto) {
    const where: {
      title?: { contains: string };
      operUserId?: bigint;
      status?: string;
      operTime?: { gte?: Date; lte?: Date };
    } = {};

    if (query.title) {
      where.title = { contains: query.title };
    }

    if (query.operUserId) {
      where.operUserId = parseId(query.operUserId, 'operUserId');
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.startTime || query.endTime) {
      where.operTime = {};
      if (query.startTime) {
        where.operTime.gte = query.startTime;
      }
      if (query.endTime) {
        where.operTime.lte = query.endTime;
      }
    }

    // 项目未注册全局 ValidationPipe，query 参数仍是字符串。
    // 这里显式转数字，否则 Prisma 的 skip/take 会因类型不符抛 PrismaClientValidationError。
    const page = Math.max(Number(query.page ?? 1) || 1, 1);
    const pageSize = Math.max(Number(query.pageSize ?? 10) || 10, 1);
    const skip = (page - 1) * pageSize;

    const [records, total] = await this.prisma.$transaction([
      this.prisma.operLog.findMany({
        where,
        orderBy: { operTime: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.operLog.count({ where }),
    ]);

    return {
      records: plainToInstance(OperationLogResponseDto, records, {
        excludeExtraneousValues: true,
      }),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 删除登录日志
   */
  async deleteLoginLog(infoId: string): Promise<void> {
    const id = parseId(infoId, 'infoId');
    await this.prisma.loginLog.delete({
      where: { infoId: id },
    });
  }

  /**
   * 删除操作日志
   */
  async deleteOperationLog(operId: string): Promise<void> {
    const id = parseId(operId, 'operId');
    await this.prisma.operLog.delete({
      where: { operId: id },
    });
  }

  /**
   * 批量删除登录日志
   */
  async batchDeleteLoginLogs(infoIds: string[]): Promise<number> {
    const ids = infoIds.map((id) => parseId(id, 'infoId'));
    const result = await this.prisma.loginLog.deleteMany({
      where: { infoId: { in: ids } },
    });
    return result.count;
  }

  /**
   * 批量删除操作日志
   */
  async batchDeleteOperationLogs(operIds: string[]): Promise<number> {
    const ids = operIds.map((id) => parseId(id, 'operId'));
    const result = await this.prisma.operLog.deleteMany({
      where: { operId: { in: ids } },
    });
    return result.count;
  }

  /**
   * 清空登录日志
   */
  async clearLoginLogs(): Promise<void> {
    await this.prisma.loginLog.deleteMany({});
  }

  /**
   * 清空操作日志
   */
  async clearOperationLogs(): Promise<void> {
    await this.prisma.operLog.deleteMany({});
  }
}
