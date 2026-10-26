import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { PermissionGuard } from './guards/permission.guard.js';
import { PermissionService } from './permission.service.js';
import { DataScopeService } from './services/data-scope.service.js';
import { PermissionDiagnosticService } from './services/permission-diagnostic.service.js';
import { PermissionReferenceScanner } from './services/permission-reference.scanner.js';

/**
 * 权限模块
 *
 * 提供：
 * - @Permission 装饰器（用于声明路由权限）
 * - PermissionService（权限解析和缓存）
 * - DataScopeService（数据范围解析）
 * - PermissionGuard（权限守卫）
 * - PermissionDiagnosticService（权限体检与修复）
 * - PermissionReferenceScanner（扫描代码中引用的权限编码）
 *
 * 权限数据来源：**菜单管理**（C/F 节点填写 perms 时自动创建/更新权限行）。
 * 本模块不提供"从代码同步权限"的能力，新增权限请走菜单管理。
 *
 * 使用方式：
 * 1. 在 AppModule 中导入 PermissionModule
 * 2. 在 CoreModule 中通过 APP_GUARD 注册 PermissionGuard
 * 3. 在 Controller 或方法上使用 @Permission 装饰器
 *
 * @example
 * import { Permission, Mode } from '@app/permission';
 *
 * @Get()
 * @Permission('system:user:view')
 * findAll() {}
 */
@Module({
  imports: [DatabaseModule, DiscoveryModule],
  providers: [
    PermissionService,
    DataScopeService,
    PermissionGuard,
    PermissionDiagnosticService,
    PermissionReferenceScanner,
  ],
  exports: [
    PermissionService,
    DataScopeService,
    PermissionGuard,
    PermissionDiagnosticService,
    PermissionReferenceScanner,
  ],
})
export class PermissionModule {}
