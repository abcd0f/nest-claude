/**
 * 权限判定模式枚举
 * 用于 @Permission 装饰器中定义多个权限的判定逻辑
 */
export enum Mode {
  /**
   * AND 模式：用户必须拥有所有指定的权限
   * @example @Permission(['user:view', 'user:edit']) 要求同时拥有两个权限
   */
  AND = 'AND',

  /**
   * OR 模式：用户只需拥有其中一个指定的权限
   * @example @Permission({ value: ['user:view', 'user:edit'], mode: Mode.OR }) 只需拥有其中一个
   */
  OR = 'OR',
}
