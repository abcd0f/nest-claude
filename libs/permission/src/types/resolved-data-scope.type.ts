import { DataScope } from '../enums/data-scope.enum.js';

/**
 * 已解析的数据范围类型
 * 由 DataScopeService 在运行时计算得出，用于生成 Prisma where 条件
 */
export type ResolvedDataScope =
  | { kind: DataScope.ALL }
  | { kind: DataScope.DEPT }
  | { kind: DataScope.DEPT_AND_CHILD; deptIds: bigint[] }
  | { kind: DataScope.SELF }
  | { kind: DataScope.CUSTOM; deptIds: bigint[] };

/**
 * 检查数据范围是否为某个特定类型
 * @example
 * if (isDataScopeKind(scope, DataScope.CUSTOM)) {
 *   console.log(scope.deptIds); // TypeScript 能正确推断类型
 * }
 */
export function isDataScopeKind<T extends DataScope>(
  scope: ResolvedDataScope,
  kind: T,
): scope is Extract<ResolvedDataScope, { kind: T }> {
  return scope.kind === kind;
}

/**
 * 是否为 ALL 范围（全部数据）
 */
export function isAllScope(scope: ResolvedDataScope): scope is { kind: DataScope.ALL } {
  return scope.kind === DataScope.ALL;
}

/**
 * 是否为自定义范围（CUSTOM 或 DEPT_AND_CHILD 需要部门 ID）
 */
export function isScopeWithDepts(
  scope: ResolvedDataScope,
): scope is { kind: DataScope.DEPT_AND_CHILD | DataScope.CUSTOM; deptIds: bigint[] } {
  return (
    (scope.kind === DataScope.CUSTOM || scope.kind === DataScope.DEPT_AND_CHILD) &&
    'deptIds' in scope
  );
}
