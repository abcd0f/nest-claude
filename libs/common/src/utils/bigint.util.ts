import { UnprocessableEntityException } from '@nestjs/common';

/**
 * BigInt ID 格式验证正则：十进制数字字符串
 */
const DECIMAL_ID = /^(?:0|[1-9]\d*)$/;

/**
 * 将字符串解析为 BigInt ID
 * @param value 待解析的值
 * @param field 字段名（用于错误提示）
 * @returns 解析后的 BigInt
 * @throws UnprocessableEntityException 如果格式非法
 */
export function parseId(value: unknown, field = 'id'): bigint {
  if (typeof value !== 'string' || !DECIMAL_ID.test(value)) {
    throw new UnprocessableEntityException(`${field} 必须是十进制字符串`);
  }
  return BigInt(value);
}

/**
 * 将 BigInt ID 格式化为字符串
 * @param value BigInt 值
 * @returns 字符串形式，null/undefined 原样返回
 */
export function formatId(value: bigint | null | undefined): string | null | undefined {
  return value == null ? value : value.toString();
}
