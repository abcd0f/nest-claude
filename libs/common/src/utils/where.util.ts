/**
 * Prisma Where 条件合并工具。
 *
 * 关于类型：Prisma 7 的 `prisma-client` 生成器不再产出通用的 `Prisma.WhereInput`，
 * 而是按模型分别生成 `UserWhereInput` / `DeptWhereInput` 等。因此这里不绑定具体模型，
 * 统一用泛型 `T` 承接，返回类型与入参保持一致，可直接交给 `prisma.xxx.findMany({ where })`。
 *
 * 注意：泛型约束会绕过对象字面量的多余属性检查（字段名写错不会报错）。
 * 需要严格校验时显式传入模型类型，例如 `andWhere<Prisma.UserWhereInput>(...)`。
 */

/**
 * 过滤掉 null / undefined 条件
 * @param conditions 条件数组
 * @returns 有效条件数组
 */
function compact<T>(conditions: (T | null | undefined)[]): T[] {
  return conditions.filter((c): c is T => c !== null && c !== undefined);
}

/**
 * 合并多个 Prisma Where 条件（AND 逻辑）
 * @param conditions 条件数组，null/undefined 被忽略
 * @returns 合并后的 Where 条件
 */
export function andWhere<T extends object>(...conditions: (T | null | undefined)[]): T {
  const valid = compact(conditions);

  if (valid.length === 0) {
    return {} as T;
  }

  if (valid.length === 1) {
    return valid[0]!;
  }

  return { AND: valid } as T;
}

/**
 * 合并多个 Prisma Where 条件（OR 逻辑）
 * @param conditions 条件数组，null/undefined 被忽略
 * @returns 合并后的 Where 条件
 */
export function orWhere<T extends object>(...conditions: (T | null | undefined)[]): T {
  const valid = compact(conditions);

  if (valid.length === 0) {
    return {} as T;
  }

  if (valid.length === 1) {
    return valid[0]!;
  }

  return { OR: valid } as T;
}
