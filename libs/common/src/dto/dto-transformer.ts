import type { ClassConstructor } from 'class-transformer';
import type { PageResponseDto } from './base.dto.js';

import { plainToInstance } from 'class-transformer';
import { PageMetaDto } from './base.dto.js';

/**
 * 统一的响应 DTO 序列化选项
 *
 * 只做「按 `@Expose` 过滤多余字段」，**刻意不开启 `enableImplicitConversion`**：
 *
 * - 它按 `design:type` 元数据隐式转类型，而联合类型（如 `Date | null`）的
 *   `design:type` 是 `Object`，转换行为取决于 value 的实际类型，不可预期；
 * - 它只会把 **`string` 类型属性**上的 `BigInt` 提前 `String()` 化，其他类型属性上的
 *   `BigInt` 保持原样，同一份 DTO 内处理不一致，排查成本高；
 * - 它会让数组属性（`design:type` 为 `Array`）在缺少 `@Type()` 时按 `Array` 递归转换，
 *   嵌套对象有被当成数组处理的风险。
 *
 * 类型转换应由 DTO 自己用 `@Type()` / `@Transform()` 显式声明。
 */
const SERIALIZE_OPTIONS = { excludeExtraneousValues: true };

/**
 * 单个对象转 DTO
 *
 * 入参非空时返回 `T`，为空时返回 `null`（用重载表达，调用点不必写 `!`）。
 */
export function toDto<T>(cls: ClassConstructor<T>, plain: object): T;
export function toDto<T>(cls: ClassConstructor<T>, plain: null | undefined): null;
export function toDto<T>(cls: ClassConstructor<T>, plain: object | null | undefined): T | null {
  if (plain === null || plain === undefined) return null;
  return plainToInstance(cls, plain, SERIALIZE_OPTIONS);
}

/**
 * 对象数组转 DTO 数组
 *
 * 入参非数组或为空时返回空数组，调用点不必自己判空。
 */
export function toDtoList<T>(
  cls: ClassConstructor<T>,
  plainList: null | object[] | undefined,
): T[] {
  if (!plainList || !Array.isArray(plainList)) return [];
  return plainList.map((item) => plainToInstance(cls, item, SERIALIZE_OPTIONS));
}

/**
 * 分页结果转分页 DTO
 *
 * @param cls 单条记录对应的 DTO 类
 * @param data 原始分页结构（`items` 为数据库行，`meta` 为 `makePageMeta()` 的产物）
 */
export function toPageDto<T>(
  cls: ClassConstructor<T>,
  data: PageResponseDto<object>,
): PageResponseDto<T> {
  return {
    items: toDtoList(cls, data.items),
    meta: plainToInstance(PageMetaDto, data.meta, SERIALIZE_OPTIONS),
  };
}

/**
 * 把「可选数值」的原始输入归一化成 `number | undefined`。
 *
 * 存在意义只有一个：**把「空值」和「值为 0」区分开**。
 *
 * 直接写 `@Type(() => Number)` 是不行的——class-transformer 对 `Number` 的处理是
 * `Number(value)`，而 `Number('') === 0`、`Number('  ') === 0`。后果是
 * `?status=`（前端清空筛选后提交的空串）会被静默转成 `0`，也就是「筛选停用用户」，
 * 看起来像筛选失效，实际是条件被凭空造了出来。
 *
 * 所以调用点的写法是 `@Type(() => String)` + 本函数：
 * 前者**压掉**隐式的 `Number` 转换（`enableImplicitConversion: true` 会按
 * `design:type` 把属性转成数字），让 `@Transform` 拿到的是原始字符串，
 * 才能分辨 `''` 与 `'0'`。
 *
 * 非法输入（如 `'abc'`）**刻意返回 `NaN` 而不是 `undefined`**：返回 `undefined`
 * 会被 `@IsOptional()` 放行，筛选条件被静默丢弃；返回 `NaN` 则会落到后续的
 * `@IsEnum` / `@IsIn` 上，得到一个 422 + 字段级提示。
 *
 * @example
 * // DTO 上：
 * @IsOptional()
 * @Type(() => String)
 * @Transform(({ value }) => toOptionalNumber(value))
 * @IsEnum(UserStatus)
 * status?: UserStatus;
 */
export function toOptionalNumber(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }

  return Number(raw);
}
