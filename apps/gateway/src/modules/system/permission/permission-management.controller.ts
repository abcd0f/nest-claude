import {
  Permission,
  PermissionDiagnosticResult,
  PermissionDiagnosticService,
  PermissionReferenceCheckResult,
  PermissionService,
} from '@app/permission';
import { Controller, Delete, Get, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

/**
 * 权限管理控制器
 *
 * 提供权限诊断和维护接口，面向系统管理员。
 *
 * 注意：**没有"同步权限"接口**。权限的唯一创建入口是菜单管理 ——
 * 在菜单里新增 C/F 节点并填写 `perms` 时，权限行会自动创建或更新。
 * 这里只负责体检、对账和修复。
 */
@ApiTags('权限管理')
@Controller('system/permission')
export class PermissionManagementController {
  private readonly logger = new Logger(PermissionManagementController.name);

  constructor(
    private readonly diagnosticService: PermissionDiagnosticService,
    private readonly permissionService: PermissionService,
  ) {}

  /**
   * 权限数据体检
   *
   * 检查权限健康状态：
   * - 统计权限数量
   * - 未绑定菜单的权限（菜单优先架构下属于异常）
   * - 孤儿权限（未绑菜单且无角色使用，可清理）
   * - 未授权权限（无角色使用，属正常）
   * - 重复编码、无效的菜单绑定
   */
  @Get('check')
  @Permission('system:permission:check')
  @ApiOperation({ summary: '权限数据体检' })
  @ApiResponse({ status: 200, description: '权限诊断结果' })
  async check(): Promise<PermissionDiagnosticResult> {
    this.logger.log('Running permission check');
    return this.diagnosticService.checkPermissions();
  }

  /**
   * 代码引用一致性检查
   *
   * 扫描所有 Controller 上 `@Permission` 声明的权限编码，与数据库权限行做双向差集：
   * - `missing`：代码引用了但数据库没有 → 相关接口对非超管用户返回 403，必须在菜单里补上
   * - `unused`：数据库有但代码没引用 → 可能是纯前端按钮权限，也可能是废弃权限
   *
   * 这是菜单优先架构下替代编译期校验的护栏，建议每次发版前跑一次。
   */
  @Get('references')
  @Permission('system:permission:check')
  @ApiOperation({ summary: '代码引用一致性检查' })
  @ApiResponse({ status: 200, description: '引用检查结果' })
  async checkReferences(): Promise<PermissionReferenceCheckResult> {
    this.logger.log('Running permission reference check');
    return this.diagnosticService.checkCodeReferences();
  }

  /**
   * 清理孤儿权限
   *
   * 仅删除同时满足以下条件的权限：
   * - 未绑定任何菜单
   * - 没有任何角色引用
   *
   * 只要还有菜单入口或角色持有，就不会被删除。
   *
   * 注意：此操作不可逆，请谨慎使用
   */
  @Delete('orphans')
  @Permission('system:permission:cleanup')
  @ApiOperation({ summary: '清理孤儿权限' })
  @ApiResponse({ status: 200, description: '清理的权限数量' })
  async cleanupOrphans(): Promise<{ count: number; message: string }> {
    this.logger.warn('Cleaning up orphan permissions');
    const count = await this.diagnosticService.cleanupOrphanPermissions();
    return {
      count,
      message: `Successfully cleaned up ${count} orphan permissions`,
    };
  }

  /**
   * 修复无效的菜单绑定
   *
   * 将绑定了不存在菜单的权限解除绑定
   */
  @Post('fix-bindings')
  @Permission('system:permission:fix')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '修复无效的菜单绑定' })
  @ApiResponse({ status: 200, description: '修复的权限数量' })
  async fixBindings(): Promise<{ count: number; message: string }> {
    this.logger.log('Fixing invalid menu bindings');
    const count = await this.diagnosticService.fixInvalidMenuBindings();
    return {
      count,
      message: `Successfully fixed ${count} invalid menu bindings`,
    };
  }

  /**
   * 清除所有权限缓存
   *
   * 强制清除所有用户的权限缓存，下次访问时会重新加载
   * 使用场景：
   * - 批量权限变更后
   * - 缓存出现问题时
   */
  @Post('cache/clear')
  @Permission('system:permission:cache')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '清除所有权限缓存' })
  @ApiResponse({ status: 200, description: '缓存已清除' })
  async clearCache(): Promise<{ message: string }> {
    this.logger.warn('Clearing all permission cache');
    this.permissionService.clearAllCache();
    return {
      message: 'All permission cache cleared successfully',
    };
  }
}
