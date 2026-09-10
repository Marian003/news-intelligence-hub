import {ConsoleLogger, type LogLevel} from '@nestjs/common';

/**
 * Logger that emits one JSON object per line instead of Nest's coloured,
 * human-oriented output.
 *
 * Under Kubernetes nothing reads the pod's stdout with human eyes: it is
 * scraped by the node's log agent and shipped to a log store. Coloured,
 * multi-column text has to be regex-parsed there and ANSI escape codes corrupt
 * the parse; a JSON line is indexed as-is, so `context`, `level` and `trace`
 * become queryable fields for free. In development the pretty logger stays on,
 * because there the human IS the consumer.
 */
export class JsonLogger extends ConsoleLogger {
  protected printMessages(
    messages: unknown[],
    context = '',
    logLevel: LogLevel = 'log'
  ): void {
    for (const message of messages) {
      process.stdout.write(
        `${JSON.stringify({
          timestamp: new Date().toISOString(),
          level: logLevel,
          context: context || undefined,
          message: normalize(message),
          pid: process.pid,
        })}\n`
      );
    }
  }

  /**
   * Nest passes a stack trace as a separate `printStackTrace` call; emit it as
   * its own structured line so the trace is never silently dropped.
   */
  protected printStackTrace(stack: string): void {
    if (!stack) return;
    process.stdout.write(
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        trace: stack,
        pid: process.pid,
      })}\n`
    );
  }
}

function normalize(message: unknown): unknown {
  if (message instanceof Error) {
    return {name: message.name, message: message.message, stack: message.stack};
  }
  return message;
}

/**
 * JSON logs in production (machine-read), Nest's pretty logger in development
 * (human-read). Used by every entrypoint: API, worker and Bull Board.
 */
export function createLogger(): ConsoleLogger {
  return process.env.NODE_ENV === 'production'
    ? new JsonLogger()
    : new ConsoleLogger();
}
