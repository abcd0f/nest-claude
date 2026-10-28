import type { PrismaService } from '@app/database';
import { AuditQueryService } from './audit-query.service.js';

describe('audit query service', () => {
  const prisma = {
    $transaction: vi.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
    loginLog: {
      count: vi.fn().mockResolvedValue(11),
      findMany: vi.fn().mockResolvedValue([]),
    },
    operLog: {
      count: vi.fn().mockResolvedValue(6),
      findMany: vi.fn().mockResolvedValue([]),
    },
  } as unknown as PrismaService;
  const service = new AuditQueryService(prisma);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation((queries) =>
      Promise.all(queries) as never,
    );
    vi.mocked(prisma.loginLog.count).mockResolvedValue(11);
    vi.mocked(prisma.loginLog.findMany).mockResolvedValue([]);
    vi.mocked(prisma.operLog.count).mockResolvedValue(6);
    vi.mocked(prisma.operLog.findMany).mockResolvedValue([]);
  });

  it('returns login log pagination in the shared items/meta shape', async () => {
    const result = await service.queryLoginLogs({ page: 2, pageSize: 5 });

    expect(result).toEqual({
      items: [],
      meta: { page: 2, pageSize: 5, total: 11, totalPage: 3 },
    });
    expect(prisma.loginLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    );
  });

  it('returns operation log pagination in the shared items/meta shape', async () => {
    const result = await service.queryOperationLogs({ page: 2, pageSize: 5 });

    expect(result).toEqual({
      items: [],
      meta: { page: 2, pageSize: 5, total: 6, totalPage: 2 },
    });
    expect(prisma.operLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    );
  });
});
