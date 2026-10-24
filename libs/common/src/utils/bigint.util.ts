import { UnprocessableEntityException } from '@nestjs/common';

/**
 * 十进制 ID 正则表达式
 * 匹配十进制字符串：0 或不以 0 开头的数字序列
 */
const DECIMAL_ID = /^(0|[1-9]\d*)$/;

/**
 * 解析字符串 ID 为 BigInt
 * @param value - 需要解析的值
 * @param field - 字段名称（用于错误消息）
 * @returns 解析后的 BigInt
 * @throws UnprocessableEntityException - 当值格式不合法时抛出
 */
export function parseId(value: unknown, field = 'id'): bigint {
  if (typeof value !== 'string' || !DECIMAL_ID.test(value)) {
    throw new UnprocessableEntityException(`${field} 必须是十进制字符串`);
  }
  return BigInt(value);
}

/**
 * 将 BigInt 或可选的 BigInt 值转换为字符串
 * @param value - 需要格式化的 BigInt 值
 * @returns 格式化后的字符串，null/undefined 值直接返回
 */
export function formatId(value: bigint | null | undefined): string | null | undefined {
  return value == null ? value : value.toString();
}

/**
 * 批量解析字符串 ID 数组为 BigInt 数组
 * @param values - 字符串 ID 数组
 * @param field - 字段名称（用于错误消息）
 * @returns BigInt 数组
 */
export function parseIds(values: unknown[], field = 'ids'): bigint[] {
  if (!Array.isArray(values)) {
    throw new UnprocessableEntityException(`${field} 必须是数组`);
  }
  return values.map((v, idx) => {
    if (typeof v !== 'string' || !DECIMAL_ID.test(v)) {
      throw new UnprocessableEntityException(`${field}[${idx}] 必须是十进制字符串`);
    }
    return BigInt(v);
  });
}

/**
 * 批量格式化 BigInt 数组为字符串数组
 * @param values - BigInt 值数组
 * @returns 字符串数组
 */
export function formatIds(values: (bigint | null | undefined)[]): (string | null | undefined)[] {
  return values.map((v) => formatId(v));
}
