import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service.js';
import { TokenService } from '../services/token.service.js';
import { UserPrincipal } from '../types/user-principal.type.js';
import { AuthGuard } from './auth.guard.js';

describe('authGuard', () => {
  let guard: AuthGuard;
  let reflector: jest.Mocked<Reflector>;
  let tokenService: jest.Mocked<TokenService>;
  let authService: jest.Mocked<AuthService>;

  const mockUser: UserPrincipal = {
    userId: 1n,
    username: 'admin',
    realName: 'Admin User',
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
            getAllAndOverride: jest.fn(),
          },
        },
        {
          provide: TokenService,
          useValue: {
            verifyAccessToken: jest.fn(),
          },
        },
        {
          provide: AuthService,
          useValue: {
            getCurrentUser: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
    reflector = module.get(Reflector) as jest.Mocked<Reflector>;
    tokenService = module.get(TokenService) as jest.Mocked<TokenService>;
    authService = module.get(AuthService) as jest.Mocked<AuthService>;
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    const createMockExecutionContext = (overrides = {}): ExecutionContext =>
      ({
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            headers: {
              authorization: 'Bearer valid-token',
            },
            ...overrides,
          }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
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
      (context.switchToHttp().getRequest as jest.Mock).mockReturnValue(request);

      reflector.getAllAndOverride.mockReturnValue(false);
      tokenService.verifyAccessToken.mockResolvedValue(mockPayload as any);
      authService.getCurrentUser.mockResolvedValue(mockUser);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.user).toEqual(mockUser);
      expect(request.token).toEqual(mockPayload);
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      const context = createMockExecutionContext();
      reflector.getAllAndOverride.mockReturnValue(false);
      tokenService.verifyAccessToken.mockRejectedValue(new Error('Invalid token'));

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
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
