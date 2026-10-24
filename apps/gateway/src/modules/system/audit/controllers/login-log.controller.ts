import { Controller, Get, Delete, Query, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { Permission } from '@app/permission';
import { LoginLogQueryDto } from '@app/audit';
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
  async list(@Query() query: LoginLogQueryDto) {
    return this.auditQueryService.queryLoginLogs(query);
  }

  /**
   * 删除登录日志
   */
  @Delete(':infoId')
  @Permission('system:loginLog:remove')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('infoId') infoId: string) {
    await this.auditQueryService.deleteLoginLog(infoId);
  }

  /**
   * 批量删除登录日志
   */
  @Delete()
  @Permission('system:loginLog:remove')
  @HttpCode(HttpStatus.NO_CONTENT)
  async batchDelete(@Body('infoIds') infoIds: string[]) {
    await this.auditQueryService.batchDeleteLoginLogs(infoIds);
  }

  /**
   * 清空登录日志
   */
  @Delete('clear/all')
  @Permission('system:loginLog:remove')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clear() {
    await this.auditQueryService.clearLoginLogs();
  }
}
