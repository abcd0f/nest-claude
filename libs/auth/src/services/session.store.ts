import type { AuthConfig } from '@app/config';
import { RedisService } from '@app/cache';
import { authConfig } from '@app/config';
import { Inject, Injectable } from '@nestjs/common';

/**
 * 会话存活存储
 *
 * 每个登录会话在 Redis 中占一个 key，存在即代表会话有效：
 * `<key-prefix>:data:auth:session:<sessionId>` → userId，TTL 等于 `refresh-token-ttl`。
 *
 * 用途：
 * - `AuthGuard` 每次请求校验会话是否仍存活，登出后 access token 立即失效
 * - 与刷新令牌轮换解耦：轮换关闭时依然需要它，否则登出形同虚设
 *
 * @note 会话寿命按 `refresh-token-ttl` 计算，轮换开启时每次刷新都会 `touch` 续期，
 * 与刷新令牌的有效期保持同步。
 */
@Injectable()
export class SessionStore {
  constructor(
    @Inject(authConfig.KEY) private readonly config: AuthConfig,
    private readonly redis: RedisService,
  ) {}

  /** 会话在 Redis 中的 key 名（不含 key-prefix 与 data 命名空间） */
  private name(sessionId: string): string {
    return `auth:session:${sessionId}`;
  }

  /**
   * 登记会话为存活状态
   *
   * 登录时调用。重复调用会重置 TTL。
   *
   * @param sessionId 会话 ID
   * @param userId 用户 ID（仅便于排查，不参与鉴权判断）
   */
  async start(sessionId: string, userId: string): Promise<void> {
    await this.redis.execute((client) =>
      client.set(this.redis.key(this.name(sessionId)), userId, {
        expiration: { type: 'EX', value: this.config.refreshTokenTtl },
      }),
    );
  }

  /**
   * 续期会话
   *
   * 轮换开启时每次刷新调用，保证会话寿命跟得上刷新令牌。
   * 直接用 `EXPIRE`（秒）而不是 `RedisService.expire`：后者的 TTL 上限是
   * 2147483647 毫秒（约 24.8 天），装不下 30 天的 `refresh-token-ttl`。
   *
   * @param sessionId 会话 ID
   * @returns 会话存在并被续期返回 true；会话已不存在返回 false
   */
  async touch(sessionId: string): Promise<boolean> {
    return (
      (await this.redis.execute((client) =>
        client.expire(this.redis.key(this.name(sessionId)), this.config.refreshTokenTtl),
      )) === 1
    );
  }

  /**
   * 查询会话是否存活
   *
   * @param sessionId 会话 ID
   * @returns `true` 存活；`false` 已登出或已过期
   * @throws Redis 不可用时抛错，由调用方区分「已登出」和「查不了」
   */
  async isActive(sessionId: string): Promise<boolean> {
    return (await this.redis.get(this.name(sessionId))) !== null;
  }

  /**
   * 结束会话
   *
   * @param sessionId 会话 ID
   * @returns 确实删掉了记录返回 true；本来就不存在返回 false（登出幂等）
   */
  async end(sessionId: string): Promise<boolean> {
    return (await this.redis.del(this.name(sessionId))) > 0;
  }
}
