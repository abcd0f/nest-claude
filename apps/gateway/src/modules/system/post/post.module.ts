import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';
import { PostController } from './post.controller.js';
import { PostService } from './post.service.js';

/**
 * 职位管理模块
 */
@Module({
  imports: [DatabaseModule],
  controllers: [PostController],
  providers: [PostService],
  exports: [PostService],
})
export class PostModule {}
