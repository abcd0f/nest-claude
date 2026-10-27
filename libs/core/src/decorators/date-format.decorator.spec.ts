import { instanceToPlain, plainToInstance } from 'class-transformer';
import { describe, expect, it } from 'vitest';
import { DateFormat, formatDateValue } from './date-format.decorator.js';

class DateDto {
  @DateFormat()
  value: unknown;
}

describe('日期格式化', () => {
  it.each([
    { value: null, expected: null },
    { value: undefined, expected: undefined },
    { value: 123, expected: 123 },
    { value: 'invalid date', expected: 'invalid date' },
    { value: '2026-10-21T00:00:00Z', expected: '2026-10-21 08:00:00' },
    { value: new Date('2026-10-21T00:00:00Z'), expected: '2026-10-21 08:00:00' },
  ])('函数与单向 DTO 序列化保留约定结果：$value', ({ value, expected }) => {
    expect(formatDateValue(value)).toEqual(expected);

    // 反序列化阶段不格式化：原始值原样保留，避免响应序列化时二次换算时区。
    expect(plainToInstance(DateDto, { value }).value).toEqual(value);

    // 只在「类 → 普通对象」方向格式化。
    expect(instanceToPlain(Object.assign(new DateDto(), { value })).value).toEqual(expected);
  });

  it('无效 Date 不转换成日期字符串', () => {
    const value = new Date(Number.NaN);

    expect(formatDateValue(value)).toBe(value);
    expect((plainToInstance(DateDto, { value }).value as Date).getTime()).toBeNaN();
    expect(
      (instanceToPlain(Object.assign(new DateDto(), { value })).value as Date).getTime(),
    ).toBeNaN();
  });

  it('支持自定义格式', () => {
    class CustomDateDto {
      @DateFormat('YYYY/MM/DD HH:mm')
      value: unknown;
    }

    const value = '2026-10-20T20:30:00Z';

    expect(formatDateValue(value, 'YYYY/MM/DD HH:mm')).toBe('2026/10/21 04:30');
    expect(instanceToPlain(Object.assign(new CustomDateDto(), { value })).value).toBe(
      '2026/10/21 04:30',
    );
  });

  it('先反序列化再序列化只格式化一次', () => {
    const plain = plainToInstance(DateDto, { value: new Date('2026-10-21T00:00:00Z') });

    // 反序列化不格式化，Date 原样保留
    expect(plain.value).toBeInstanceOf(Date);
    // 序列化时按 Asia/Shanghai 输出，且不会因为二次格式化再偏移 8 小时
    expect(instanceToPlain(plain).value).toBe('2026-10-21 08:00:00');
  });
});
