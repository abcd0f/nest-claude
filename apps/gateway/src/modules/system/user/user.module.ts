import { Module } from '@nestjs/common';
import { DatabaseModule } from '@app/database';
import { UserController } from './user.controller.js';
import { UserService } from './user.service.js';

/**
 * 用户管理模块
 */
@Module({
  imports: [DatabaseModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
