import { andWhere, makePageMeta, PageResponseDto, paginate, toDto } from '@app/common';
import { Prisma, PrismaService } from '@app/database';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto.js';
import { ListPostDto } from './dto/list-post.dto.js';
import { PostResponseDto } from './dto/post-response.dto.js';
import { UpdatePostDto } from './dto/update-post.dto.js';

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
   * @param postId 职位 ID（bigint）
   * @returns 职位详情
   */
  async getPostById(postId: bigint): Promise<PostResponseDto> {
    const post = await this.prisma.post.findUnique({
      where: { postId },
    });

    if (!post) {
      throw new NotFoundException(`职位 ${postId} 不存在`);
    }

    return this.toPostResponse(post);
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

    const deptId = dto.deptId ?? null;

    return this.prisma.$transaction(async (tx) => {
      await this.assertDeptExists(deptId, tx);

      const created = await tx.post.create({
        data: {
          postCode: dto.postCode,
          postName: dto.postName,
          deptId,
          orderNum: dto.orderNum ?? 0,
          status: dto.status ?? '0',
          remark: dto.remark,
        },
      });

      this.logger.log(`Created post ${created.postId}: ${created.postName}`);

      return this.toPostResponse(created);
    });
  }

  /**
   * 更新职位
   * @param postId 职位 ID（bigint）
   * @param dto 更新职位 DTO
   * @returns 更新后的职位
   */
  async updatePost(postId: bigint, dto: UpdatePostDto): Promise<PostResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.post.findUnique({ where: { postId } });
      if (!existing) {
        throw new NotFoundException(`职位 ${postId} 不存在`);
      }

      if (dto.postCode && dto.postCode !== existing.postCode) {
        const conflict = await tx.post.findFirst({
          where: { postCode: dto.postCode },
        });
        if (conflict) {
          throw new BadRequestException(`职位编码 ${dto.postCode} 已存在`);
        }
      }

      if (dto.deptId !== undefined) {
        await this.assertDeptExists(dto.deptId, tx);
      }

      const updated = await tx.post.update({
        where: { postId },
        data: {
          ...(dto.postCode && { postCode: dto.postCode }),
          ...(dto.postName && { postName: dto.postName }),
          ...(dto.deptId !== undefined ? { deptId: dto.deptId } : {}),
          ...(dto.orderNum !== undefined && { orderNum: dto.orderNum }),
          ...(dto.status && { status: dto.status }),
          remark: dto.remark,
        },
      });

      this.logger.log(`Updated post ${updated.postId}: ${updated.postName}`);

      return this.toPostResponse(updated);
    });
  }

  /**
   * 删除职位
   * @param postId 职位 ID（bigint）
   */
  async deletePost(postId: bigint): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        const post = await tx.post.findUnique({
          where: { postId },
          include: {
            users: true,
          },
        });

        if (!post) {
          throw new NotFoundException(`职位 ${postId} 不存在`);
        }

        // 检查是否有用户引用
        if (post.users.length > 0) {
          throw new BadRequestException(`职位 ${postId} 被用户引用，无法删除。请先解除用户关联。`);
        }

        // 删除职位
        await tx.post.delete({ where: { postId } });

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
            OR: [{ postCode: { contains: dto.search } }, { postName: { contains: dto.search } }],
          }
        : null,
      dto.deptId !== undefined ? { deptId: dto.deptId } : null,
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

    return {
      items: items.map((post) => this.toPostResponse(post)),
      meta: makePageMeta(page, pageSize, total),
    };
  }

  private toPostResponse<T extends { deptId: bigint | null }>(post: T) {
    const response = toDto(PostResponseDto, post);
    response.deptId = post.deptId?.toString() ?? null;
    return response;
  }

  private async assertDeptExists(deptId: bigint | null, tx: Prisma.TransactionClient) {
    if (deptId === null) return;

    const dept = await tx.dept.findFirst({
      where: { deptId, delFlag: '0' },
      select: { deptId: true },
    });
    if (!dept) {
      throw new BadRequestException(`部门 ${deptId} 不存在`);
    }
  }
}
