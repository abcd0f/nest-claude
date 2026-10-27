import type { Mock, Mocked } from 'vitest';
import {
  ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { AuthService } from '../auth.service.js';
import { SessionStore } from '../services/session.store.js';
import { TokenService } from '../services/token.service.js';
import { UserPrincipal } from '../types/user-principal.type.js';
import { AuthGuard } from './auth.guard.js';

describe('authGuard', () => {
  let guard: AuthGuard;
  let reflector: Mocked<Reflector>;
  let tokenService: Mocked<TokenService>;
  let authService: Mocked<AuthService>;
  let sessionStore: { isActive: ReturnType<typeof vi.fn> };

  const mockUser: UserPrincipal = {
    userId: 1n,
    username: 'admin',
    nickName: 'Admin User',
    deptId: null,
    roleKeys: ['admin'],
    permissionCodes: new Set(['system:user:view']),
    permissionVersion: 0,
    sessionId: 'session-456',
    status: '0',
    delFlag: '0',
    issuedAt: Math.floor(Date.now() / 1000),
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  };

  const mockPayload = {
    sub: '1',
    sid: 'session-456',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: vi.fn(),
          },
        },
        {
          provide: TokenService,
          useValue: {
            verifyAccessToken: vi.fn(),
          },
        },
        {
          provide: AuthService,
          useValue: {
            getCurrentUser: vi.fn(),
          },
        },
        {
          provide: SessionStore,
          useValue: {
            isActive: vi.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
    reflector = module.get(Reflector) as Mocked<Reflector>;
    tokenService = module.get(TokenService) as Mocked<TokenService>;
    authService = module.get(AuthService) as Mocked<AuthService>;
    sessionStore = module.get(SessionStore) as unknown as typeof sessionStore;

    // 默认会话存活，个别用例再覆盖
    sessionStore.isActive.mockResolvedValue(true);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    const createMockExecutionContext = (overrides = {}): ExecutionContext =>
      ({
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: vi.fn().mockReturnValue({
            headers: {
              authorization: 'Bearer valid-token',
            },
            ...overrides,
          }),
        }),
        getHandler: vi.fn(),
        getClass: vi.fn(),
      }) as any;

    it('should allow public routes', async () => {
      const context = createMockExecutionContext();
      reflector.getAllAndOverride.mockReturnValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(tokenService.verifyAccessToken).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for missing token', async () => {
      const context = createMockExecutionContext({
        headers: {},
      });
      reflector.getAllAndOverride.mockReturnValue(false);

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid Bearer format', async () => {
      const context = createMockExecutionContext({
        headers: {
          authorization: 'Basic user:pass',
        },
      });
      reflector.getAllAndOverride.mockReturnValue(false);

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should authenticate valid token', async () => {
      const request = { headers: { authorization: 'Bearer valid-token' } };
      const context = createMockExecutionContext();
      (context.switchToHttp().getRequest as Mock).mockReturnValue(request);

      reflector.getAllAndOverride.mockReturnValue(false);
      tokenService.verifyAccessToken.mockResolvedValue(mockPayload as any);
      authService.getCurrentUser.mockResolvedValue(mockUser);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(sessionStore.isActive).toHaveBeenCalledWith('session-456');
      expect(request.user).toEqual(mockUser);
      expect(request.token).toEqual(mockPayload);
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      const context = createMockExecutionContext();
      reflector.getAllAndOverride.mockReturnValue(false);
      tokenService.verifyAccessToken.mockRejectedValue(new Error('Invalid token'));

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject token whose session was revoked', async () => {
      const context = createMockExecutionContext();
      reflector.getAllAndOverride.mockReturnValue(false);
      tokenService.verifyAccessToken.mockResolvedValue(mockPayload as any);
      sessionStore.isActive.mockResolvedValue(false);

      await expect(guard.canActivate(context)).rejects.toThrow('会话已失效，请重新登录');
      // 会话已失效就不该再查库
      expect(authService.getCurrentUser).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for token without sid', async () => {
      const context = createMockExecutionContext();
      reflector.getAllAndOverride.mockReturnValue(false);
      tokenService.verifyAccessToken.mockResolvedValue({ sub: '1' } as any);

      await expect(guard.canActivate(context)).rejects.toThrow('令牌缺少会话标识');
      expect(sessionStore.isActive).not.toHaveBeenCalled();
    });

    it('should surface 503 instead of 401 when session storage fails', async () => {
      const context = createMockExecutionContext();
      reflector.getAllAndOverride.mockReturnValue(false);
      tokenService.verifyAccessToken.mockResolvedValue(mockPayload as any);
      sessionStore.isActive.mockRejectedValue(new Error('Redis 未就绪或已关闭'));

      await expect(guard.canActivate(context)).rejects.toThrow(ServiceUnavailableException);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      const context = createMockExecutionContext();
      reflector.getAllAndOverride.mockReturnValue(false);
      tokenService.verifyAccessToken.mockResolvedValue(mockPayload as any);
      authService.getCurrentUser.mockResolvedValue(null);

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for disabled user', async () => {
      const disabledUser = { ...mockUser, status: '1' as const };
      const context = createMockExecutionContext();
      reflector.getAllAndOverride.mockReturnValue(false);
      tokenService.verifyAccessToken.mockResolvedValue(mockPayload as any);
      authService.getCurrentUser.mockResolvedValue(disabledUser);

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for deleted user', async () => {
      const deletedUser = { ...mockUser, delFlag: '1' as const };
      const context = createMockExecutionContext();
      reflector.getAllAndOverride.mockReturnValue(false);
      tokenService.verifyAccessToken.mockResolvedValue(mockPayload as any);
      authService.getCurrentUser.mockResolvedValue(deletedUser);

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });
});
