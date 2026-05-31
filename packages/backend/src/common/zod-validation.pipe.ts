import {BadRequestException, Injectable, PipeTransform} from '@nestjs/common';
import {ZodSchema} from 'zod';

/**
 * Validates a request payload against a zod schema, returning the parsed (and
 * possibly transformed, e.g. lowercased email) value. We use zod across the
 * codebase — request input here, LLM output later — rather than a second
 * validation library, so there is one schema tool to reason about.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: result.error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    return result.data;
  }
}
