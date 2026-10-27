import type { AuthConfig, RedisConfig } from '@app/config';
import { RedisService } from '@app/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RefreshTokenStore } from './refresh-token.store.js';

describe('refreshTokenStore', () => {
  const authConfig: AuthConfig = {
    accessTokenSecret: 'access-secret',
    refreshTokenSecret: 'refresh-secret',
    accessTokenTtl: 1800,
    refreshTokenTtl: 604800,
    issuer: 'nest-admin',
    audience: 'nest-admin',
    refreshTokenRotation: true,
  };

  const redisConfig = { enabled: true } as RedisConfig;

  let redis: {
    execute: ReturnType<typeof vi.fn>;
    key: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
  };

  const create = (overrides: Partial<AuthConfig> = {}, redisEnabled = true) =>
    new RefreshTokenStore(
      { ...authConfig, ...overrides },
      { ...redisConfig, enabled: redisEnabled },
      redis as unknown as RedisService,
    );

  beforeEach(() => {
    redis = {
      execute: vi.fn(),
      key: vi.fn((key: string) => `nest-admin:data:${key}`),
      del: vi.fn(),
    };
  });

  describe('启动约束', () => {
    it('轮换开启且 Redis 关闭时构造抛错', () => {
      expect(() => create({ refreshTokenRotation: true }, false)).toThrow(/redis\.enabled/);
    });

    it('轮换关闭且 Redis 关闭时正常构造', () => {
      expect(() => create({ refreshTokenRotation: false }, false)).not.toThrow();
    });
  });

  describe('issue', () => {
    it('轮换关闭时不写 Redis', async () => {
      await create({ refreshTokenRotation: false }).issue('session-1', 'jti-1');

      expect(redis.execute).not.toHaveBeenCalled();
    });

    it('轮换开启时按 refreshTokenTtl（秒）写入当前 jti', async () => {
      redis.execute.mockResolvedValue('OK');

      await create().issue('session-1', 'jti-1');

      expect(redis.execute).toHaveBeenCalledTimes(1);
      const operation = redis.execute.mock.calls[0]![0] as (client: unknown) => unknown;
      const set = vi.fn().mockResolvedValue('OK');
      await operation({ set });

      expect(set).toHaveBeenCalledWith('nest-admin:data:auth:refresh:session-1', 'jti-1', {
        expiration: { type: 'EX', value: 604800 },
      });
    });

    it('30 天 TTL 也能写入（不经过毫秒上限校验）', async () => {
      redis.execute.mockResolvedValue('OK');

      await create({ refreshTokenTtl: 2592000 }).issue('session-1', 'jti-1');

      const operation = redis.execute.mock.calls[0]![0] as (client: unknown) => unknown;
      const set = vi.fn().mockResolvedValue('OK');
      await operation({ set });

      expect(set.mock.calls[0]![2]).toEqual({ expiration: { type: 'EX', value: 2592000 } });
    });
  });

  describe('rotate', () => {
    it('脚本返回 1 时视为轮换成功', async () => {
      redis.execute.mockResolvedValue(1);

      await expect(create().rotate('session-1', 'jti-1', 'jti-2')).resolves.toBe('rotated');
    });

    it('脚本返回 0 时视为重放', async () => {
      redis.execute.mockResolvedValue(0);

      await expect(create().rotate('session-1', 'jti-1', 'jti-2')).resolves.toBe('replayed');
    });

    it('脚本返回 -1 时视为记录缺失', async () => {
      redis.execute.mockResolvedValue(-1);

      await expect(create().rotate('session-1', 'jti-1', 'jti-2')).resolves.toBe('missing');
    });

    it('脚本以会话 key、旧 jti、新 jti、TTL 秒数为参数', async () => {
      redis.execute.mockResolvedValue(1);

      await create().rotate('session-1', 'jti-1', 'jti-2');

      const operation = redis.execute.mock.calls[0]![0] as (client: unknown) => unknown;
      const evalFn = vi.fn().mockResolvedValue(1);
      await operation({ eval: evalFn });

      expect(evalFn.mock.calls[0]![1]).toEqual({
        keys: ['nest-admin:data:auth:refresh:session-1'],
        arguments: ['jti-1', 'jti-2', '604800'],
      });
    });
  });

  describe('revoke', () => {
    it('轮换开启时删除会话记录', async () => {
      await create().revoke('session-1');

      expect(redis.del).toHaveBeenCalledWith('auth:refresh:session-1');
    });

    it('轮换关闭时不触碰 Redis', async () => {
      await create({ refreshTokenRotation: false }).revoke('session-1');

      expect(redis.del).not.toHaveBeenCalled();
    });
  });
});
