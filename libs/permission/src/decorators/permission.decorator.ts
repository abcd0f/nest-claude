import type { PermissionInput, PermissionMetadata } from '../types/permission-metadata.type.js';
import { SetMetadata } from '@nestjs/common';
import { Mode } from '../enums/mode.enum.js';

/**
 * 权限元数据的存储键
 * 用于 Reflector 读取权限声明
 */
export const PERMISSION_KEY = 'permission';

/**
 * 验证权限元数据的合法性
 * @throws {Error} 如果元数据不合法
 */
function validatePermissionMetadata(metadata: PermissionMetadata): void {
  if (!metadata.value || metadata.value.length === 0) {
    throw new Error('Permission value cannot be empty');
  }

  for (const code of metadata.value) {
    if (typeof code !== 'string' || code.trim().length === 0) {
      throw new Error(`Invalid permission code: ${code}`);
    }
  }

  if (![Mode.AND, Mode.OR].includes(metadata.mode)) {
    throw new Error(`Invalid permission mode: ${metadata.mode}`);
  }

  if (metadata.role !== undefined && typeof metadata.role !== 'string') {
    throw new Error(`Invalid role: ${metadata.role}`);
  }
}

/**
 * 规范化权限输入为统一的元数据格式
 * @param input 权限输入（字符串、数组或配置对象）
 * @returns 规范化的权限元数据
 */
function normalizePermissionInput(input: PermissionInput): PermissionMetadata {
  if (typeof input === 'string') {
    // 单个字符串: @Permission('user:view')
    return {
      value: [input],
      mode: Mode.AND,
    };
  }

  if (Array.isArray(input)) {
    // 字符串数组（默认 AND 模式）: @Permission(['user:view', 'user:edit'])
    return {
      value: [...input], // 复制数组，确保只读
      mode: Mode.AND,
    };
  }

  // 完整配置对象
  const value = typeof input.value === 'string' ? [input.value] : [...input.value];
  const mode = input.mode ?? Mode.AND;
  const role = input.role;

  return role ? { value, mode, role } : { value, mode };
}

/**
 * 权限装饰器
 *
 * 用于声明 Controller 或路由方法需要的权限
 *
 * @example
 * // 单个权限
 * @Get()
 * @Permission('system:user:view')
 * findAll() {}
 *
 * @example
 * // 多个权限（AND 模式，默认）
 * @Put()
 * @Permission(['system:user:edit', 'system:user:view'])
 * update() {}
 *
 * @example
 * // 多个权限（OR 模式）
 * @Post()
 * @Permission({ value: ['system:user:add', 'system:user:edit'], mode: Mode.OR })
 * save() {}
 *
 * @example
 * // 带角色兜底（用户拥有 admin 角色或指定权限即可通过）
 * @Delete()
 * @Permission({ value: 'system:user:remove', role: 'admin' })
 * remove() {}
 *
 * @param input 权限输入
 * @returns 方法装饰器和类装饰器
 */
export function Permission(input: PermissionInput): MethodDecorator & ClassDecorator {
  const metadata = normalizePermissionInput(input);
  validatePermissionMetadata(metadata);
  return SetMetadata(PERMISSION_KEY, metadata);
}
