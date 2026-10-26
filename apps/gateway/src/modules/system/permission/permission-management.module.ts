import { PermissionModule as LibPermissionModule } from '@app/permission';
import { Module } from '@nestjs/common';
import { PermissionManagementController } from './permission-management.controller.js';

/**
 * 权限管理模块
 *
 * 提供权限诊断和修复接口。
 * 依赖（PermissionDiagnosticService / PermissionReferenceScanner）由 LibPermissionModule 统一导出，
 * 此处不重复 provide，避免同一 token 出现两个实例。
 */
@Module({
  imports: [LibPermissionModule],
  controllers: [PermissionManagementController],
})
export class PermissionManagementModule {}
