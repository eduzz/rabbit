
export type LogLevel = 'none' | 'error' | 'warn' | 'info' | 'verbose' | 'debug' | 'silly';

export interface ILogger {
  info(message: any, extra?: any): void;
  warn(message: any, extra?: any): void;
  error(message: any, extra?: any): void;
  debug(message: any, extra?: any): void;
}

class Logger {
  private logger: ILogger = {
    info: (_message: any, _extra: any) => { },
    warn: (_message: any, _extra: any) => { },
    error: (_message: any, _extra: any) => { },
    debug: (_message: any, _extra: any) => { },
  };

  public async initDefaultLogger(loglevel: LogLevel, logger?: ILogger) {
    if (loglevel === 'none') {
      return;
    }

    if (logger) {
      this.logger = logger;
      return;
    }
  }

  public info(message: any, data: any = undefined) {
    this.logger?.info(message, data);
  }

  public warn(message: any, data: any = undefined) {
    this.logger?.warn(message, data);
  }

  public error(message: any, data: any = undefined) {
    this.logger?.error(message, data);
  }

  public debug(message: any, data: any = undefined) {
    this.logger?.debug(message, data);
  }
}

export const logger = new Logger();
