import { PageResponseDto } from '@app/common/dto/base.dto.js';
import { Permission } from '@app/permission';
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto.js';
import { ListPostDto } from './dto/list-post.dto.js';
import { PostIdParamDto } from './dto/post-id-param.dto.js';
import { PostResponseDto } from './dto/post-response.dto.js';
import { UpdatePostDto } from './dto/update-post.dto.js';
import { PostService } from './post.service.js';

/**
 * 职位管理控制器
 */
@Controller('system/post')
export class PostController {
  constructor(private readonly postService: PostService) {}

  /**
   * 获取职位详情
   * GET /system/post/:postId
   */
  @Get(':postId')
  @Permission('system:post:view')
  async getPostById(@Param() params: PostIdParamDto): Promise<PostResponseDto> {
    return this.postService.getPostById(params.postId);
  }

  /**
   * 创建职位
   * POST /system/post
   */
  @Post()
  @Permission('system:post:add')
  async createPost(@Body() dto: CreatePostDto): Promise<PostResponseDto> {
    return this.postService.createPost(dto);
  }

  /**
   * 更新职位
   * PUT /system/post/:postId
   */
  @Put(':postId')
  @Permission('system:post:edit')
  async updatePost(
    @Param() params: PostIdParamDto,
    @Body() dto: UpdatePostDto,
  ): Promise<PostResponseDto> {
    return this.postService.updatePost(params.postId, dto);
  }

  /**
   * 删除职位
   * DELETE /system/post/:postId
   */
  @Delete(':postId')
  @Permission('system:post:remove')
  async deletePost(@Param() params: PostIdParamDto): Promise<void> {
    return this.postService.deletePost(params.postId);
  }

  /**
   * 获取职位列表
   * GET /system/post?page=1&pageSize=20&search=&status=0
   */
  @Get()
  @Permission('system:post:view')
  async listPosts(@Query() dto: ListPostDto): Promise<PageResponseDto<PostResponseDto>> {
    return this.postService.listPosts(dto);
  }
}
