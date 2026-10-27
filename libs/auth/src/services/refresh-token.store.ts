import type { AuthConfig, RedisConfig } from '@app/config';
import { RedisService } from '@app/cache';
import { authConfig, redisConfig } from '@app/config';
import { Inject, Injectable, Logger } from '@nestjs/common';

/**
 * 原子轮换脚本。
 *
 * KEYS[1] = 会话当前的 jti 记录
 * ARGV[1] = 客户端持有的 jti
 * ARGV[2] = 轮换后的新 jti
 * ARGV[3] = 新的 TTL（秒）
 *
 * 返回值：
 * - `1` 轮换成功
 * - `0` jti 与记录不符 → 视为重放，顺手撤销整个会话
 * - `-1` 会话记录不存在 → 已过期或已登出
 */
const ROTATE = `
local current = redis.call('GET', KEYS[1])
if not current then return -1 end
if current ~= ARGV[1] then
  redis.call('DEL', KEYS[1])
  return 0
end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return 1
`;

/** 轮换结果：成功 / 重放（会话已撤销）/ 记录缺失 */
export type RotateOutcome = 'rotated' | 'replayed' | 'missing';

/**
 * 刷新令牌状态存储
 *
 * 只服务于 `auth.refresh-token-rotation`：为每个会话记录「当前唯一有效的
 * 刷新令牌 jti」，刷新时原子替换。旧 jti 一旦再次出现即判定为重放，
 * 撤销该会话，迫使攻击者与合法用户一起重新登录。
 *
 * 关闭轮换时不写任何状态（刷新令牌保持可重复使用，与历史行为一致）。
 *
 * @note 依赖 Redis。`refresh-token-rotation: true` 且 `redis.enabled: false`
 * 会在启动阶段直接抛错，避免运行期静默变成「所有刷新都失败」。
 */
@Injectable()
export class RefreshTokenStore {
  private readonly logger = new Logger(RefreshTokenStore.name);

  constructor(
    @Inject(authConfig.KEY) private readonly config: AuthConfig,
    @Inject(redisConfig.KEY) private readonly redisConfig: RedisConfig,
    private readonly redis: RedisService,
  ) {
    if (config.refreshTokenRotation && !redisConfig.enabled) {
      throw new Error(
        'auth.refresh-token-rotation 已启用，但 redis.enabled 为 false：刷新令牌轮换需要 Redis 保存令牌状态',
      );
    }
  }

  /** 会话在 Redis 中的 key 名（不含 key-prefix 与 data 命名空间） */
  private name(sessionId: string): string {
    return `auth:refresh:${sessionId}`;
  }

  /**
   * 登记会话当前的刷新令牌
   *
   * 登录时调用。轮换关闭时直接返回，不产生 Redis 写入。
   *
   * @param sessionId 会话 ID
   * @param jti 本次签发的刷新令牌 jti
   */
  async issue(sessionId: string, jti: string): Promise<void> {
    if (!this.config.refreshTokenRotation) return;

    // 直接用 EX（秒）：RedisService.set 的 TTL 上限是 2147483647 毫秒（约 24.8 天），
    // 而 refresh-token-ttl 允许配到 30 天（2592000 秒），走毫秒会被 assertTtl 拦下。
    await this.redis.execute((client) =>
      client.set(this.redis.key(this.name(sessionId)), jti, {
        expiration: { type: 'EX', value: this.config.refreshTokenTtl },
      }),
    );
  }

  /**
   * 用客户端持有的 jti 换取新的 jti
   *
   * @param sessionId 会话 ID
   * @param currentJti 客户端当前持有的 jti
   * @param nextJti 本次签发的新 jti
   * @returns `rotated` 成功；`replayed` jti 不符且会话已被撤销；`missing` 会话记录不存在
   */
  async rotate(sessionId: string, currentJti: string, nextJti: string): Promise<RotateOutcome> {
    const result = Number(
      await this.redis.execute((client) =>
        client.eval(ROTATE, {
          keys: [this.redis.key(this.name(sessionId))],
          arguments: [currentJti, nextJti, String(this.config.refreshTokenTtl)],
        }),
      ),
    );

    if (result === 1) return 'rotated';
    if (result === 0) {
      this.logger.warn(`检测到刷新令牌重放，已撤销会话 ${sessionId}`);
      return 'replayed';
    }
    return 'missing';
  }

  /**
   * 撤销会话的刷新令牌记录
   *
   * @param sessionId 会话 ID
   */
  async revoke(sessionId: string): Promise<void> {
    if (!this.config.refreshTokenRotation) return;
    await this.redis.del(this.name(sessionId));
  }
}
