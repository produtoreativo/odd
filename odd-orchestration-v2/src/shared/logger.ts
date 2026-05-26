export class Logger {
  constructor(private readonly scope: string) {}

  debug(message: string, payload?: Record<string, unknown>): void {
    this.log('DEBUG', message, payload);
  }

  info(message: string, payload?: Record<string, unknown>): void {
    this.log('INFO', message, payload);
  }

  warn(message: string, payload?: Record<string, unknown>): void {
    this.log('WARN', message, payload);
  }

  error(message: string, payload?: Record<string, unknown>): void {
    this.log('ERROR', message, payload);
  }

  private log(level: string, message: string, payload?: Record<string, unknown>) {
    const suffix = payload ? ` ${JSON.stringify(payload)}` : '';
    console.log(`[${new Date().toISOString()}] [${level}] [${this.scope}] ${message}${suffix}`);
  }
}
