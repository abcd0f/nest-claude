import type { PrismaService } from '@app/database';

import { BadRequestException } from '@nestjs/common';
import { DeptService } from './dept.service.js';

const deptRow = {
  deptId: 1n,
  parentId: 0n,
  ancestors: '/',
  deptName: '总公司',
  orderNum: 1,
  leaderId: null,
  status: '0',
  delFlag: '0',
  createTime: new Date('2026-01-01T00:00:00.000Z'),
  updateTime: null,
  remark: null,
};

const transaction = {
  dept: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
};

const prismaMock = {
  $transaction: vi.fn(async (operation: (tx: typeof transaction) => Promise<unknown>) =>
    operation(transaction),
  ),
};

const service = new DeptService(prismaMock as unknown as PrismaService);

describe('dept service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.dept.findUnique.mockResolvedValue(deptRow);
    transaction.dept.findFirst.mockResolvedValue(null);
    transaction.dept.update.mockResolvedValue({ ...deptRow, status: '1' });
  });

  it('rejects disabling a department with an enabled descendant', async () => {
    transaction.dept.findFirst.mockResolvedValue({ deptId: 2n });

    await expect(service.updateDept(1n, { status: '1' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(transaction.dept.update).not.toHaveBeenCalled();
    expect(transaction.dept.findFirst).toHaveBeenCalledWith({
      where: {
        ancestors: { contains: '/1/' },
        status: '0',
        delFlag: '0',
      },
      select: { deptId: true },
    });
  });

  it('allows disabling a department when all descendants are disabled', async () => {
    const result = await service.updateDept(1n, { status: '1' });

    expect(transaction.dept.update).toHaveBeenCalledWith({
      where: { deptId: 1n },
      data: expect.objectContaining({ status: '1' }),
    });
    expect(result.status).toBe('1');
  });
});
