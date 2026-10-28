import type { LoginLogQueryDto, OperationLogQueryDto } from '@app/audit';
import type { PageResponseDto } from '@app/common/dto/base.dto.js';
import { LoginLogResponseDto, OperationLogResponseDto } from '@app/audit';
import { makePageMeta, paginate, parseId, toPageDto } from '@app/common';
import { PrismaService } from '@app/database';
import { Injectable } from '@nestjs/common';

/**
 * 审计查询服务
 */
@Injectable()
export class AuditQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 查询登录日志
   */
  async queryLoginLogs(
    query: LoginLogQueryDto,
  ): Promise<PageResponseDto<LoginLogResponseDto>> {
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

    const { skip, take, page, pageSize } = paginate(query);

    const [records, total] = await this.prisma.$transaction([
      this.prisma.loginLog.findMany({
        where,
        orderBy: { loginTime: 'desc' },
        skip,
        take,
      }),
      this.prisma.loginLog.count({ where }),
    ]);

    return toPageDto(LoginLogResponseDto, {
      items: records,
      meta: makePageMeta(page, pageSize, total),
    });
  }

  /**
   * 查询操作日志
   */
  async queryOperationLogs(
    query: OperationLogQueryDto,
  ): Promise<PageResponseDto<OperationLogResponseDto>> {
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

    const { skip, take, page, pageSize } = paginate(query);

    const [records, total] = await this.prisma.$transaction([
      this.prisma.operLog.findMany({
        where,
        orderBy: { operTime: 'desc' },
        skip,
        take,
      }),
      this.prisma.operLog.count({ where }),
    ]);

    return toPageDto(OperationLogResponseDto, {
      items: records,
      meta: makePageMeta(page, pageSize, total),
    });
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
