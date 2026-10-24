import { SetMetadata } from '@nestjs/common';
import type { AuditMetadata } from '../types/index.js';

/**
 * 审计装饰器元数据键
 */
export const AUDIT_METADATA_KEY = Symbol('audit:metadata');

/**
 * 审计装饰器 - 标记需要记录操作日志的接口
 *
 * @example
 * ```ts
 * @Audit({ title: '用户管理', operationType: OperationType.CREATE })
 * @Post()
 * async create() {}
 * ```
 */
export function Audit(metadata: AuditMetadata): MethodDecorator {
  return SetMetadata(AUDIT_METADATA_KEY, metadata);
}
