/**
 * 操作类型枚举
 */
export enum OperationType {
  /** 查询 */
  QUERY = 'QUERY',
  /** 新增 */
  CREATE = 'CREATE',
  /** 修改 */
  UPDATE = 'UPDATE',
  /** 删除 */
  DELETE = 'DELETE',
  /** 导出 */
  EXPORT = 'EXPORT',
  /** 导入 */
  IMPORT = 'IMPORT',
  /** 授权 */
  GRANT = 'GRANT',
  /** 登录 */
  LOGIN = 'LOGIN',
  /** 登出 */
  LOGOUT = 'LOGOUT',
  /** 其他 */
  OTHER = 'OTHER',
}
