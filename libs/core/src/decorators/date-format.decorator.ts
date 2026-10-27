import type { TransformOptions } from 'class-transformer';
import { Transform, TransformFnParams } from 'class-transformer';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss';
export const DEFAULT_TIMEZONE = 'Asia/Shanghai';

/**
 * 把时间字段格式化成 `YYYY-MM-DD HH:mm:ss`（默认 `Asia/Shanghai`）。
 *
 * **只在「类 → 普通对象」方向生效**（默认 `toPlainOnly: true`），原因：
 *
 * - `ResponseInterceptor` 对每个响应都会执行一次 `instanceToPlain()`，而 DTO 通常
 *   已经先经过一次 `plainToInstance()`（`toDto` / `toDtoList` / `toPageDto`）。
 *   若两个方向都转换，同一字段会被格式化两次；
 * - 第二次拿到的是 `"2026-10-21 08:00:00"` 这样的**无时区字符串**，`dayjs()` 会按
 *   **服务器本地时区**解析再转到 `Asia/Shanghai`，服务器 TZ 不是东八区时（如容器默认
 *   UTC）会凭空偏移 8 小时；
 * - 反序列化阶段保留原始 `Date`，类型声明与运行时一致，也便于下游继续做时间比较。
 *
 * 需要「入向」也格式化时显式传 `{ toPlainOnly: false }`。
 */
export function DateFormat(
  format: string = DEFAULT_DATE_FORMAT,
  options: TransformOptions = { toPlainOnly: true },
): PropertyDecorator {
  return Transform(({ value }: TransformFnParams) => formatDateValue(value, format), options);
}

export function formatDateValue(value: unknown, format: string = DEFAULT_DATE_FORMAT): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return value;
    return dayjs(value).tz(DEFAULT_TIMEZONE).format(format);
  }
  if (typeof value === 'string') {
    const dateValue = dayjs(value);
    if (dateValue.isValid()) return dateValue.tz(DEFAULT_TIMEZONE).format(format);
  }
  return value;
}
