import { Module } from '@nestjs/common';
import { PermissionModule as LibPermissionModule } from '@app/permission';
import { PermissionManagementController } from './permission-management.controller';
import { PermissionSyncService } from '@app/permission/services/permission-sync.service';

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
