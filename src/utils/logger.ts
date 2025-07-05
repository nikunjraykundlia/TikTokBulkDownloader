const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(color: string, level: string, msg: string) {
  const timestamp = new Date().toISOString();
  console.log(`${color}[${timestamp}] ${level}: ${msg}${colors.reset}`);
}

export const logger = {
  info: (m: string) => log(colors.blue, 'INFO', m),
  success: (m: string) => log(colors.green, 'SUCCESS', m),
  error: (m: string) => log(colors.red, 'ERROR', m),
  warn: (m: string) => log(colors.yellow, 'WARN', m),
  debug: (m: string) => log(colors.magenta, 'DEBUG', m),
};
export class Logger {
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  info(message: string): void {
    console.log(`[${this.getTimestamp()}] INFO: ${message}`);
  }

  success(message: string): void {
    console.log(`[${this.getTimestamp()}] SUCCESS: ${message}`);
  }

  error(message: string): void {
    console.error(`[${this.getTimestamp()}] ERROR: ${message}`);
  }

  warn(message: string): void {
    console.warn(`[${this.getTimestamp()}] WARN: ${message}`);
  }

  debug(message: string): void {
    console.log(`[${this.getTimestamp()}] DEBUG: ${message}`);
  }
}

export const logger = new Logger();
