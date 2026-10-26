import { PermissionSeedDefinition } from '../types/permission-seed.type.js';

/**
 * 系统权限种子数据
 *
 * 这是系统权限的权威来源，所有受保护的 API 权限都应在此声明
 *
 * 命名规则：
 * - 格式：<module>:<resource>:<action>
 * - module: 系统模块（system, business, report）
 * - resource: 资源名称（user, role, dept, menu, post）
 * - action: 操作动作（view, add, edit, remove, resetPwd, assign, scope, export, import）
 *
 * 同步规则：
 * 1. 种子中的权限会自动创建或更新到数据库
 * 2. 数据库中存在但种子中不存在的权限会被标记为孤儿（不会自动删除）
 * 3. 权限编码（code）是唯一标识，不可重复
 */
export const PERMISSION_SEEDS: PermissionSeedDefinition[] = [
  // ==================== 用户管理 ====================
  {
    code: 'system:user:view',
    name: '用户查看',
    resource: 'user',
    action: 'view',
    remark: '查看用户列表和详情',
  },
  {
    code: 'system:user:add',
    name: '用户新增',
    resource: 'user',
    action: 'add',
    remark: '新增用户',
  },
  {
    code: 'system:user:edit',
    name: '用户编辑',
    resource: 'user',
    action: 'edit',
    remark: '编辑用户信息',
  },
  {
    code: 'system:user:remove',
    name: '用户删除',
    resource: 'user',
    action: 'remove',
    remark: '删除用户',
  },
  {
    code: 'system:user:resetPwd',
    name: '重置密码',
    resource: 'user',
    action: 'resetPwd',
    remark: '重置用户密码',
  },
  {
    code: 'system:user:assign',
    name: '用户分配',
    resource: 'user',
    action: 'assign',
    remark: '分配用户角色和职位',
  },
  {
    code: 'system:user:export',
    name: '用户导出',
    resource: 'user',
    action: 'export',
    remark: '导出用户数据',
  },
  {
    code: 'system:user:import',
    name: '用户导入',
    resource: 'user',
    action: 'import',
    remark: '导入用户数据',
  },

  // ==================== 角色管理 ====================
  {
    code: 'system:role:view',
    name: '角色查看',
    resource: 'role',
    action: 'view',
    remark: '查看角色列表和详情',
  },
  {
    code: 'system:role:add',
    name: '角色新增',
    resource: 'role',
    action: 'add',
    remark: '新增角色',
  },
  {
    code: 'system:role:edit',
    name: '角色编辑',
    resource: 'role',
    action: 'edit',
    remark: '编辑角色信息',
  },
  {
    code: 'system:role:remove',
    name: '角色删除',
    resource: 'role',
    action: 'remove',
    remark: '删除角色',
  },
  {
    code: 'system:role:assign',
    name: '菜单授权',
    resource: 'role',
    action: 'assign',
    remark: '为角色分配菜单权限',
  },
  {
    code: 'system:role:scope',
    name: '数据范围',
    resource: 'role',
    action: 'scope',
    remark: '设置角色数据范围',
  },
  {
    code: 'system:role:export',
    name: '角色导出',
    resource: 'role',
    action: 'export',
    remark: '导出角色数据',
  },

  // ==================== 菜单管理 ====================
  {
    code: 'system:menu:view',
    name: '菜单查看',
    resource: 'menu',
    action: 'view',
    remark: '查看菜单列表和树',
  },
  {
    code: 'system:menu:add',
    name: '菜单新增',
    resource: 'menu',
    action: 'add',
    remark: '新增菜单',
  },
  {
    code: 'system:menu:edit',
    name: '菜单编辑',
    resource: 'menu',
    action: 'edit',
    remark: '编辑菜单信息',
  },
  {
    code: 'system:menu:remove',
    name: '菜单删除',
    resource: 'menu',
    action: 'remove',
    remark: '删除菜单',
  },

  // ==================== 部门管理 ====================
  {
    code: 'system:dept:view',
    name: '部门查看',
    resource: 'dept',
    action: 'view',
    remark: '查看部门列表和树',
  },
  {
    code: 'system:dept:add',
    name: '部门新增',
    resource: 'dept',
    action: 'add',
    remark: '新增部门',
  },
  {
    code: 'system:dept:edit',
    name: '部门编辑',
    resource: 'dept',
    action: 'edit',
    remark: '编辑部门信息',
  },
  {
    code: 'system:dept:remove',
    name: '部门删除',
    resource: 'dept',
    action: 'remove',
    remark: '删除部门',
  },
  {
    code: 'system:dept:export',
    name: '部门导出',
    resource: 'dept',
    action: 'export',
    remark: '导出部门数据',
  },

  // ==================== 职位管理 ====================
  {
    code: 'system:post:view',
    name: '职位查看',
    resource: 'post',
    action: 'view',
    remark: '查看职位列表和详情',
  },
  {
    code: 'system:post:add',
    name: '职位新增',
    resource: 'post',
    action: 'add',
    remark: '新增职位',
  },
  {
    code: 'system:post:edit',
    name: '职位编辑',
    resource: 'post',
    action: 'edit',
    remark: '编辑职位信息',
  },
  {
    code: 'system:post:remove',
    name: '职位删除',
    resource: 'post',
    action: 'remove',
    remark: '删除职位',
  },
  {
    code: 'system:post:export',
    name: '职位导出',
    resource: 'post',
    action: 'export',
    remark: '导出职位数据',
  },

  // ==================== 权限管理 ====================
  {
    code: 'system:permission:view',
    name: '权限查看',
    resource: 'permission',
    action: 'view',
    remark: '查看权限种子定义',
  },
  {
    code: 'system:permission:check',
    name: '权限诊断',
    resource: 'permission',
    action: 'check',
    remark: '诊断权限健康状态',
  },
  {
    code: 'system:permission:sync',
    name: '权限同步',
    resource: 'permission',
    action: 'sync',
    remark: '同步权限种子到数据库',
  },
  {
    code: 'system:permission:cleanup',
    name: '权限清理',
    resource: 'permission',
    action: 'cleanup',
    remark: '清理孤儿权限',
  },
  {
    code: 'system:permission:fix',
    name: '权限修复',
    resource: 'permission',
    action: 'fix',
    remark: '修复无效的菜单绑定',
  },
  {
    code: 'system:permission:cache',
    name: '缓存管理',
    resource: 'permission',
    action: 'cache',
    remark: '清除权限缓存',
  },

  // ==================== 登录日志 ====================
  {
    code: 'system:loginLog:view',
    name: '登录日志查看',
    resource: 'loginLog',
    action: 'view',
    remark: '查看登录日志列表',
  },
  {
    code: 'system:loginLog:remove',
    name: '登录日志删除',
    resource: 'loginLog',
    action: 'remove',
    remark: '删除登录日志',
  },
  {
    code: 'system:loginLog:export',
    name: '登录日志导出',
    resource: 'loginLog',
    action: 'export',
    remark: '导出登录日志',
  },

  // ==================== 操作日志 ====================
  {
    code: 'system:operLog:view',
    name: '操作日志查看',
    resource: 'operLog',
    action: 'view',
    remark: '查看操作日志列表',
  },
  {
    code: 'system:operLog:remove',
    name: '操作日志删除',
    resource: 'operLog',
    action: 'remove',
    remark: '删除操作日志',
  },
  {
    code: 'system:operLog:export',
    name: '操作日志导出',
    resource: 'operLog',
    action: 'export',
    remark: '导出操作日志',
  },
];
