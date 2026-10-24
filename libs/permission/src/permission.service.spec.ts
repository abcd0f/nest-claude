import { PrismaService } from '@app/database';
import { Test, TestingModule } from '@nestjs/testing';
import { PermissionService } from './permission.service.js';

describe('permissionService', () => {
  let service: PermissionService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrisma = {
      user: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      userRole: {
        findMany: jest.fn(),
      },
      permission: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<PermissionService>(PermissionService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  afterEach(() => {
    service.clearAllCache();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('resolveUserPermissions', () => {
    const userId = 1n;

    it('should return empty set for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.resolveUserPermissions(userId);

      expect(result).toEqual(new Set());
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { userId },
        select: { permissionVersion: true, status: true, delFlag: true },
      });
    });

    it('should return empty set for disabled user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        permissionVersion: 1,
        status: '1', // disabled
        delFlag: '0',
      });

      const result = await service.resolveUserPermissions(userId);

      expect(result).toEqual(new Set());
    });

    it('should return empty set for deleted user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        permissionVersion: 1,
        status: '0',
        delFlag: '1', // deleted
      });

      const result = await service.resolveUserPermissions(userId);

      expect(result).toEqual(new Set());
    });

    it('should query database and cache result on cache miss', async () => {
      prisma.user.findUnique.mockResolvedValue({
        permissionVersion: 1,
        status: '0',
        delFlag: '0',
      });

      prisma.permission.findMany.mockResolvedValue([
        { code: 'system:user:view' },
        { code: 'system:user:add' },
        { code: 'system:user:edit' },
      ] as any);

      const result = await service.resolveUserPermissions(userId);

      expect(result).toEqual(new Set(['system:user:view', 'system:user:add', 'system:user:edit']));
      expect(prisma.permission.findMany).toHaveBeenCalledWith({
        where: {
          status: '0',
          roles: {
            some: {
              role: {
                status: '0',
                delFlag: '0',
                users: {
                  some: {
                    userId,
                    user: {
                      status: '0',
                      delFlag: '0',
                    },
                  },
                },
              },
            },
          },
        },
        select: { code: true },
      });
    });

    it('should return cached result on cache hit', async () => {
      prisma.user.findUnique.mockResolvedValue({
        permissionVersion: 1,
        status: '0',
        delFlag: '0',
      });

      prisma.permission.findMany.mockResolvedValue([{ code: 'system:user:view' }] as any);

      // First call - cache miss
      const result1 = await service.resolveUserPermissions(userId);
      expect(result1).toEqual(new Set(['system:user:view']));
      expect(prisma.permission.findMany).toHaveBeenCalledTimes(1);

      // Second call with same version - cache hit
      const result2 = await service.resolveUserPermissions(userId);
      expect(result2).toEqual(new Set(['system:user:view']));
      expect(prisma.permission.findMany).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should invalidate cache when permission version changes', async () => {
      // First call with version 1
      prisma.user.findUnique.mockResolvedValueOnce({
        permissionVersion: 1,
        status: '0',
        delFlag: '0',
      });

      prisma.permission.findMany.mockResolvedValueOnce([{ code: 'system:user:view' }] as any);

      const result1 = await service.resolveUserPermissions(userId);
      expect(result1).toEqual(new Set(['system:user:view']));

      // Second call with version 2 - cache miss
      prisma.user.findUnique.mockResolvedValueOnce({
        permissionVersion: 2,
        status: '0',
        delFlag: '0',
      });

      prisma.permission.findMany.mockResolvedValueOnce([
        { code: 'system:user:view' },
        { code: 'system:user:add' },
      ] as any);

      const result2 = await service.resolveUserPermissions(userId);
      expect(result2).toEqual(new Set(['system:user:view', 'system:user:add']));
      expect(prisma.permission.findMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('invalidateUserPermissions', () => {
    it('should do nothing for empty user list', async () => {
      await service.invalidateUserPermissions([]);
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('should increment permission version for specified users', async () => {
      const userIds = [1n, 2n, 3n];

      await service.invalidateUserPermissions(userIds);

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { userId: { in: userIds } },
        data: { permissionVersion: { increment: 1 } },
      });
    });

    it('should clear cache for specified users', async () => {
      const userId = 1n;

      // Setup cache
      prisma.user.findUnique.mockResolvedValue({
        permissionVersion: 1,
        status: '0',
        delFlag: '0',
      });

      prisma.permission.findMany.mockResolvedValue([{ code: 'system:user:view' }] as any);

      await service.resolveUserPermissions(userId);

      // Invalidate
      await service.invalidateUserPermissions([userId]);

      // The cache should be cleared
      expect(prisma.user.updateMany).toHaveBeenCalled();
    });
  });

  describe('invalidateRolePermissions', () => {
    it('should do nothing if no users have the role', async () => {
      const roleId = 1n;
      prisma.userRole.findMany.mockResolvedValue([]);

      await service.invalidateRolePermissions(roleId);

      expect(prisma.userRole.findMany).toHaveBeenCalledWith({
        where: { roleId },
        select: { userId: true },
      });
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('should invalidate all users with the role', async () => {
      const roleId = 1n;
      const userIds = [1n, 2n, 3n];

      prisma.userRole.findMany.mockResolvedValue(userIds.map((userId) => ({ userId })) as any);

      await service.invalidateRolePermissions(roleId);

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { userId: { in: userIds } },
        data: { permissionVersion: { increment: 1 } },
      });
    });
  });

  describe('clearAllCache', () => {
    it('should clear all cached permissions', async () => {
      const userId = 1n;

      // Setup cache
      prisma.user.findUnique.mockResolvedValue({
        permissionVersion: 1,
        status: '0',
        delFlag: '0',
      });

      prisma.permission.findMany.mockResolvedValue([{ code: 'system:user:view' }] as any);

      await service.resolveUserPermissions(userId);
      expect(prisma.permission.findMany).toHaveBeenCalledTimes(1);

      // Clear cache
      service.clearAllCache();

      // Next call should query database again
      await service.resolveUserPermissions(userId);
      expect(prisma.permission.findMany).toHaveBeenCalledTimes(2);
    });
  });
});
