import type { PageResponseDto } from '@app/common/dto/base.dto.js';
import { OperationLogQueryDto, OperationLogResponseDto } from '@app/audit';
import { Permission } from '@app/permission';
import { Body, Controller, Delete, Get, Param, Query } from '@nestjs/common';
import { AuditQueryService } from '../services/audit-query.service.js';

/**
 * 操作日志控制器
 */
@Controller('system/operation-log')
export class OperationLogController {
  constructor(private readonly auditQueryService: AuditQueryService) {}

  /**
   * 查询操作日志列表
   */
  @Get()
  @Permission('system:operLog:view')
  async list(
    @Query() query: OperationLogQueryDto,
  ): Promise<PageResponseDto<OperationLogResponseDto>> {
    return this.auditQueryService.queryOperationLogs(query);
  }

  /**
   * 删除操作日志
   */
  @Delete(':operId')
  @Permission('system:operLog:remove')
  async delete(@Param('operId') operId: string) {
    await this.auditQueryService.deleteOperationLog(operId);
  }

  /**
   * 批量删除操作日志
   */
  @Delete()
  @Permission('system:operLog:remove')
  async batchDelete(@Body('operIds') operIds: string[]) {
    await this.auditQueryService.batchDeleteOperationLogs(operIds);
  }

  /**
   * 清空操作日志
   */
  @Delete('clear/all')
  @Permission('system:operLog:remove')
  async clear() {
    await this.auditQueryService.clearOperationLogs();
  }
}
