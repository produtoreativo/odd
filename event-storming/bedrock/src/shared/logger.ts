type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

type LogPayload = Record<string, unknown>;

export class Logger {
  constructor(private readonly scope: string) {}

  info(message: string, payload?: LogPayload): void {
    this.write('INFO', message, payload);
  }

  warn(message: string, payload?: LogPayload): void {
    this.write('WARN', message, payload);
  }

  error(message: string, payload?: LogPayload): void {
    this.write('ERROR', message, payload);
  }

  debug(message: string, payload?: LogPayload): void {
    this.write('DEBUG', message, payload);
  }

  child(scope: string): Logger {
    return new Logger(`${this.scope}:${scope}`);
  }

  private write(level: LogLevel, message: string, payload?: LogPayload): void {
    const timestamp = new Date().toISOString();
    const details = payload && Object.keys(payload).length > 0
      ? ` ${JSON.stringify(payload)}`
      : '';
    console.log(`[${timestamp}] [${level}] [${this.scope}] ${message}${details}`);
  }
}
