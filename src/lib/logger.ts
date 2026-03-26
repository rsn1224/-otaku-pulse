import pino from 'pino';

const LOG_LEVEL = import.meta.env.DEV ? 'debug' : 'warn';

export const logger = pino({
  browser: { asObject: true },
  level: LOG_LEVEL,
});
