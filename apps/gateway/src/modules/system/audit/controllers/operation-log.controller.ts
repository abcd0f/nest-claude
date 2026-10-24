import { Controller, Get, Delete, Query, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { Permission } from '@app/permission';
import { OperationLogQueryDto } from '@app/audit';
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
  async list(@Query() query: OperationLogQueryDto) {
    return this.auditQueryService.queryOperationLogs(query);
  }

  /**
   * 删除操作日志
   */
  @Delete(':operId')
  @Permission('system:operLog:remove')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('operId') operId: string) {
    await this.auditQueryService.deleteOperationLog(operId);
  }

  /**
   * 批量删除操作日志
   */
  @Delete()
  @Permission('system:operLog:remove')
  @HttpCode(HttpStatus.NO_CONTENT)
  async batchDelete(@Body('operIds') operIds: string[]) {
    await this.auditQueryService.batchDeleteOperationLogs(operIds);
  }

  /**
   * 清空操作日志
   */
  @Delete('clear/all')
  @Permission('system:operLog:remove')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clear() {
    await this.auditQueryService.clearOperationLogs();
  }
}
