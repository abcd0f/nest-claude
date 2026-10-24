import { Module } from '@nestjs/common';
import { DatabaseModule } from '@app/database';
import { RoleController } from './role.controller.js';
import { MenuModule } from '../menu/menu.module.js';

/**
 * 角色管理模块
 */
@Module({
  imports: [DatabaseModule, MenuModule],
  controllers: [RoleController],
})
export class RoleModule {}
