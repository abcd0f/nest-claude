import { Prisma } from '@prisma/client';

/**
 * 合并两个 Prisma Where 条件（AND 逻辑）
 * @param conditions 条件数组，null/undefined 被忽略
 * @returns 合并后的 Where 条件
 */
export function andWhere(
  ...conditions: (Prisma.WhereInput | null | undefined)[]
): Prisma.WhereInput {
  const valid = conditions.filter((c) => c !== null && c !== undefined);

  if (valid.length === 0) {
    return {};
  }

  if (valid.length === 1) {
    return valid[0]!;
  }

  return {
    AND: valid,
  };
}

/**
 * 合并两个 Prisma Where 条件（OR 逻辑）
 * @param conditions 条件数组，null/undefined 被忽略
 * @returns 合并后的 Where 条件
 */
export function orWhere(
  ...conditions: (Prisma.WhereInput | null | undefined)[]
): Prisma.WhereInput {
  const valid = conditions.filter((c) => c !== null && c !== undefined);

  if (valid.length === 0) {
    return {};
  }

  if (valid.length === 1) {
    return valid[0]!;
  }

  return {
    OR: valid,
  };
}
