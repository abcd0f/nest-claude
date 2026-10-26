import { PermissionModule as LibPermissionModule, PermissionSyncService } from '@app/permission';
import { Module } from '@nestjs/common';
import { PermissionManagementController } from './permission-management.controller.js';

/**
 * 权限管理模块
 *
 * 提供权限诊断和管理功能
 */
@Module({
  imports: [LibPermissionModule],
  controllers: [PermissionManagementController],
  providers: [PermissionSyncService],
})
export class PermissionManagementModule {}
