import type { ValidationOptions } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { registerDecorator } from 'class-validator';

const DECIMAL_ID = /^(?:0|[1-9]\d*)$/;

function transformValue(value: unknown): unknown {
  if (value === '') return undefined;

  if (typeof value === 'string' && DECIMAL_ID.test(value)) {
    return BigInt(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => transformValue(item));
  }

  return value;
}

/**
 * 验证并转换 BigInt ID。
 *
 * HTTP 层仍接收十进制字符串，DTO 转换后暴露 `bigint`，避免 service
 * 在每个调用点重复执行 `parseId()`。
 */
export function BigIntId(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => {
    ApiProperty({ type: String, isArray: options?.each })(target, propertyKey);
    Transform(({ value }) => transformValue(value), { toClassOnly: true })(
      target,
      propertyKey,
    );

    registerDecorator({
      name: 'bigIntId',
      target: target.constructor,
      propertyName: propertyKey.toString(),
      options,
      validator: {
        validate(value: unknown): boolean {
          if (options?.each && Array.isArray(value)) {
            return value.every((item) => typeof item === 'bigint');
          }
          return typeof value === 'bigint';
        },
        defaultMessage(): string {
          return `${propertyKey.toString()} 必须是十进制字符串`;
        },
      },
    });
  };
}
