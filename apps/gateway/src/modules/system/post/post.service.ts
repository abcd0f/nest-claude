import { parseId } from '@app/common/utils/bigint.util.js';
import { PrismaService } from '@app/database';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { paginate, makePageMeta } from '@app/common/utils/page.util.js';
import { andWhere } from '@app/common/utils/where.util.js';
import { PageResponseDto } from '@app/common/dto/base.dto.js';
import { CreatePostDto } from './dto/create-post.dto.js';
import { UpdatePostDto } from './dto/update-post.dto.js';
import { PostResponseDto } from './dto/post-response.dto.js';
import { ListPostDto } from './dto/list-post.dto.js';

/**
 * 职位服务
 *
 * 职责：
 * - 职位 CRUD
 * - 列表查询
 */
@Injectable()
export class PostService {
  private readonly logger = new Logger(PostService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 获取职位详情
   * @param postId 职位 ID（字符串）
   * @returns 职位详情
   */
  async getPostById(postId: string): Promise<PostResponseDto> {
    const id = parseId(postId, 'postId');
    const post = await this.prisma.post.findUnique({
      where: { postId: id },
    });

    if (!post) {
      throw new NotFoundException(`职位 ${postId} 不存在`);
    }

    return plainToInstance(PostResponseDto, post, { excludeExtraneousValues: true });
  }

  /**
   * 创建职位
   * @param dto 创建职位 DTO
   * @returns 创建的职位
   */
  async createPost(dto: CreatePostDto): Promise<PostResponseDto> {
    // 检查职位编码是否重复
    const existing = await this.prisma.post.findFirst({
      where: { postCode: dto.postCode },
    });

    if (existing) {
      throw new BadRequestException(`职位编码 ${dto.postCode} 已存在`);
    }

    const post = await this.prisma.post.create({
      data: {
        postCode: dto.postCode,
        postName: dto.postName,
        orderNum: dto.orderNum ?? 0,
        status: dto.status ?? '0',
        remark: dto.remark,
      },
    });

    this.logger.log(`Created post ${post.postId}: ${post.postName}`);

    return plainToInstance(PostResponseDto, post, { excludeExtraneousValues: true });
  }

  /**
   * 更新职位
   * @param postId 职位 ID（字符串）
   * @param dto 更新职位 DTO
   * @returns 更新后的职位
   */
  async updatePost(postId: string, dto: UpdatePostDto): Promise<PostResponseDto> {
    const id = parseId(postId, 'postId');

    // 检查职位是否存在
    const existing = await this.prisma.post.findUnique({ where: { postId: id } });
    if (!existing) {
      throw new NotFoundException(`职位 ${postId} 不存在`);
    }

    // 如果更改职位编码，检查是否重复
    if (dto.postCode && dto.postCode !== existing.postCode) {
      const conflict = await this.prisma.post.findFirst({
        where: { postCode: dto.postCode },
      });
      if (conflict) {
        throw new BadRequestException(`职位编码 ${dto.postCode} 已存在`);
      }
    }

    const post = await this.prisma.post.update({
      where: { postId: id },
      data: {
        ...(dto.postCode && { postCode: dto.postCode }),
        ...(dto.postName && { postName: dto.postName }),
        ...(dto.orderNum !== undefined && { orderNum: dto.orderNum }),
        ...(dto.status && { status: dto.status }),
        updateTime: new Date(),
        remark: dto.remark,
      },
    });

    this.logger.log(`Updated post ${post.postId}: ${post.postName}`);

    return plainToInstance(PostResponseDto, post, { excludeExtraneousValues: true });
  }

  /**
   * 删除职位
   * @param postId 职位 ID（字符串）
   */
  async deletePost(postId: string): Promise<void> {
    const id = parseId(postId, 'postId');

    await this.prisma.$transaction(
      async (tx) => {
        const post = await tx.post.findUnique({
          where: { postId: id },
          include: {
            users: true,
          },
        });

        if (!post) {
          throw new NotFoundException(`职位 ${postId} 不存在`);
        }

        // 检查是否有用户引用
        if (post.users.length > 0) {
          throw new BadRequestException(
            `职位 ${postId} 被用户引用，无法删除。请先解除用户关联。`,
          );
        }

        // 删除职位
        await tx.post.delete({ where: { postId: id } });

        this.logger.log(`Deleted post ${postId}`);
      },
      { timeout: 10_000 },
    );
  }

  /**
   * 获取职位列表
   * @param dto 列表查询 DTO
   * @returns 分页响应
   */
  async listPosts(dto: ListPostDto): Promise<PageResponseDto<PostResponseDto>> {
    const { skip, take, page, pageSize } = paginate({
      page: dto.page,
      pageSize: dto.pageSize,
    });

    const where = andWhere(
      dto.status ? { status: dto.status } : null,
      dto.search
        ? {
            OR: [
              { postCode: { contains: dto.search } },
              { postName: { contains: dto.search } },
            ],
          }
        : null,
      { delFlag: '0' },
    );

    const [items, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take,
        orderBy: { orderNum: 'asc' },
      }),
      this.prisma.post.count({ where }),
    ]);

    const postDtos = items.map((item) =>
      plainToInstance(PostResponseDto, item, { excludeExtraneousValues: true }),
    );

    return {
      items: postDtos,
      meta: makePageMeta(page, pageSize, total),
    };
  }
}
