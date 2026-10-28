import type { ValidationError } from 'class-validator';
import type { FieldError } from '../interfaces/index.js';
import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { BusinessException } from '../exceptions/index.js';

function flattenValidationErrors(errors: ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const messages = error.constraints ? Object.values(error.constraints) : [];
    const result = messages.length > 0 ? [{ field, messages }] : [];

    return [...result, ...flattenValidationErrors(error.children ?? [], field)];
  });
}

export class GlobalValidationPipe extends ValidationPipe {
  constructor() {
    super({
      exceptionFactory: (errors) => BusinessException.validation(flattenValidationErrors(errors)),
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      transform: true,
    });
  }
}
