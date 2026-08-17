import type { z } from 'zod';

export class AIOutputValidationError extends Error {
  constructor(
    readonly context: string,
    readonly issues: string[],
  ) {
    super(`AI output failed schema validation (${context}): ${issues.join('; ')}`);
    this.name = 'AIOutputValidationError';
  }
}

export function validateAIOutput<TSchema extends z.ZodType>(
  schema: TSchema,
  raw: unknown,
  context: string,
): z.infer<TSchema> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new AIOutputValidationError(
      context,
      result.error.issues.map((issue) => issue.message),
    );
  }
  return result.data;
}
