import { PasswordHashService } from '@app/crypto';
import { PrismaService } from '@app/database';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service.js';
import { TokenService } from './services/token.service.js';

describe('authService', () => {
  let service: AuthService;
  let tokenService: jest.Mocked<TokenService>;
  let prismaService: jest.Mocked<PrismaService>;
  let passwordHashService: jest.Mocked<PasswordHashService>;

  const mockUser = {
    userId: 1n,
    username: 'admin',
    password: 'hashed-password',
    realName: 'Admin User',
    status: '0' as const,
    delFlag: '0' as const,
  };

  const mockFullUser = {
    userId: 1n,
    username: 'admin',
    realName: 'Admin User',
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
            signAccessToken: jest.fn(),
            signRefreshToken: jest.fn(),
            verifyAccessToken: jest.fn(),
            verifyRefreshToken: jest.fn(),
            extractUserId: jest.fn(),
            getAccessTokenExpiresInMs: jest.fn().mockReturnValue(3600000),
            getRefreshTokenExpiresInMs: jest.fn().mockReturnValue(604800000),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: PasswordHashService,
          useValue: {
            verify: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    tokenService = module.get(TokenService) as jest.Mocked<TokenService>;
    prismaService = module.get(PrismaService) as jest.Mocked<PrismaService>;
    passwordHashService = module.get(PasswordHashService) as jest.Mocked<PasswordHashService>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should login successfully with correct credentials', async () => {
      const loginDto = { username: 'admin', password: 'password123' };

      prismaService.user.findUnique.mockResolvedValue(mockUser);
      passwordHashService.verify.mockResolvedValue(true);
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

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { username: 'admin' },
        select: {
          userId: true,
          username: true,
          password: true,
          realName: true,
          status: true,
          delFlag: true,
        },
      });

      expect(passwordHashService.verify).toHaveBeenCalledWith('password123', 'hashed-password');

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { userId: 1n },
        data: {
          loginIp: '127.0.0.1',
          loginTime: expect.any(Date),
        },
      });
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const loginDto = { username: 'admin', password: 'wrongpassword' };

      prismaService.user.findUnique.mockResolvedValue(mockUser);
      passwordHashService.verify.mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      const loginDto = { username: 'nonexistent', password: 'password123' };

      prismaService.user.findUnique.mockResolvedValue(null);
      passwordHashService.verify.mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException for disabled user', async () => {
      const loginDto = { username: 'admin', password: 'password123' };
      const disabledUser = { ...mockUser, status: '1' as const };

      prismaService.user.findUnique.mockResolvedValue(disabledUser);
      passwordHashService.verify.mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for deleted user', async () => {
      const loginDto = { username: 'admin', password: 'password123' };
      const deletedUser = { ...mockUser, delFlag: '1' as const };

      prismaService.user.findUnique.mockResolvedValue(deletedUser);
      passwordHashService.verify.mockResolvedValue(true);

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
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      passwordHashService.verify.mockResolvedValue(true);

      const result = await service.validateUser('admin', 'password123');

      expect(result).toEqual({
        userId: 1n,
        username: 'admin',
      });
    });

    it('should return null for non-existent user', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUser('nonexistent', 'password123');

      expect(result).toBeNull();
    });

    it('should return null for wrong password', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      passwordHashService.verify.mockResolvedValue(false);

      const result = await service.validateUser('admin', 'wrongpassword');

      expect(result).toBeNull();
    });
  });
});
