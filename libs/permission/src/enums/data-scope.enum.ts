/**
 * 数据范围枚举
 * 定义了用户可访问的数据范围
 * 与 sys_role.data_scope 数据库字段值保持一致
 */
export enum DataScope {
  /**
   * 全部数据：用户可以访问所有数据，无限制
   */
  ALL = '1',

  /**
   * 本部门：用户只能访问自己所在部门的数据
   */
  DEPT = '2',

  /**
   * 本部门及以下：用户可以访问自己所在部门及其所有下级部门的数据
   */
  DEPT_AND_CHILD = '3',

  /**
   * 仅本人：用户只能访问自己创建或相关的数据
   */
  SELF = '4',

  /**
   * 自定义部门：用户可以访问通过 sys_role_dept 指定的部门数据
   */
  CUSTOM = '5',
}

/**
 * 检查给定值是否为有效的数据范围
 */
export function isValidDataScope(value: unknown): value is DataScope {
  return Object.values(DataScope).includes(value as DataScope);
}
