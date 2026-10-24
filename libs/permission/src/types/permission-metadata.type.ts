import { Mode } from '../enums/mode.enum.js';

/**
 * @Permission 装饰器的输入类型
 * 支持三种用法：
 * 1. 单个权限字符串: @Permission('user:view')
 * 2. 权限数组（默认 AND）: @Permission(['user:view', 'user:edit'])
 * 3. 完整配置对象: @Permission({ value: ['user:view'], mode: Mode.OR, role: 'admin' })
 */
export type PermissionInput =
  | string
  | string[]
  | {
      value: string | string[];
      mode?: Mode;
      role?: string;
    };

/**
 * 规范化后的权限元数据
 * 由 @Permission 装饰器规范化生成，存储在 class/method 元数据中
 */
export interface PermissionMetadata {
  /** 权限编码列表（始终为数组，只读） */
  value: readonly string[];

  /** 权限判定模式（AND: 全部满足；OR: 至少一个） */
  mode: Mode;

  /** 可选的角色兜底字段（当用户拥有该角色时自动通过） */
  role?: string;
}

/**
 * 权限验证结果
 * 用于权限守卫的内部计算
 */
export interface PermissionCheckResult {
  /** 是否通过权限验证 */
  allowed: boolean;

  /** 如果不通过，说明拒绝原因 */
  reason?: 'unauthorized' | 'insufficient_permission' | 'invalid_user';
}
