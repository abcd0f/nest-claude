/**
 * 权限诊断相关类型
 *
 * 方案 B（菜单优先）下的语义约定：
 * - 权限行的唯一创建入口是**菜单管理**（C/F 节点填写 `perms` 时自动创建/更新）
 * - 因此 `menuId === null` 的权限属于异常残留，除非是历史数据或手工 SQL 插入
 * - 代码里的 `@Permission('...')` 只是**引用**权限编码，不参与创建
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
   *
   * 菜单优先架构下所有权限都应来自菜单，因此这里非空通常意味着：
   * 菜单被删除后残留、或通过 SQL 手工插入。可结合 orphans 判断是否可清理。
   */
  unbound: Array<{
    code: string;
    name: string;
  }>;

  /**
   * 孤儿权限：未绑定菜单且没有任何角色引用
   *
   * 这类权限既无法通过菜单授权、也不在任何角色的权限集中，
   * 属于纯粹的数据残留，可通过 DELETE /system/permission/orphans 清理。
   */
  orphans: Array<{
    code: string;
    name: string;
    menuId: bigint | null;
  }>;

  /**
   * 未被任何角色使用的权限
   *
   * 属正常状态：菜单刚配好权限但还没在角色管理里授权。仅作提示。
   */
  unassigned: Array<{
    code: string;
    name: string;
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

/**
 * 代码引用一致性检查结果
 *
 * 菜单优先架构下，`@Permission` 的编码没有编译期约束，
 * 因此必须在运行期提供这道检查：代码里声明的编码是否都真实存在于数据库中。
 */
export interface PermissionReferenceCheckResult {
  /**
   * 代码中声明的权限编码总数（去重后）
   */
  total: number;

  /**
   * 代码引用但数据库缺失的编码
   *
   * 高危：这类接口对所有非超管用户都会返回 403。
   * 修复方式是在菜单管理里新增一个 C/F 节点并填写对应 `perms`。
   */
  missing: Array<{
    code: string;
    /** 出现位置，格式为 ControllerName.methodName */
    locations: string[];
  }>;

  /**
   * 数据库中存在但代码未引用的编码
   *
   * 可能是纯前端按钮权限（只用于控制按钮显隐），也可能是已废弃的权限，需人工判断。
   */
  unused: Array<{
    code: string;
    name: string;
    menuId: bigint | null;
  }>;

  /**
   * 代码中声明的全部编码（按字典序）
   */
  codes: string[];
}
