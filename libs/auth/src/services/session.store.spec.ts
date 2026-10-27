import type { AuthConfig } from '@app/config';
import { RedisService } from '@app/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionStore } from './session.store.js';

describe('sessionStore', () => {
  const config: AuthConfig = {
    accessTokenSecret: 'access-secret',
    refreshTokenSecret: 'refresh-secret',
    accessTokenTtl: 1800,
    refreshTokenTtl: 604800,
    issuer: 'nest-admin',
    audience: 'nest-admin',
    refreshTokenRotation: true,
  };

  let redis: {
    execute: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
    key: ReturnType<typeof vi.fn>;
  };

  const create = (overrides: Partial<AuthConfig> = {}) =>
    new SessionStore({ ...config, ...overrides }, redis as unknown as RedisService);

  /** 取出 execute 收到的操作，用假 client 执行一次，便于断言实际 Redis 命令 */
  const runOperation = async (client: Record<string, unknown>) => {
    const operation = redis.execute.mock.calls[0]![0] as (client: unknown) => unknown;
    return operation(client);
  };

  beforeEach(() => {
    redis = {
      execute: vi.fn().mockResolvedValue(undefined),
      get: vi.fn(),
      del: vi.fn(),
      key: vi.fn((key: string) => `nest-admin:data:${key}`),
    };
  });

  describe('start', () => {
    it('按 refreshTokenTtl（秒）写入会话 key', async () => {
      const set = vi.fn().mockResolvedValue('OK');

      await create().start('session-1', '42');
      await runOperation({ set });

      expect(set).toHaveBeenCalledWith('nest-admin:data:auth:session:session-1', '42', {
        expiration: { type: 'EX', value: 604800 },
      });
    });

    it('30 天 TTL 也能写入（不经过毫秒上限校验）', async () => {
      const set = vi.fn().mockResolvedValue('OK');

      await create({ refreshTokenTtl: 2592000 }).start('session-1', '42');
      await runOperation({ set });

      expect(set.mock.calls[0]![2]).toEqual({ expiration: { type: 'EX', value: 2592000 } });
    });
  });

  describe('isActive', () => {
    it('key 存在时返回 true', async () => {
      redis.get.mockResolvedValue('42');

      await expect(create().isActive('session-1')).resolves.toBe(true);
      expect(redis.get).toHaveBeenCalledWith('auth:session:session-1');
    });

    it('key 不存在时返回 false', async () => {
      redis.get.mockResolvedValue(null);

      await expect(create().isActive('session-1')).resolves.toBe(false);
    });

    it('redis 故障时抛错，不伪装成已登出', async () => {
      redis.get.mockRejectedValue(new Error('Redis 未就绪或已关闭'));

      await expect(create().isActive('session-1')).rejects.toThrow('Redis 未就绪或已关闭');
    });
  });

  describe('touch', () => {
    it('会话存在时用 EXPIRE（秒）续期并返回 true', async () => {
      const expire = vi.fn().mockResolvedValue(1);
      // 让 execute 透传真实操作，才能测到 `=== 1` 的转换
      redis.execute.mockImplementation((operation: (client: unknown) => unknown) =>
        operation({ expire }),
      );

      await expect(create().touch('session-1')).resolves.toBe(true);

      expect(expire).toHaveBeenCalledWith('nest-admin:data:auth:session:session-1', 604800);
    });

    it('会话已不存在时返回 false', async () => {
      const expire = vi.fn().mockResolvedValue(0);
      redis.execute.mockImplementation((operation: (client: unknown) => unknown) =>
        operation({ expire }),
      );

      await expect(create().touch('session-1')).resolves.toBe(false);
    });
  });

  describe('end', () => {
    it('删除成功返回 true', async () => {
      redis.del.mockResolvedValue(1);

      await expect(create().end('session-1')).resolves.toBe(true);
      expect(redis.del).toHaveBeenCalledWith('auth:session:session-1');
    });

    it('会话本就不存在时返回 false（登出幂等）', async () => {
      redis.del.mockResolvedValue(0);

      await expect(create().end('session-1')).resolves.toBe(false);
    });
  });
});
