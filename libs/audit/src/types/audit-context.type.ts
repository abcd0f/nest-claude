import type { OperationType } from '../enums/index.js';

/**
 * 审计上下文 - 用于装饰器传递审计元数据
 */
export interface AuditMetadata {
  /** 模块标题 */
  title: string;
  /** 操作类型 */
  operationType: OperationType;
  /** 是否记录请求参数（默认 true） */
  recordParams?: boolean;
  /** 是否记录响应数据（默认 false，避免大量日志） */
  recordResult?: boolean;
}

/**
 * 登录审计上下文
 */
export interface LoginAuditContext {
  /** 登录账号 */
  userName: string;
  /** 登录 IP */
  ipaddr: string;
  /** 客户端标识 */
  userAgent: string;
  /** 登录状态：0 成功、1 失败 */
  status: '0' | '1';
  /** 提示消息 */
  msg?: string;
}

/**
 * 操作审计上下文
 */
export interface OperationAuditContext {
  /** 模块标题 */
  title: string;
  /** 控制器方法 */
  method: string;
  /** 请求方式 */
  requestMethod: string;
  /** 操作人用户ID */
  operUserId?: bigint;
  /** 请求地址 */
  operUrl: string;
  /** 操作IP */
  operIp: string;
  /** 脱敏后的请求参数 */
  operParam?: string;
  /** 操作状态：0 成功、1 失败 */
  status: '0' | '1';
  /** 错误消息 */
  errorMsg?: string;
  /** 耗时（毫秒） */
  costTime: number;
}
