import { pino, type DestinationStream, type Logger as PinoLogger } from 'pino';

import { toLoggableError } from './errors.js';
import { redactValue } from './redaction.js';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';

export interface LoggerOptions {
  readonly name: string;
  readonly level?: LogLevel;
  /** Test hook: capture output instead of writing to stdout. */
  readonly destination?: DestinationStream;
  readonly base?: Readonly<Record<string, string | number | boolean>>;
}

export type Logger = PinoLogger;

/**
 * Create a structured JSON logger whose every log object passes through `redactValue`.
 *
 * Redaction happens in `formatters.log`, which pino applies to the merged object of each call,
 * so neither bound child context nor per-call fields can bypass it. Error objects are
 * serialized via `toLoggableError`, never via `err.toString()`.
 */
export function createLogger(options: LoggerOptions): Logger {
  const logger = pino(
    {
      name: options.name,
      level: options.level ?? 'info',
      base: { ...(options.base ?? {}), pid: undefined, hostname: undefined },
      messageKey: 'msg',
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => ({ level: label }),
        log: (object) => redactValue(object) as Record<string, unknown>,
      },
      serializers: {
        err: toLoggableError,
        error: toLoggableError,
      },
      hooks: {
        logMethod(args, method) {
          // Redact the message string as well as the merged object.
          const redactedArgs = args.map((arg) =>
            typeof arg === 'string' ? redactValue(arg) : arg,
          );
          method.apply(this, redactedArgs as Parameters<typeof method>);
        },
      },
    },
    options.destination,
  );
  return withRedactedChildren(logger);
}

/**
 * pino applies `formatters.log` to per-call objects but serializes child bindings once at
 * `child()` time without passing them through the log formatter. Wrap `child` so bindings are
 * redacted too, recursively for grandchildren.
 */
function withRedactedChildren(logger: Logger): Logger {
  const originalChild = logger.child.bind(logger) as unknown as (
    bindings: Record<string, unknown>,
    options?: unknown,
  ) => Logger;
  const patched = (bindings: Record<string, unknown>, options?: unknown): Logger =>
    withRedactedChildren(originalChild(redactValue(bindings) as Record<string, unknown>, options));
  Object.defineProperty(logger, 'child', { value: patched, writable: true, configurable: true });
  return logger;
}
