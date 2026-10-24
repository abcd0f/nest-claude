import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
import { PermissionGuard } from './guards/permission.guard.js';
import { PermissionService } from './permission.service.js';
import { DataScopeService } from './services/data-scope.service.js';

/**
 * 权限模块
 *
 * 提供：
 * - @Permission 装饰器（用于声明路由权限）
 * - PermissionService（权限解析和缓存）
 * - DataScopeService（数据范围解析）
 * - PermissionGuard（权限守卫）
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
  imports: [DatabaseModule],
  providers: [PermissionService, DataScopeService, PermissionGuard],
  exports: [PermissionService, DataScopeService, PermissionGuard],
})
export class PermissionModule {}
