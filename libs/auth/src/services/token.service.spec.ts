import type { AuthConfig } from '@app/config';
import type { Mocked } from 'vitest';
import { authConfig } from '@app/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { TokenService } from './token.service.js';

describe('tokenService', () => {
  let service: TokenService;
  let jwtService: Mocked<JwtService>;

  const config: AuthConfig = {
    accessTokenSecret: 'access-secret',
    refreshTokenSecret: 'refresh-secret',
    accessTokenTtl: 3600,
    refreshTokenTtl: 604800,
    issuer: 'test-issuer',
    audience: 'test-audience',
    refreshTokenRotation: true,
  };

  const mockPayload = {
    sub: '123',
    sid: 'session-456',
    jti: 'jti-789',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    iss: 'test-issuer',
    aud: 'test-audience',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        {
          provide: JwtService,
          useValue: {
            signAsync: vi.fn(),
            verifyAsync: vi.fn(),
            decode: vi.fn(),
          },
        },
        {
          provide: authConfig.KEY,
          useValue: config,
        },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
    jwtService = module.get(JwtService) as Mocked<JwtService>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signAccessToken', () => {
    it('should sign access token with access secret and ttl', async () => {
      jwtService.signAsync.mockResolvedValue('access-token-jwt');

      const result = await service.signAccessToken('123', 'session-456', 'jti-789');

      expect(result).toBe('access-token-jwt');
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: '123', sid: 'session-456', jti: 'jti-789' },
        {
          expiresIn: '3600s',
          issuer: 'test-issuer',
          audience: 'test-audience',
          secret: 'access-secret',
        },
      );
    });

    it('should leave jti undefined when not provided', async () => {
      jwtService.signAsync.mockResolvedValue('access-token-jwt');

      await service.signAccessToken('123', 'session-456');

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: '123', sid: 'session-456', jti: undefined },
        expect.any(Object),
      );
    });
  });

  describe('signRefreshToken', () => {
    it('should sign refresh token with refresh secret and ttl', async () => {
      jwtService.signAsync.mockResolvedValue('refresh-token-jwt');

      const result = await service.signRefreshToken('123', 'session-456', 'jti-789');

      expect(result).toBe('refresh-token-jwt');
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: '123', sid: 'session-456', jti: 'jti-789' },
        {
          expiresIn: '604800s',
          issuer: 'test-issuer',
          audience: 'test-audience',
          secret: 'refresh-secret',
        },
      );
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify access token with access secret', async () => {
      jwtService.verifyAsync.mockResolvedValue(mockPayload);

      const result = await service.verifyAccessToken('access-token');

      expect(result).toEqual(mockPayload);
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('access-token', {
        secret: 'access-secret',
        issuer: 'test-issuer',
        audience: 'test-audience',
      });
    });

    it('should throw for invalid token', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(service.verifyAccessToken('invalid-token')).rejects.toThrow('jwt expired');
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify refresh token with refresh secret', async () => {
      jwtService.verifyAsync.mockResolvedValue(mockPayload);

      const result = await service.verifyRefreshToken('refresh-token');

      expect(result).toEqual(mockPayload);
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('refresh-token', {
        secret: 'refresh-secret',
        issuer: 'test-issuer',
        audience: 'test-audience',
      });
    });
  });

  describe('decodeExpiredAccessToken', () => {
    it('should verify signature but ignore expiration', async () => {
      jwtService.verifyAsync.mockResolvedValue(mockPayload);

      const result = await service.decodeExpiredAccessToken('expired-access-token');

      expect(result).toEqual(mockPayload);
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('expired-access-token', {
        secret: 'access-secret',
        issuer: 'test-issuer',
        audience: 'test-audience',
        ignoreExpiration: true,
      });
    });

    it('should return null when signature is invalid', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));

      await expect(service.decodeExpiredAccessToken('forged')).resolves.toBeNull();
    });

    it('should return null without calling jwt for empty token', async () => {
      await expect(service.decodeExpiredAccessToken('')).resolves.toBeNull();
      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    });
  });

  describe('decodeExpiredRefreshToken', () => {
    it('should verify with refresh secret and ignore expiration', async () => {
      jwtService.verifyAsync.mockResolvedValue(mockPayload);

      await service.decodeExpiredRefreshToken('expired-refresh-token');

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('expired-refresh-token', {
        secret: 'refresh-secret',
        issuer: 'test-issuer',
        audience: 'test-audience',
        ignoreExpiration: true,
      });
    });
  });

  describe('extractUserId', () => {
    it('should extract user ID from token', () => {
      jwtService.decode.mockReturnValue(mockPayload as never);

      expect(service.extractUserId('token')).toBe('123');
    });

    it('should return null for invalid token', () => {
      jwtService.decode.mockReturnValue(null as never);

      expect(service.extractUserId('invalid-token')).toBeNull();
    });

    it('should handle decode errors', () => {
      jwtService.decode.mockImplementation(() => {
        throw new Error('Decode error');
      });

      expect(service.extractUserId('malformed-token')).toBeNull();
    });
  });

  describe('getAccessTokenExpiresInMs', () => {
    it('should return correct expiration time', () => {
      expect(service.getAccessTokenExpiresInMs()).toBe(3600 * 1000);
    });
  });

  describe('getRefreshTokenExpiresInMs', () => {
    it('should return correct expiration time', () => {
      expect(service.getRefreshTokenExpiresInMs()).toBe(604800 * 1000);
    });
  });
});
