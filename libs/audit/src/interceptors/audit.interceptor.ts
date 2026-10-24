import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap, catchError, throwError } from 'rxjs';
import type { FastifyRequest } from 'fastify';
import { OperationLogService } from '../services/operation-log.service.js';
import { SensitiveDataService } from '../services/sensitive-data.service.js';
import { AUDIT_METADATA_KEY } from '../decorators/audit.decorator.js';
import type { AuditMetadata, OperationAuditContext } from '../types/index.js';
import type { UserPrincipal } from '@app/auth';

/**
 * 审计拦截器 - 自动记录操作日志
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly operationLogService: OperationLogService,
    private readonly sensitiveDataService: SensitiveDataService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // 读取审计元数据
    const metadata = this.reflector.get<AuditMetadata | undefined>(
      AUDIT_METADATA_KEY,
      context.getHandler(),
    );

    // 没有审计元数据，不记录日志
    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const user = (request as unknown as { user?: UserPrincipal }).user;

    // 开始时间
    const startTime = Date.now();

    // 准备审计上下文
    const auditContext: Omit<OperationAuditContext, 'status' | 'costTime' | 'errorMsg'> = {
      title: metadata.title,
      method: `${context.getClass().name}.${context.getHandler().name}`,
      requestMethod: request.method,
      operUserId: user?.userId,
      operUrl: request.url,
      operIp: this.extractIp(request),
      operParam: this.extractParams(request, metadata),
    };

    return next.handle().pipe(
      tap(() => {
        // 操作成功
        const costTime = Date.now() - startTime;
        void this.operationLogService.log({
          ...auditContext,
          status: '0',
          costTime,
        });
      }),
      catchError((error: unknown) => {
        // 操作失败
        const costTime = Date.now() - startTime;
        void this.operationLogService.log({
          ...auditContext,
          status: '1',
          errorMsg: error instanceof Error ? error.message : String(error),
          costTime,
        });
        return throwError(() => error);
      }),
    );
  }

  /**
   * 提取客户端 IP
   */
  private extractIp(request: FastifyRequest): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return ip?.trim() || 'unknown';
    }

    return request.ip || 'unknown';
  }

  /**
   * 提取并脱敏请求参数
   */
  private extractParams(request: FastifyRequest, metadata: AuditMetadata): string | undefined {
    if (metadata.recordParams === false) {
      return undefined;
    }

    try {
      // 合并 query, body, params
      const params = {
        ...(request.query as Record<string, unknown>),
        ...(request.body as Record<string, unknown>),
        ...(request.params as Record<string, unknown>),
      };

      // 脱敏
      return this.sensitiveDataService.desensitize(params);
    } catch {
      return undefined;
    }
  }
}
