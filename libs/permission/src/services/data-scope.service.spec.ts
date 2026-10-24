import { Test, TestingModule } from '@nestjs/testing';
import { DataScopeService } from './data-scope.service.js';
import { DataScope } from '../enums/data-scope.enum.js';
import { PrismaService } from '@app/database';

describe('DataScopeService', () => {
  let service: DataScopeService;
  let prisma: PrismaService;

  const mockPrisma = {
    userRole: {
      findMany: jest.fn(),
    },
    dept: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataScopeService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<DataScopeService>(DataScopeService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveUserScope', () => {
    it('应该返回空范围（SELF）当用户没有有效角色时', async () => {
      mockPrisma.userRole.findMany.mockResolvedValue([]);

      const result = await service.resolveUserScope(1n);

      expect(result).toEqual({ kind: DataScope.SELF });
      expect(mockPrisma.userRole.findMany).toHaveBeenCalledWith({
        where: {
          userId: 1n,
          user: { status: '0', delFlag: '0' },
          role: { status: '0', delFlag: '0' },
        },
        include: {
          role: {
            select: {
              dataScope: true,
              depts: { select: { deptId: true } },
            },
          },
        },
      });
    });

    it('应该返回 ALL 当任意角色是 ALL 时', async () => {
      mockPrisma.userRole.findMany.mockResolvedValue([
        {
          role: {
            dataScope: DataScope.DEPT,
            depts: [],
          },
        },
        {
          role: {
            dataScope: DataScope.ALL,
            depts: [],
          },
        },
      ]);

      const result = await service.resolveUserScope(1n);

      expect(result).toEqual({ kind: DataScope.ALL });
    });

    it('应该返回 CUSTOM 当有 CUSTOM 角色且有部门时', async () => {
      mockPrisma.userRole.findMany.mockResolvedValue([
        {
          role: {
            dataScope: DataScope.CUSTOM,
            depts: [{ deptId: 1n }, { deptId: 2n }],
          },
        },
      ]);

      const result = await service.resolveUserScope(1n);

      expect(result).toEqual({
        kind: DataScope.CUSTOM,
        deptIds: [1n, 2n],
      });
    });

    it('应该合并多个 CUSTOM 角色的部门', async () => {
      mockPrisma.userRole.findMany.mockResolvedValue([
        {
          role: {
            dataScope: DataScope.CUSTOM,
            depts: [{ deptId: 1n }, { deptId: 2n }],
          },
        },
        {
          role: {
            dataScope: DataScope.CUSTOM,
            depts: [{ deptId: 2n }, { deptId: 3n }],
          },
        },
      ]);

      const result = await service.resolveUserScope(1n);

      expect(result).toEqual({
        kind: DataScope.CUSTOM,
        deptIds: expect.arrayContaining([1n, 2n, 3n]),
      });
      expect(result.kind === DataScope.CUSTOM && result.deptIds.length).toBe(3);
    });

    it('应该返回 DEPT_AND_CHILD 当有该范围的角色时', async () => {
      mockPrisma.userRole.findMany.mockResolvedValue([
        {
          role: {
            dataScope: DataScope.DEPT_AND_CHILD,
            depts: [],
          },
        },
      ]);

      const result = await service.resolveUserScope(1n);

      expect(result).toEqual({
        kind: DataScope.DEPT_AND_CHILD,
        deptIds: [],
      });
    });

    it('应该返回 DEPT 当没有更高优先级的范围时', async () => {
      mockPrisma.userRole.findMany.mockResolvedValue([
        {
          role: {
            dataScope: DataScope.DEPT,
            depts: [],
          },
        },
      ]);

      const result = await service.resolveUserScope(1n);

      expect(result).toEqual({ kind: DataScope.DEPT });
    });

    it('应该返回 SELF 当所有角色都是 SELF 时', async () => {
      mockPrisma.userRole.findMany.mockResolvedValue([
        {
          role: {
            dataScope: DataScope.SELF,
            depts: [],
          },
        },
      ]);

      const result = await service.resolveUserScope(1n);

      expect(result).toEqual({ kind: DataScope.SELF });
    });
  });

  describe('buildUserWhereCondition', () => {
    it('应该为 ALL 范围返回空对象', async () => {
      const condition = await service.buildUserWhereCondition(
        { kind: DataScope.ALL },
        10n,
        1n,
      );

      expect(condition).toEqual({});
    });

    it('应该为 DEPT 范围返回按 deptId 的条件', async () => {
      const condition = await service.buildUserWhereCondition(
        { kind: DataScope.DEPT },
        10n,
        1n,
      );

      expect(condition).toEqual({ deptId: 10n });
    });

    it('应该为 DEPT 范围且用户无部门时返回不匹配条件', async () => {
      const condition = await service.buildUserWhereCondition(
        { kind: DataScope.DEPT },
        null,
        1n,
      );

      expect(condition).toEqual({ deptId: { equals: -1n } });
    });

    it('应该为 DEPT_AND_CHILD 范围查询部门子树', async () => {
      mockPrisma.dept.findMany.mockResolvedValue([
        { deptId: 10n },
        { deptId: 11n },
        { deptId: 12n },
      ]);

      const condition = await service.buildUserWhereCondition(
        { kind: DataScope.DEPT_AND_CHILD, deptIds: [] },
        10n,
        1n,
      );

      expect(condition).toEqual({
        deptId: { in: [10n, 11n, 12n] },
      });
    });

    it('应该为 SELF 范围返回按 userId 的条件', async () => {
      const condition = await service.buildUserWhereCondition(
        { kind: DataScope.SELF },
        10n,
        1n,
      );

      expect(condition).toEqual({ userId: 1n });
    });

    it('应该为 CUSTOM 范围返回按部门 ID 列表的条件', async () => {
      const condition = await service.buildUserWhereCondition(
        { kind: DataScope.CUSTOM, deptIds: [10n, 20n, 30n] },
        null,
        1n,
      );

      expect(condition).toEqual({
        deptId: { in: [10n, 20n, 30n] },
      });
    });

    it('应该为 CUSTOM 范围且无部门时返回不匹配条件', async () => {
      const condition = await service.buildUserWhereCondition(
        { kind: DataScope.CUSTOM, deptIds: [] },
        null,
        1n,
      );

      expect(condition).toEqual({ deptId: { equals: -1n } });
    });
  });

  describe('getDeptChildrenIds', () => {
    it('应该查询部门及其所有子部门', async () => {
      mockPrisma.dept.findMany.mockResolvedValue([
        { deptId: 1n },
        { deptId: 2n },
        { deptId: 3n },
      ]);

      const result = await service.getDeptChildrenIds(1n);

      expect(result).toEqual([1n, 2n, 3n]);
      expect(mockPrisma.dept.findMany).toHaveBeenCalled();
    });

    it('应该返回空数组当部门不存在时', async () => {
      mockPrisma.dept.findMany.mockResolvedValue([]);

      const result = await service.getDeptChildrenIds(999n);

      expect(result).toEqual([]);
    });
  });

  describe('getDeptParentIds', () => {
    it('应该解析 ancestors 字段提取所有父部门', async () => {
      mockPrisma.dept.findUnique.mockResolvedValue({
        deptId: 3n,
        ancestors: '/1/2/3',
      });

      const result = await service.getDeptParentIds(3n);

      expect(result).toEqual([1n, 2n, 3n]);
    });

    it('应该处理根部门的 ancestors', async () => {
      mockPrisma.dept.findUnique.mockResolvedValue({
        deptId: 1n,
        ancestors: '/1',
      });

      const result = await service.getDeptParentIds(1n);

      expect(result).toEqual([1n]);
    });

    it('应该返回空数组当部门不存在时', async () => {
      mockPrisma.dept.findUnique.mockResolvedValue(null);

      const result = await service.getDeptParentIds(999n);

      expect(result).toEqual([]);
    });
  });

  describe('buildDeptWhereCondition', () => {
    it('应该为 DEPT 范围构建按 deptId 的条件', async () => {
      const condition = await service.buildDeptWhereCondition(
        { kind: DataScope.DEPT },
        10n,
        1n,
      );

      expect(condition).toEqual({ deptId: 10n });
    });

    it('应该为 SELF 范围构建按 leaderId 的条件', async () => {
      const condition = await service.buildDeptWhereCondition(
        { kind: DataScope.SELF },
        10n,
        1n,
      );

      expect(condition).toEqual({ leaderId: 1n });
    });

    it('应该为 CUSTOM 范围构建按部门 ID 列表的条件', async () => {
      const condition = await service.buildDeptWhereCondition(
        { kind: DataScope.CUSTOM, deptIds: [10n, 20n] },
        null,
        1n,
      );

      expect(condition).toEqual({
        deptId: { in: [10n, 20n] },
      });
    });
  });

  describe('buildOperLogWhereCondition', () => {
    it('应该为 ALL 范围返回空对象', async () => {
      const condition = await service.buildOperLogWhereCondition(
        { kind: DataScope.ALL },
        10n,
        1n,
      );

      expect(condition).toEqual({});
    });

    it('应该为 DEPT 范围构建操作人部门条件', async () => {
      const condition = await service.buildOperLogWhereCondition(
        { kind: DataScope.DEPT },
        10n,
        1n,
      );

      expect(condition).toEqual({
        operUser: { deptId: 10n },
      });
    });

    it('应该为 SELF 范围构建操作人 ID 条件', async () => {
      const condition = await service.buildOperLogWhereCondition(
        { kind: DataScope.SELF },
        10n,
        1n,
      );

      expect(condition).toEqual({ operUserId: 1n });
    });
  });

  describe('mergeWhereConditions', () => {
    it('应该合并多个条件为 AND', () => {
      const result = DataScopeService.mergeWhereConditions(
        { userId: 1n },
        { status: '0' },
        { deptId: 10n },
      );

      expect(result).toEqual({
        AND: [{ userId: 1n }, { status: '0' }, { deptId: 10n }],
      });
    });

    it('应该忽略 null 和 undefined', () => {
      const result = DataScopeService.mergeWhereConditions(
        { userId: 1n },
        null,
        undefined,
        { status: '0' },
      );

      expect(result).toEqual({
        AND: [{ userId: 1n }, { status: '0' }],
      });
    });

    it('应该返回单个条件不包装为 AND', () => {
      const result = DataScopeService.mergeWhereConditions({ userId: 1n });

      expect(result).toEqual({ userId: 1n });
    });

    it('应该返回空对象当没有条件时', () => {
      const result = DataScopeService.mergeWhereConditions();

      expect(result).toEqual({});
    });
  });
});
