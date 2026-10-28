import type { PageResponseDto } from '@app/common/dto/base.dto.js';
import { Audit, LoginLogQueryDto, LoginLogResponseDto, OperationType } from '@app/audit';
import { Permission } from '@app/permission';
import { Body, Controller, Delete, Get, Param, Query } from '@nestjs/common';
import { AuditQueryService } from '../services/audit-query.service.js';

/**
 * 登录日志控制器
 */
@Controller('system/login-log')
export class LoginLogController {
  constructor(private readonly auditQueryService: AuditQueryService) {}

  /**
   * 查询登录日志列表
   */
  @Get()
  @Permission('system:loginLog:view')
  async list(
    @Query() query: LoginLogQueryDto,
  ): Promise<PageResponseDto<LoginLogResponseDto>> {
    return this.auditQueryService.queryLoginLogs(query);
  }

  /**
   * 删除登录日志
   */
  @Delete(':infoId')
  @Audit({ title: '删除登录日志', operationType: OperationType.DELETE })
  @Permission('system:loginLog:remove')
  async delete(@Param('infoId') infoId: string) {
    await this.auditQueryService.deleteLoginLog(infoId);
  }

  /**
   * 批量删除登录日志
   */
  @Delete()
  @Audit({ title: '批量删除登录日志', operationType: OperationType.DELETE })
  @Permission('system:loginLog:remove')
  async batchDelete(@Body('infoIds') infoIds: string[]) {
    await this.auditQueryService.batchDeleteLoginLogs(infoIds);
  }

  /**
   * 清空登录日志
   */
  @Delete('clear/all')
  @Permission('system:loginLog:remove')
  async clear() {
    await this.auditQueryService.clearLoginLogs();
  }
}
