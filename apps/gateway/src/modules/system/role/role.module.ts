import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
import { MenuModule } from '../menu/menu.module.js';
import { RoleController } from './role.controller.js';
import { RoleService } from './role.service.js';

/**
 * 角色管理模块
 */
@Module({
  imports: [DatabaseModule, MenuModule],
  controllers: [RoleController],
  providers: [RoleService],
  exports: [RoleService],
})
export class RoleModule {}
