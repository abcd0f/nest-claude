import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { parseId } from '@app/common';
import type {
  LoginLogQueryDto,
  LoginLogResponseDto,
  OperationLogQueryDto,
  OperationLogResponseDto,
} from '@app/audit';
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

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
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
      records: plainToInstance(
        // Import from the DTO module
        Object as unknown as new () => LoginLogResponseDto,
        records,
        { excludeExtraneousValues: true },
      ),
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

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
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
      records: plainToInstance(
        Object as unknown as new () => OperationLogResponseDto,
        records,
        { excludeExtraneousValues: true },
      ),
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
