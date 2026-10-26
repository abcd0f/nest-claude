/**
 * 权限种子定义
 *
 * 用于在代码中声明系统所需的权限，并与数据库进行同步
 */
export interface PermissionSeedDefinition {
  /**
   * 权限编码（唯一标识）
   * 格式：<module>:<resource>:<action>
   * 例如：system:user:view
   */
  code: string;

  /**
   * 权限名称（用于展示）
   * 例如：用户查看
   */
  name: string;

  /**
   * 资源名称（可选，便于分组）
   * 例如：user
   */
  resource?: string;

  /**
   * 操作动作（可选）
   * 例如：view
   */
  action?: string;

  /**
   * 备注说明（可选）
   */
  remark?: string;

  /**
   * 默认状态（可选，默认为启用）
   * '0' = 启用, '1' = 停用
   */
  status?: '0' | '1';
}

/**
 * 权限同步结果
 */
export interface PermissionSyncResult {
  /**
   * 新增的权限数量
   */
  created: number;

  /**
   * 更新的权限数量
   */
  updated: number;

  /**
   * 跳过的权限数量（已存在且无变更）
   */
  skipped: number;

  /**
   * 孤儿权限（数据库中存在但种子中不存在）
   */
  orphans: Array<{
    code: string;
    name: string;
    menuId: bigint | null;
  }>;

  /**
   * 同步详情
   */
  details: Array<{
    code: string;
    action: 'created' | 'updated' | 'skipped';
    message?: string;
  }>;
}

/**
 * 权限诊断结果
 *
 * 注意：与 `PermissionCheckResult`（守卫判定结果 `{ allowed, reason }`）区分命名，
 * 避免在 `@app/permission` 聚合导出中同名遮蔽。
 */
export interface PermissionDiagnosticResult {
  /**
   * 总权限数
   */
  total: number;

  /**
   * 启用的权限数
   */
  enabled: number;

  /**
   * 停用的权限数
   */
  disabled: number;

  /**
   * 未绑定菜单的权限
   */
  unbound: Array<{
    code: string;
    name: string;
  }>;

  /**
   * 孤儿权限（没有任何角色使用）
   */
  orphans: Array<{
    code: string;
    name: string;
    menuId: bigint | null;
  }>;

  /**
   * 重复编码（理论上不应存在，因为有唯一约束）
   */
  duplicates: Array<{
    code: string;
    count: number;
  }>;

  /**
   * 绑定了菜单但菜单不存在的权限
   */
  invalidMenuBindings: Array<{
    code: string;
    name: string;
    menuId: bigint;
  }>;
}
