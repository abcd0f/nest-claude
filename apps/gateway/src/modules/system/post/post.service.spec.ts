import type { PrismaService } from '@app/database';

import { BadRequestException } from '@nestjs/common';
import { PostService } from './post.service.js';

const postRow = {
  postId: 1n,
  postCode: 'dev',
  postName: '开发工程师',
  orderNum: 1,
  status: '0',
  delFlag: '0',
  createTime: new Date('2026-01-01T00:00:00.000Z'),
  updateTime: null,
  remark: null,
};

const transaction = {
  dept: { findMany: vi.fn() },
  post: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
  postDept: {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
};

const prismaMock = {
  $transaction: vi.fn(async (operation: (tx: typeof transaction) => Promise<unknown>) =>
    operation(transaction),
  ),
  post: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
};

const prisma = prismaMock as unknown as PrismaService;
const service = new PostService(prisma);

describe('post service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.post.findMany.mockResolvedValue([{ ...postRow, deptPosts: [{ deptId: 2n }] }]);
    prismaMock.post.count.mockResolvedValue(1);
    transaction.post.findUnique.mockResolvedValue(postRow);
    transaction.post.findFirst.mockResolvedValue(null);
    transaction.dept.findMany.mockResolvedValue([{ deptId: 2n }, { deptId: 3n }]);
    transaction.post.update.mockResolvedValue(postRow);
    transaction.post.findUniqueOrThrow.mockResolvedValue({
      ...postRow,
      deptPosts: [{ deptId: 2n }, { deptId: 3n }],
    });
  });

  it('filters by the selected department and returns its department IDs', async () => {
    const result = await service.listPosts({ deptId: 2n, page: 1, pageSize: 10 });

    const query = vi.mocked(prisma.post.findMany).mock.calls[0]?.[0];
    expect(query?.where).toEqual(
      expect.objectContaining({
        AND: expect.arrayContaining([{ deptPosts: { some: { deptId: 2n } } }]),
      }),
    );
    expect(result.items[0]?.deptIds).toEqual(['2']);
  });

  it('replaces department assignments in the same transaction as the post update', async () => {
    const result = await service.updatePost(1n, { deptIds: [2n, 3n] });

    expect(transaction.postDept.deleteMany).toHaveBeenCalledWith({
      where: { postId: 1n },
    });
    expect(transaction.postDept.createMany).toHaveBeenCalledWith({
      data: [
        { postId: 1n, deptId: 2n },
        { postId: 1n, deptId: 3n },
      ],
    });
    expect(result.deptIds).toEqual(['2', '3']);
  });

  it('rejects unknown departments without changing the post', async () => {
    transaction.dept.findMany.mockResolvedValue([]);

    await expect(service.updatePost(1n, { deptIds: [99n] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(transaction.post.update).not.toHaveBeenCalled();
    expect(transaction.postDept.deleteMany).not.toHaveBeenCalled();
  });
});
