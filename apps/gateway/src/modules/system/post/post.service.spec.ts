import type { PrismaService } from '@app/database';

import { BadRequestException } from '@nestjs/common';
import { PostService } from './post.service.js';

const postRow = {
  postId: 1n,
  postCode: 'dev',
  postName: '开发工程师',
  deptId: 2n,
  orderNum: 1,
  status: '0',
  delFlag: '0',
  createTime: new Date('2026-01-01T00:00:00.000Z'),
  updateTime: null,
  remark: null,
};

const transaction = {
  dept: { findFirst: vi.fn() },
  post: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

const prismaMock = {
  $transaction: vi.fn(async (operation: (tx: typeof transaction) => Promise<unknown>) =>
    operation(transaction),
  ),
  post: {
    count: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
};

const prisma = prismaMock as unknown as PrismaService;
const service = new PostService(prisma);

describe('post service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.post.findMany.mockResolvedValue([postRow]);
    prismaMock.post.count.mockResolvedValue(1);
    prismaMock.post.findFirst.mockResolvedValue(null);
    transaction.post.findUnique.mockResolvedValue(postRow);
    transaction.post.findFirst.mockResolvedValue(null);
    transaction.dept.findFirst.mockResolvedValue({ deptId: 2n });
    transaction.post.create.mockResolvedValue(postRow);
    transaction.post.update.mockResolvedValue(postRow);
  });

  it('filters by the selected department and returns its department ID', async () => {
    const result = await service.listPosts({ deptId: 2n, page: 1, pageSize: 10 });

    const query = vi.mocked(prisma.post.findMany).mock.calls[0]?.[0];
    expect(query?.where).toEqual(
      expect.objectContaining({
        AND: expect.arrayContaining([{ deptId: 2n }]),
      }),
    );
    expect(result.items[0]?.deptId).toBe('2');
  });

  it('creates a post with one department', async () => {
    const result = await service.createPost({
      postCode: 'dev',
      postName: '开发工程师',
      deptId: 2n,
    });

    expect(transaction.post.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ deptId: 2n }),
    });
    expect(result.deptId).toBe('2');
  });

  it('updates and clears a post department with a single ID', async () => {
    transaction.dept.findFirst.mockResolvedValueOnce({ deptId: 3n });
    transaction.post.update.mockResolvedValueOnce({ ...postRow, deptId: 3n });

    const updated = await service.updatePost({ postId: 1n, deptId: 3n });

    expect(transaction.post.update).toHaveBeenCalledWith({
      where: { postId: 1n },
      data: expect.objectContaining({ deptId: 3n }),
    });
    expect(updated.deptId).toBe('3');

    transaction.post.update.mockResolvedValueOnce({ ...postRow, deptId: null });
    const cleared = await service.updatePost({ postId: 1n, deptId: null });
    expect(cleared.deptId).toBeNull();
  });

  it('rejects unknown departments without changing the post', async () => {
    transaction.dept.findFirst.mockResolvedValue(null);

    await expect(service.updatePost({ postId: 1n, deptId: 99n })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(transaction.post.update).not.toHaveBeenCalled();
  });
});
