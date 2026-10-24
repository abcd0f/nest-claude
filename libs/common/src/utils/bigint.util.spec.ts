import { UnprocessableEntityException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { formatId, formatIds, parseId, parseIds } from './bigint.util';

describe('BigInt Utils', () => {
  describe('parseId', () => {
    it('应该解析有效的十进制字符串', () => {
      expect(parseId('123')).toBe(123n);
      expect(parseId('0')).toBe(0n);
      expect(parseId('99999999999999999')).toBe(99999999999999999n);
    });

    it('应该拒绝非字符串类型', () => {
      expect(() => parseId(123, 'testId')).toThrow(
        new UnprocessableEntityException('testId 必须是十进制字符串'),
      );
      expect(() => parseId(null, 'testId')).toThrow();
      expect(() => parseId(undefined, 'testId')).toThrow();
    });

    it('应该拒绝非十进制字符串', () => {
      expect(() => parseId('abc', 'testId')).toThrow();
      expect(() => parseId('123abc', 'testId')).toThrow();
      expect(() => parseId('0123', 'testId')).toThrow(); // 前导零
      expect(() => parseId('12.34', 'testId')).toThrow();
      expect(() => parseId('-123', 'testId')).toThrow();
      expect(() => parseId('+123', 'testId')).toThrow();
    });

    it('应该允许自定义字段名用于错误消息', () => {
      expect(() => parseId('invalid', 'customField')).toThrow(
        new UnprocessableEntityException('customField 必须是十进制字符串'),
      );
    });

    it('应该处理超大 BigInt 值', () => {
      const maxBigInt = '9223372036854775807'; // JavaScript Number.MAX_SAFE_INTEGER
      expect(parseId(maxBigInt)).toBe(BigInt(maxBigInt));

      const largerValue = '99999999999999999999999';
      expect(parseId(largerValue)).toBe(BigInt(largerValue));
    });
  });

  describe('formatId', () => {
    it('应该将 BigInt 转换为字符串', () => {
      expect(formatId(123n)).toBe('123');
      expect(formatId(0n)).toBe('0');
      expect(formatId(99999999999999999n)).toBe('99999999999999999');
    });

    it('应该保持 null 和 undefined', () => {
      expect(formatId(null)).toBe(null);
      expect(formatId(undefined)).toBe(undefined);
    });

    it('不应该损失精度', () => {
      const largeId = BigInt('9007199254740992'); // 超过 JavaScript 安全整数
      const formatted = formatId(largeId);
      const parsed = BigInt(formatted!);
      expect(parsed).toBe(largeId);
    });
  });

  describe('parseIds', () => {
    it('应该解析有效的十进制字符串数组', () => {
      expect(parseIds(['1', '2', '3'])).toEqual([1n, 2n, 3n]);
      expect(parseIds(['0'])).toEqual([0n]);
    });

    it('应该拒绝非数组输入', () => {
      expect(() => parseIds('123' as any, 'testIds')).toThrow(
        new UnprocessableEntityException('testIds 必须是数组'),
      );
    });

    it('应该拒绝包含非法元素的数组', () => {
      expect(() => parseIds(['123', 'invalid'], 'testIds')).toThrow();
      expect(() => parseIds(['0123'], 'testIds')).toThrow();
      expect(() => parseIds(['123', '-456'], 'testIds')).toThrow();
    });

    it('应该在错误消息中指示具体位置', () => {
      expect(() => parseIds(['1', '2', 'invalid'], 'testIds')).toThrow(
        /testIds\[2\]/,
      );
    });

    it('应该处理空数组（虽然 DTO 验证应该拒绝）', () => {
      expect(parseIds([])).toEqual([]);
    });
  });

  describe('formatIds', () => {
    it('应该批量转换 BigInt 数组为字符串数组', () => {
      expect(formatIds([1n, 2n, 3n])).toEqual(['1', '2', '3']);
    });

    it('应该保持 null 和 undefined 值', () => {
      expect(formatIds([1n, null, undefined, 2n])).toEqual([
        '1',
        null,
        undefined,
        '2',
      ]);
    });
  });

  describe('Big Integer Boundary Tests', () => {
    it('应该正确处理 JavaScript 安全整数边界', () => {
      // Number.MAX_SAFE_INTEGER = 9007199254740991
      const safeMax = '9007199254740991';
      const unsafeValue = '9007199254740992';

      const parsedSafe = parseId(safeMax);
      const parsedUnsafe = parseId(unsafeValue);

      // formatId 应该保持精度
      expect(formatId(parsedSafe)).toBe(safeMax);
      expect(formatId(parsedUnsafe)).toBe(unsafeValue);
    });

    it('应该支持 PostgreSQL BIGINT 的完整范围', () => {
      // PostgreSQL BIGINT: -9223372036854775808 to 9223372036854775807
      const max = '9223372036854775807';
      const parsed = parseId(max);
      expect(formatId(parsed)).toBe(max);
    });
  });
});
