// Shared logger utility used across different test projects
export interface LogLevel {
  DEBUG: "debug";
  INFO: "info";
  WARN: "warn";
  ERROR: "error";
}

export const LOG_LEVELS: LogLevel = {
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
} as const;

export type LogLevelType = LogLevel[keyof LogLevel];

export class Logger {
  private logs: Array<{
    level: LogLevelType;
    message: string;
    timestamp: Date;
  }> = [];

  log(level: LogLevelType, message: string, data?: unknown): void {
    const entry = {
      level,
      message,
      timestamp: new Date(),
      data,
    };
    this.logs.push(entry);
    console.log(`[${level.toUpperCase()}] ${message}`, data);
  }

  debug(message: string, data?: unknown): void {
    this.log(LOG_LEVELS.DEBUG, message, data);
  }

  info(message: string, data?: unknown): void {
    this.log(LOG_LEVELS.INFO, message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log(LOG_LEVELS.WARN, message, data);
  }

  error(message: string, data?: unknown): void {
    this.log(LOG_LEVELS.ERROR, message, data);
  }

  getLogs(): Array<{
    level: LogLevelType;
    message: string;
    timestamp: Date;
    data?: unknown;
  }> {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }
}
