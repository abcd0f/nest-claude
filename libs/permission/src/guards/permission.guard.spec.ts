import type { UserPrincipal } from '@app/auth';
import type { PermissionMetadata } from '../types/permission-metadata.type.js';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { Mode } from '../enums/mode.enum.js';
import { PermissionService } from '../permission.service.js';
import { PermissionGuard } from './permission.guard.js';

describe('permissionGuard', () => {
  let guard: PermissionGuard;
  let reflector: jest.Mocked<Reflector>;
  let permissionService: jest.Mocked<PermissionService>;

  beforeEach(async () => {
    const mockReflector = {
      getAllAndOverride: jest.fn(),
    };

    const mockPermissionService = {
      resolveUserPermissions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
        {
          provide: PermissionService,
          useValue: mockPermissionService,
        },
      ],
    }).compile();

    guard = module.get<PermissionGuard>(PermissionGuard);
    reflector = module.get(Reflector) as jest.Mocked<Reflector>;
    permissionService = module.get(PermissionService) as jest.Mocked<PermissionService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockExecutionContext = (user?: UserPrincipal): ExecutionContext => {
    const request = { user };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
  };

  const createMockUser = (overrides?: Partial<UserPrincipal>): UserPrincipal => ({
    userId: 1n,
    username: 'testuser',
    realName: 'Test User',
    deptId: 1n,
    roleKeys: ['user'],
    permissionCodes: new Set(),
    permissionVersion: 1,
    sessionId: 'session-123',
    status: '0',
    delFlag: '0',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
    ...overrides,
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('no Permission Metadata', () => {
    it('should allow access when no permission is declared', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);
      const context = createMockExecutionContext(createMockUser());

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(permissionService.resolveUserPermissions).not.toHaveBeenCalled();
    });
  });

  describe('user Authentication', () => {
    it('should throw UnauthorizedException when user is not authenticated', async () => {
      const permission: PermissionMetadata = {
        value: ['system:user:view'],
        mode: Mode.AND,
      };

      reflector.getAllAndOverride.mockReturnValue(permission);
      const context = createMockExecutionContext(); // No user

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(context)).rejects.toThrow('用户未认证');
    });
  });

  describe('superadmin', () => {
    it('should allow access for superadmin without checking permissions', async () => {
      const permission: PermissionMetadata = {
        value: ['system:user:view'],
        mode: Mode.AND,
      };

      reflector.getAllAndOverride.mockReturnValue(permission);
      const user = createMockUser({ roleKeys: ['superadmin'] });
      const context = createMockExecutionContext(user);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(permissionService.resolveUserPermissions).not.toHaveBeenCalled();
    });
  });

  describe('role Fallback', () => {
    it('should allow access when user has fallback role', async () => {
      const permission: PermissionMetadata = {
        value: ['system:user:view'],
        mode: Mode.AND,
        role: 'admin',
      };

      reflector.getAllAndOverride.mockReturnValue(permission);
      const user = createMockUser({ roleKeys: ['admin'] });
      const context = createMockExecutionContext(user);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(permissionService.resolveUserPermissions).not.toHaveBeenCalled();
    });

    it('should check permissions when user does not have fallback role', async () => {
      const permission: PermissionMetadata = {
        value: ['system:user:view'],
        mode: Mode.AND,
        role: 'admin',
      };

      reflector.getAllAndOverride.mockReturnValue(permission);
      const user = createMockUser({ roleKeys: ['user'] });
      const context = createMockExecutionContext(user);

      permissionService.resolveUserPermissions.mockResolvedValue(new Set(['system:user:view']));

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(permissionService.resolveUserPermissions).toHaveBeenCalledWith(user.userId);
    });
  });

  describe('aND Mode', () => {
    it('should allow access when user has all required permissions', async () => {
      const permission: PermissionMetadata = {
        value: ['system:user:view', 'system:user:edit'],
        mode: Mode.AND,
      };

      reflector.getAllAndOverride.mockReturnValue(permission);
      const user = createMockUser();
      const context = createMockExecutionContext(user);

      permissionService.resolveUserPermissions.mockResolvedValue(
        new Set(['system:user:view', 'system:user:edit', 'system:user:add']),
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny access when user is missing one required permission', async () => {
      const permission: PermissionMetadata = {
        value: ['system:user:view', 'system:user:edit'],
        mode: Mode.AND,
      };

      reflector.getAllAndOverride.mockReturnValue(permission);
      const user = createMockUser();
      const context = createMockExecutionContext(user);

      permissionService.resolveUserPermissions.mockResolvedValue(
        new Set(['system:user:view']), // Missing 'system:user:edit'
      );

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('权限不足');
    });

    it('should deny access when user has no permissions', async () => {
      const permission: PermissionMetadata = {
        value: ['system:user:view'],
        mode: Mode.AND,
      };

      reflector.getAllAndOverride.mockReturnValue(permission);
      const user = createMockUser();
      const context = createMockExecutionContext(user);

      permissionService.resolveUserPermissions.mockResolvedValue(new Set());

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('oR Mode', () => {
    it('should allow access when user has at least one required permission', async () => {
      const permission: PermissionMetadata = {
        value: ['system:user:view', 'system:user:edit'],
        mode: Mode.OR,
      };

      reflector.getAllAndOverride.mockReturnValue(permission);
      const user = createMockUser();
      const context = createMockExecutionContext(user);

      permissionService.resolveUserPermissions.mockResolvedValue(
        new Set(['system:user:view']), // Only one permission
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when user has all required permissions', async () => {
      const permission: PermissionMetadata = {
        value: ['system:user:view', 'system:user:edit'],
        mode: Mode.OR,
      };

      reflector.getAllAndOverride.mockReturnValue(permission);
      const user = createMockUser();
      const context = createMockExecutionContext(user);

      permissionService.resolveUserPermissions.mockResolvedValue(
        new Set(['system:user:view', 'system:user:edit']),
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny access when user has none of the required permissions', async () => {
      const permission: PermissionMetadata = {
        value: ['system:user:view', 'system:user:edit'],
        mode: Mode.OR,
      };

      reflector.getAllAndOverride.mockReturnValue(permission);
      const user = createMockUser();
      const context = createMockExecutionContext(user);

      permissionService.resolveUserPermissions.mockResolvedValue(
        new Set(['system:user:add']), // Different permission
      );

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('single Permission', () => {
    it('should allow access when user has the single required permission', async () => {
      const permission: PermissionMetadata = {
        value: ['system:user:view'],
        mode: Mode.AND,
      };

      reflector.getAllAndOverride.mockReturnValue(permission);
      const user = createMockUser();
      const context = createMockExecutionContext(user);

      permissionService.resolveUserPermissions.mockResolvedValue(new Set(['system:user:view']));

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny access when user does not have the single required permission', async () => {
      const permission: PermissionMetadata = {
        value: ['system:user:view'],
        mode: Mode.AND,
      };

      reflector.getAllAndOverride.mockReturnValue(permission);
      const user = createMockUser();
      const context = createMockExecutionContext(user);

      permissionService.resolveUserPermissions.mockResolvedValue(new Set(['system:user:add']));

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });
  });
});
