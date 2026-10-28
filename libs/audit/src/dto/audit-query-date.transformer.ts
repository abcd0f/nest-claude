import type { TransformFnParams } from 'class-transformer';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export function transformAuditQueryDate({ key, obj, value }: TransformFnParams): unknown {
  const rawValue = obj[key];

  if (rawValue === '') return undefined;
  if (typeof rawValue !== 'string') return value;

  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(rawValue);
  const parsed = hasTimezone ? dayjs(rawValue) : dayjs.tz(rawValue, 'Asia/Shanghai');

  return parsed.isValid() ? parsed.toDate() : new Date(Number.NaN);
}
