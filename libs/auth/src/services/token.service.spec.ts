import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { TokenService, TokenConfig } from './token.service.js';
import { UnauthorizedException } from '@nestjs/common';

describe('TokenService', () => {
  let service: TokenService;
  let jwtService: jest.Mocked<JwtService>;

  const mockConfig: TokenConfig = {
    secret: 'test-secret',
    accessTokenTtl: 3600,
    refreshTokenTtl: 604800,
    issuer: 'test-issuer',
    audience: 'test-audience',
    algorithm: 'HS256',
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
            signAsync: jest.fn(),
            verifyAsync: jest.fn(),
            decode: jest.fn(),
          },
        },
        {
          provide: 'TOKEN_CONFIG',
          useValue: mockConfig,
        },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
    jwtService = module.get(JwtService) as jest.Mocked<JwtService>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signAccessToken', () => {
    it('should sign access token successfully', async () => {
      const token = 'access-token-jwt';
      jwtService.signAsync.mockResolvedValue(token);

      const result = await service.signAccessToken('123', 'session-456', 'jti-789');

      expect(result).toBe(token);
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {
          sub: '123',
          sid: 'session-456',
          jti: 'jti-789',
        },
        {
          expiresIn: 3600,
          issuer: 'test-issuer',
          audience: 'test-audience',
          algorithm: 'HS256',
        },
      );
    });

    it('should handle missing JTI', async () => {
      const token = 'access-token-jwt';
      jwtService.signAsync.mockResolvedValue(token);

      const result = await service.signAccessToken('123', 'session-456');

      expect(result).toBe(token);
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {
          sub: '123',
          sid: 'session-456',
          jti: undefined,
        },
        expect.any(Object),
      );
    });
  });

  describe('signRefreshToken', () => {
    it('should sign refresh token successfully', async () => {
      const token = 'refresh-token-jwt';
      jwtService.signAsync.mockResolvedValue(token);

      const result = await service.signRefreshToken('123', 'session-456', 'jti-789');

      expect(result).toBe(token);
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {
          sub: '123',
          sid: 'session-456',
          jti: 'jti-789',
        },
        {
          expiresIn: 604800,
          issuer: 'test-issuer',
          audience: 'test-audience',
          algorithm: 'HS256',
        },
      );
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify access token successfully', async () => {
      jwtService.verifyAsync.mockResolvedValue(mockPayload);

      const result = await service.verifyAccessToken('access-token');

      expect(result).toEqual(mockPayload);
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('access-token', {
        issuer: 'test-issuer',
        audience: 'test-audience',
      });
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      jwtService.verifyAsync.mockRejectedValue(
        new Error('Invalid token'),
      );

      await expect(service.verifyAccessToken('invalid-token')).rejects.toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify refresh token successfully', async () => {
      jwtService.verifyAsync.mockResolvedValue(mockPayload);

      const result = await service.verifyRefreshToken('refresh-token');

      expect(result).toEqual(mockPayload);
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('refresh-token', {
        issuer: 'test-issuer',
        audience: 'test-audience',
      });
    });
  });

  describe('extractUserId', () => {
    it('should extract user ID from token', () => {
      jwtService.decode.mockReturnValue(mockPayload);

      const result = service.extractUserId('token');

      expect(result).toBe('123');
    });

    it('should return null for invalid token', () => {
      jwtService.decode.mockReturnValue(null);

      const result = service.extractUserId('invalid-token');

      expect(result).toBeNull();
    });

    it('should handle decode errors', () => {
      jwtService.decode.mockImplementation(() => {
        throw new Error('Decode error');
      });

      const result = service.extractUserId('malformed-token');

      expect(result).toBeNull();
    });
  });

  describe('getAccessTokenExpiresInMs', () => {
    it('should return correct expiration time', () => {
      const result = service.getAccessTokenExpiresInMs();
      expect(result).toBe(3600 * 1000);
    });
  });

  describe('getRefreshTokenExpiresInMs', () => {
    it('should return correct expiration time', () => {
      const result = service.getRefreshTokenExpiresInMs();
      expect(result).toBe(604800 * 1000);
    });
  });
});