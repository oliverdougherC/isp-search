import type { z } from 'zod';

export type EnvSource = Readonly<Record<string, string | undefined>>;

/**
 * Error thrown when configuration is missing or invalid. The message lists every failing
 * variable with the reason, and never echoes the offending value (values may be secrets).
 */
export class ConfigValidationError extends Error {
  override readonly name = 'ConfigValidationError';
  readonly issues: readonly { readonly variable: string; readonly reason: string }[];

  constructor(processName: string, issues: readonly { variable: string; reason: string }[]) {
    const lines = issues.map((issue) => `  - ${issue.variable}: ${issue.reason}`);
    super(
      [
        `Invalid configuration for ${processName}.`,
        ...lines,
        'See .env.example for descriptions. Run `pnpm env:init` to create a local .env file.',
      ].join('\n'),
    );
    this.issues = issues;
  }
}

/**
 * Validate an environment source against a schema. Unknown variables are ignored so that the
 * schema declares exactly what the process depends on.
 */
export function parseEnv<TSchema extends z.ZodType>(
  processName: string,
  schema: TSchema,
  source: EnvSource,
): z.infer<TSchema> {
  const result = schema.safeParse(source);
  if (result.success) {
    return result.data;
  }
  const issues = result.error.issues.map((issue) => ({
    variable: issue.path.map(String).join('.') || '(root)',
    reason: issue.message,
  }));
  throw new ConfigValidationError(processName, issues);
}
