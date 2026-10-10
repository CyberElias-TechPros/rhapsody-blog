/**
 * Structured logging for Workers (visible in `wrangler tail` / dashboard logs).
 * Never log passwords, tokens, or full auth headers — logging.ts has no access to them
 * by construction: callers decide what goes in.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogFields {
  [key: string]: unknown;
}

const emit = (level: LogLevel, msg: string, fields: LogFields): void => {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
};

export const logInfo = (msg: string, fields: LogFields = {}): void => emit('info', msg, fields);
export const logWarn = (msg: string, fields: LogFields = {}): void => emit('warn', msg, fields);
export const logError = (msg: string, fields: LogFields = {}): void => emit('error', msg, fields);
