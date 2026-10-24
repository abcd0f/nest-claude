import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
import { DeptController } from './dept.controller.js';
import { DeptService } from './dept.service.js';

/**
 * 部门管理模块
 */
@Module({
  imports: [DatabaseModule],
  controllers: [DeptController],
  providers: [DeptService],
  exports: [DeptService],
})
export class DeptModule {}
