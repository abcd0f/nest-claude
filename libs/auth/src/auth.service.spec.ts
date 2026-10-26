import { PasswordHashService } from '@app/crypto';
import { PrismaService } from '@app/database';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { type Mocked, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { TokenService } from './services/token.service.js';

describe('authService', () => {
  let service: AuthService;
  let tokenService: Mocked<TokenService>;
  let prismaService: Mocked<PrismaService>;
  let passwordHashService: Mocked<PasswordHashService>;

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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    tokenService = module.get(TokenService) as Mocked<TokenService>;
    prismaService = module.get(PrismaService) as Mocked<PrismaService>;
    passwordHashService = module.get(PasswordHashService) as Mocked<PasswordHashService>;
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
        token: {
          accessToken: 'access-token',
          expiresIn: 3600,
          refreshToken: 'refresh-token',
          refreshTokenExpiresIn: 604800,
          tokenType: 'Bearer',
        },
        userId: '1',
        username: 'admin',
        realName: 'Admin User',
      });

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
        iat: Date.now() / 1000,
        exp: (Date.now() + 604800000) / 1000,
      };

      tokenService.verifyRefreshToken.mockResolvedValue(payload as any);
      prismaService.user.findUnique.mockResolvedValue(mockFullUser);
      tokenService.signAccessToken.mockResolvedValue('new-access-token');

      const result = await service.refreshToken('refresh-token');

      expect(result).toEqual({
        accessToken: 'new-access-token',
        expiresIn: 3600,
        tokenType: 'Bearer',
      });

      expect(tokenService.verifyRefreshToken).toHaveBeenCalledWith('refresh-token');
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
    it('should logout successfully', async () => {
      await expect(service.logout(1n, 'session-id')).resolves.not.toThrow();
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
