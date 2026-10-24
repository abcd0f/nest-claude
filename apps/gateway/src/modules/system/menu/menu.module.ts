import { Module } from '@nestjs/common';
import { DatabaseModule } from '@app/database';
import { MenuController } from './menu.controller.js';
import { MenuService } from './menu.service.js';

/**
 * 菜单管理模块
 */
@Module({
  imports: [DatabaseModule],
  controllers: [MenuController],
  providers: [MenuService],
  exports: [MenuService],
})
export class MenuModule {}
