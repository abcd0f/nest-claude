/**
 * 资源政策注册表
 *
 * 定义不同业务资源与数据范围字段的映射关系
 * 用于 DataScopeService 生成查询条件
 *
 * 每个资源需要声明：
 * - deptField: 部门相关字段名称（用于 DEPT/DEPT_AND_CHILD/CUSTOM 范围）
 * - ownerField: 所有者字段名称（用于 SELF 范围）
 */

export enum ResourceType {
  /**
   * 用户资源
   * - deptField: deptId（用户所属部门）
   * - ownerField: userId（用户自身）
   */
  USER = 'user',

  /**
   * 部门资源
   * - deptField: deptId（部门自身）
   * - ownerField: leaderId（部门负责人）
   */
  DEPT = 'dept',

  /**
   * 操作日志资源
   * - deptField: operUser.deptId（操作人所属部门）
   * - ownerField: operUserId（操作人）
   */
  OPER_LOG = 'operLog',
}

/**
 * 资源政策配置
 */
export const RESOURCE_POLICIES: Record<
  ResourceType,
  {
    deptField: string;
    ownerField: string;
  }
> = {
  [ResourceType.USER]: {
    deptField: 'deptId',
    ownerField: 'userId',
  },
  [ResourceType.DEPT]: {
    deptField: 'deptId',
    ownerField: 'leaderId',
  },
  [ResourceType.OPER_LOG]: {
    deptField: 'operUser.deptId',
    ownerField: 'operUserId',
  },
};

/**
 * 获取资源政策
 *
 * @param resource 资源类型
 * @returns 资源政策
 * @throws 如果资源类型未定义，抛出错误
 */
export function getResourcePolicy(resource: ResourceType) {
  const policy = RESOURCE_POLICIES[resource];
  if (!policy) {
    throw new Error(`Unknown resource type: ${resource}`);
  }
  return policy;
}

/**
 * 检查资源是否已注册
 *
 * @param resource 资源类型
 * @returns 是否已注册
 */
export function isResourceRegistered(resource: ResourceType): boolean {
  return resource in RESOURCE_POLICIES;
}
