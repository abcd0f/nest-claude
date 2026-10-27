import type { AuthConfig } from '@app/config';
import type { Mocked } from 'vitest';
import { authConfig } from '@app/config';
import { PasswordHashService } from '@app/crypto';
import { PrismaService } from '@app/database';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { RefreshTokenStore } from './services/refresh-token.store.js';
import { SessionStore } from './services/session.store.js';
import { TokenService } from './services/token.service.js';

describe('authService', () => {
  let service: AuthService;
  let tokenService: Mocked<TokenService>;
  let prismaService: Mocked<PrismaService>;
  let passwordHashService: Mocked<PasswordHashService>;
  let refreshTokenStore: {
    issue: ReturnType<typeof vi.fn>;
    rotate: ReturnType<typeof vi.fn>;
    revoke: ReturnType<typeof vi.fn>;
  };
  let sessionStore: {
    start: ReturnType<typeof vi.fn>;
    touch: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  };

  const config: AuthConfig = {
    accessTokenSecret: 'access-secret',
    refreshTokenSecret: 'refresh-secret',
    accessTokenTtl: 3600,
    refreshTokenTtl: 604800,
    issuer: 'nest-admin',
    audience: 'nest-admin',
    refreshTokenRotation: true,
  };

  const mockUser = {
    userId: 1n,
    userName: 'admin',
    password: 'hashed-password',
    nickName: 'Admin User',
    status: '0' as const,
    delFlag: '0' as const,
  };

  const mockFullUser = {
    userId: 1n,
    userName: 'admin',
    nickName: 'Admin User',
    deptId: null,
    status: '0' as const,
    delFlag: '0' as const,
    permissionVersion: 0,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: TokenService,
          useValue: {
            signAccessToken: vi.fn(),
            signRefreshToken: vi.fn(),
            verifyAccessToken: vi.fn(),
            verifyRefreshToken: vi.fn(),
            decodeExpiredAccessToken: vi.fn(),
            decodeExpiredRefreshToken: vi.fn(),
            extractUserId: vi.fn(),
            getAccessTokenExpiresInMs: vi.fn().mockReturnValue(3600000),
            getRefreshTokenExpiresInMs: vi.fn().mockReturnValue(604800000),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: vi.fn(),
              findFirst: vi.fn(),
              update: vi.fn(),
            },
          },
        },
        {
          provide: PasswordHashService,
          useValue: {
            verifyPassword: vi.fn(),
          },
        },
        {
          provide: RefreshTokenStore,
          useValue: {
            issue: vi.fn(),
            rotate: vi.fn(),
            revoke: vi.fn(),
          },
        },
        {
          provide: SessionStore,
          useValue: {
            start: vi.fn(),
            touch: vi.fn(),
            end: vi.fn(),
          },
        },
        {
          provide: authConfig.KEY,
          useValue: config,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    tokenService = module.get(TokenService) as Mocked<TokenService>;
    prismaService = module.get(PrismaService) as Mocked<PrismaService>;
    passwordHashService = module.get(PasswordHashService) as Mocked<PasswordHashService>;
    refreshTokenStore = module.get(RefreshTokenStore) as unknown as typeof refreshTokenStore;
    sessionStore = module.get(SessionStore) as unknown as typeof sessionStore;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should login successfully with correct credentials', async () => {
      const loginDto = { username: 'admin', password: 'password123' };

      prismaService.user.findFirst.mockResolvedValue(mockUser);
      passwordHashService.verifyPassword.mockResolvedValue(true);
      tokenService.signAccessToken.mockResolvedValue('access-token');
      tokenService.signRefreshToken.mockResolvedValue('refresh-token');
      prismaService.user.update.mockResolvedValue(mockUser);

      const result = await service.login(loginDto, '127.0.0.1');

      expect(result).toEqual({
        accessToken: 'access-token',
        expiresIn: 3600,
        refreshToken: 'refresh-token',
        refreshTokenExpiresIn: 604800,
      });

      // 轮换开启时必须把本次 jti 登记到会话存储
      expect(refreshTokenStore.issue).toHaveBeenCalledWith(expect.any(String), expect.any(String));
      // 会话必须登记，否则 AuthGuard 会拒绝后续请求
      expect(sessionStore.start).toHaveBeenCalledWith(expect.any(String), '1');

      expect(prismaService.user.findFirst).toHaveBeenCalledWith({
        where: { userName: 'admin' },
        select: {
          userId: true,
          userName: true,
          password: true,
          nickName: true,
          status: true,
          delFlag: true,
        },
      });

      expect(passwordHashService.verifyPassword).toHaveBeenCalledWith(
        'hashed-password',
        'password123',
      );

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { userId: 1n },
        data: {
          loginIp: '127.0.0.1',
          loginDate: expect.any(Date),
        },
      });
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const loginDto = { username: 'admin', password: 'wrongpassword' };

      prismaService.user.findFirst.mockResolvedValue(mockUser);
      passwordHashService.verifyPassword.mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      const loginDto = { username: 'nonexistent', password: 'password123' };

      prismaService.user.findFirst.mockResolvedValue(null);
      passwordHashService.verifyPassword.mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException for disabled user', async () => {
      const loginDto = { username: 'admin', password: 'password123' };
      const disabledUser = { ...mockUser, status: '1' as const };

      prismaService.user.findFirst.mockResolvedValue(disabledUser);
      passwordHashService.verifyPassword.mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for deleted user', async () => {
      const loginDto = { username: 'admin', password: 'password123' };
      const deletedUser = { ...mockUser, delFlag: '1' as const };

      prismaService.user.findFirst.mockResolvedValue(deletedUser);
      passwordHashService.verifyPassword.mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const payload = {
        sub: '1',
        sid: 'session-id',
        jti: 'jti-1',
        iat: Date.now() / 1000,
        exp: (Date.now() + 604800000) / 1000,
      };

      tokenService.verifyRefreshToken.mockResolvedValue(payload as any);
      prismaService.user.findUnique.mockResolvedValue(mockFullUser);
      tokenService.signAccessToken.mockResolvedValue('new-access-token');
      tokenService.signRefreshToken.mockResolvedValue('new-refresh-token');
      refreshTokenStore.rotate.mockResolvedValue('rotated');

      const result = await service.refreshToken('refresh-token');

      expect(result).toEqual({
        accessToken: 'new-access-token',
        expiresIn: 3600,
        refreshToken: 'new-refresh-token',
        refreshTokenExpiresIn: 604800,
      });

      expect(tokenService.verifyRefreshToken).toHaveBeenCalledWith('refresh-token');
      expect(refreshTokenStore.rotate).toHaveBeenCalledWith(
        'session-id',
        'jti-1',
        expect.any(String),
      );
      // 会话寿命跟随刷新令牌，刷新成功后必须续期
      expect(sessionStore.touch).toHaveBeenCalledWith('session-id');
    });

    it('should reject replayed refresh token', async () => {
      const payload = { sub: '1', sid: 'session-id', jti: 'jti-1' };

      tokenService.verifyRefreshToken.mockResolvedValue(payload as any);
      prismaService.user.findUnique.mockResolvedValue(mockFullUser);
      tokenService.signAccessToken.mockResolvedValue('new-access-token');
      tokenService.signRefreshToken.mockResolvedValue('new-refresh-token');
      refreshTokenStore.rotate.mockResolvedValue('replayed');

      await expect(service.refreshToken('refresh-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should only issue access token when rotation is disabled', async () => {
      const payload = { sub: '1', sid: 'session-id', jti: 'jti-1' };

      tokenService.verifyRefreshToken.mockResolvedValue(payload as any);
      prismaService.user.findUnique.mockResolvedValue(mockFullUser);
      tokenService.signAccessToken.mockResolvedValue('new-access-token');

      // 关掉轮换后重建实例
      const module = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: TokenService, useValue: tokenService },
          { provide: PrismaService, useValue: prismaService },
          { provide: PasswordHashService, useValue: passwordHashService },
          { provide: RefreshTokenStore, useValue: refreshTokenStore },
          { provide: SessionStore, useValue: sessionStore },
          { provide: authConfig.KEY, useValue: { ...config, refreshTokenRotation: false } },
        ],
      }).compile();

      const result = await module.get(AuthService).refreshToken('refresh-token');

      expect(result).toEqual({ accessToken: 'new-access-token', expiresIn: 3600 });
      expect(refreshTokenStore.rotate).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      tokenService.verifyRefreshToken.mockRejectedValue(new UnauthorizedException());

      await expect(service.refreshToken('invalid-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException for disabled user', async () => {
      const payload = {
        sub: '1',
        sid: 'session-id',
      };

      const disabledUser = { ...mockFullUser, status: '1' as const };

      tokenService.verifyRefreshToken.mockResolvedValue(payload as any);
      prismaService.user.findUnique.mockResolvedValue(disabledUser);

      await expect(service.refreshToken('refresh-token')).rejects.toThrow(BadRequestException);
    });
  });

  describe('logout', () => {
    it('should revoke session identified by expired access token', async () => {
      tokenService.decodeExpiredAccessToken.mockResolvedValue({
        sub: '1',
        sid: 'session-id',
      } as any);
      prismaService.user.findUnique.mockResolvedValue({ userName: 'admin' });
      sessionStore.end.mockResolvedValue(true);

      const result = await service.logout({ accessToken: 'expired-access-token' });

      expect(refreshTokenStore.revoke).toHaveBeenCalledWith('session-id');
      expect(sessionStore.end).toHaveBeenCalledWith('session-id');
      expect(result).toEqual({ username: 'admin' });
    });

    it('should fall back to refresh token when access token is unusable', async () => {
      tokenService.decodeExpiredAccessToken.mockResolvedValue(null);
      tokenService.decodeExpiredRefreshToken.mockResolvedValue({
        sub: '1',
        sid: 'session-from-refresh',
      } as any);
      prismaService.user.findUnique.mockResolvedValue({ userName: 'admin' });
      sessionStore.end.mockResolvedValue(true);

      await service.logout({ accessToken: 'bad-token', refreshToken: 'good-refresh-token' });

      expect(sessionStore.end).toHaveBeenCalledWith('session-from-refresh');
    });

    it('should be a no-op when no token can be identified', async () => {
      tokenService.decodeExpiredAccessToken.mockResolvedValue(null);
      tokenService.decodeExpiredRefreshToken.mockResolvedValue(null);

      await expect(service.logout({})).resolves.toBeNull();
      expect(refreshTokenStore.revoke).not.toHaveBeenCalled();
      expect(sessionStore.end).not.toHaveBeenCalled();
    });

    it('should stay idempotent when session is already gone', async () => {
      tokenService.decodeExpiredAccessToken.mockResolvedValue({
        sub: '1',
        sid: 'session-id',
      } as any);
      prismaService.user.findUnique.mockResolvedValue({ userName: 'admin' });
      sessionStore.end.mockResolvedValue(false);

      await expect(service.logout({ accessToken: 'token' })).resolves.toEqual({
        username: 'admin',
      });
    });

    it('should propagate storage failure instead of reporting success', async () => {
      tokenService.decodeExpiredAccessToken.mockResolvedValue({
        sub: '1',
        sid: 'session-id',
      } as any);
      refreshTokenStore.revoke.mockRejectedValue(new Error('Redis 命令执行失败'));

      await expect(service.logout({ accessToken: 'token' })).rejects.toThrow('Redis 命令执行失败');
      expect(sessionStore.end).not.toHaveBeenCalled();
    });
  });

  describe('validateUser', () => {
    it('should validate user with correct credentials', async () => {
      prismaService.user.findFirst.mockResolvedValue(mockUser);
      passwordHashService.verifyPassword.mockResolvedValue(true);

      const result = await service.validateUser('admin', 'password123');

      expect(result).toEqual({
        userId: 1n,
        username: 'admin',
      });
    });

    it('should return null for non-existent user', async () => {
      prismaService.user.findFirst.mockResolvedValue(null);

      const result = await service.validateUser('nonexistent', 'password123');

      expect(result).toBeNull();
    });

    it('should return null for wrong password', async () => {
      prismaService.user.findFirst.mockResolvedValue(mockUser);
      passwordHashService.verifyPassword.mockResolvedValue(false);

      const result = await service.validateUser('admin', 'wrongpassword');

      expect(result).toBeNull();
    });
  });
});
