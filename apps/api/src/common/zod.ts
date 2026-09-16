import { applyDecorators, Body, PipeTransform, Query } from '@nestjs/common';
import { ApiBody, ApiQuery } from '@nestjs/swagger';
import { z, type ZodType } from 'zod';

export class ZodPipe<T extends ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}
  transform(value: unknown): z.infer<T> {
    return this.schema.parse(value ?? {}); // ZodError → 422 problem via ProblemFilter
  }
}

function jsonSchema(schema: ZodType) {
  try {
    return z.toJSONSchema(schema, { unrepresentable: 'any', io: 'input' }) as Record<string, unknown>;
  } catch {
    return { type: 'object' };
  }
}

/** Validated body + OpenAPI schema from the same Zod definition. */
export const ZBody = (schema: ZodType) => Body(new ZodPipe(schema));
export const ZQuery = (schema: ZodType) => Query(new ZodPipe(schema));
export const ApiZodBody = (schema: ZodType) => applyDecorators(ApiBody({ schema: jsonSchema(schema) as never }));
export const ApiZodQuery = (name: string, schema: ZodType) => applyDecorators(ApiQuery({ name, required: false, schema: jsonSchema(schema) as never }));
