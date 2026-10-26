import {
  Permission,
  PERMISSION_SEEDS,
  PermissionDiagnosticResult,
  PermissionService,
  PermissionSyncResult,
  PermissionSyncService,
} from '@app/permission';
import { Controller, Delete, Get, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

/**
 * 权限管理控制器
 *
 * 提供权限诊断和管理的 API 接口
 * 这些接口主要用于系统管理员进行权限维护
 */
@ApiTags('权限管理')
@Controller('system/permission')
export class PermissionManagementController {
  private readonly logger = new Logger(PermissionManagementController.name);

  constructor(
    private readonly syncService: PermissionSyncService,
    private readonly permissionService: PermissionService,
  ) {}

  /**
   * 权限诊断检查
   *
   * 检查权限健康状态：
   * - 统计权限数量
   * - 查找未绑定菜单的权限
   * - 查找孤儿权限（没有角色使用）
   * - 查找重复编码
   * - 查找无效的菜单绑定
   */
  @Get('check')
  @Permission('system:permission:check')
  @ApiOperation({ summary: '权限诊断检查' })
  @ApiResponse({ status: 200, description: '权限诊断结果' })
  async check(): Promise<PermissionDiagnosticResult> {
    this.logger.log('Running permission check');
    return this.syncService.checkPermissions();
  }

  /**
   * 同步权限种子
   *
   * 将代码中定义的权限种子同步到数据库：
   * - 创建不存在的权限
   * - 更新已存在的权限信息
   * - 标记孤儿权限（数据库中存在但种子中不存在）
   */
  @Post('sync')
  @Permission('system:permission:sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '同步权限种子' })
  @ApiResponse({ status: 200, description: '同步结果' })
  async sync(): Promise<PermissionSyncResult> {
    this.logger.log('Syncing permissions from seeds');
    return this.syncService.syncPermissions(PERMISSION_SEEDS);
  }

  /**
   * 清理孤儿权限
   *
   * 删除以下权限：
   * - 未绑定菜单
   * - 没有任何角色使用
   *
   * 注意：此操作不可逆，请谨慎使用
   */
  @Delete('orphans')
  @Permission('system:permission:cleanup')
  @ApiOperation({ summary: '清理孤儿权限' })
  @ApiResponse({ status: 200, description: '清理的权限数量' })
  async cleanupOrphans(): Promise<{ count: number; message: string }> {
    this.logger.warn('Cleaning up orphan permissions');
    const count = await this.syncService.cleanupOrphanPermissions();
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
    const count = await this.syncService.fixInvalidMenuBindings();
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

  /**
   * 获取权限种子定义
   *
   * 返回代码中定义的所有权限种子，用于查看系统权限清单
   */
  @Get('seeds')
  @Permission('system:permission:view')
  @ApiOperation({ summary: '获取权限种子定义' })
  @ApiResponse({ status: 200, description: '权限种子列表' })
  async getSeeds(): Promise<{
    total: number;
    seeds: typeof PERMISSION_SEEDS;
  }> {
    return {
      total: PERMISSION_SEEDS.length,
      seeds: PERMISSION_SEEDS,
    };
  }
}
