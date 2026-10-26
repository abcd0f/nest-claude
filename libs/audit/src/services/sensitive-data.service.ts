import { Injectable } from '@nestjs/common';

/**
 * 敏感数据脱敏服务
 */
@Injectable()
export class SensitiveDataService {
  /**
   * 需要完全移除的敏感字段（密码、Token等）
   */
  private readonly REMOVE_FIELDS = new Set([
    'password',
    'oldPassword',
    'newPassword',
    'confirmPassword',
    'token',
    'accessToken',
    'refreshToken',
    'authorization',
    'secret',
    'privateKey',
    'apiKey',
  ]);

  /**
   * 需要部分脱敏的字段（手机号、身份证等）
   */
  private readonly MASK_FIELDS = new Set(['phone', 'mobile', 'idCard', 'email', 'bankCard']);

  /**
   * 脱敏请求参数
   * @param data 原始数据
   * @returns 脱敏后的 JSON 字符串
   */
  desensitize(data: unknown): string {
    if (data === null || data === undefined) {
      return '';
    }

    try {
      const desensitized = this.desensitizeValue(data);
      return JSON.stringify(desensitized);
    } catch (error) {
      return '[Failed to serialize]';
    }
  }

  /**
   * 递归脱敏数据
   */
  private desensitizeValue(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.desensitizeValue(item));
    }

    if (typeof value === 'object') {
      const result: Record<string, unknown> = {};

      for (const [key, val] of Object.entries(value)) {
        const lowerKey = key.toLowerCase();

        // 完全移除敏感字段
        if (this.REMOVE_FIELDS.has(lowerKey)) {
          result[key] = '***';
          continue;
        }

        // 部分脱敏
        if (this.MASK_FIELDS.has(lowerKey) && typeof val === 'string') {
          result[key] = this.maskString(val);
          continue;
        }

        // 递归处理嵌套对象
        result[key] = this.desensitizeValue(val);
      }

      return result;
    }

    return value;
  }

  /**
   * 字符串脱敏（保留前后各2位，中间用*代替）
   */
  private maskString(str: string): string {
    if (str.length <= 4) {
      return '*'.repeat(str.length);
    }

    const start = str.substring(0, 2);
    const end = str.substring(str.length - 2);
    const middle = '*'.repeat(Math.min(str.length - 4, 6));

    return `${start}${middle}${end}`;
  }
}
