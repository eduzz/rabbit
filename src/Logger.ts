
export type LogLevel = 'none' | 'error' | 'warn' | 'info' | 'verbose' | 'debug' | 'silly';

export interface ILogger {
  info(message: any): any;
  warn(message: any): any;
  error(message: any): any;
  debug(message: any): any;
}

class Logger {
  private logger: ILogger = {
    info: () => {
      //void
    },
    warn: () => {
      //void
    },
    error: () => {
      //void
    },
    debug: () => {
      //void
    },
  };

  public async initDefaultLogger(loglevel: LogLevel, logger?: ILogger) {
    if (loglevel === 'none') {
      return;
    }

    if (logger) {
      this.logger = logger;
      return;
    }

    try {
      const winston = await import('winston');

      if (!winston.default) {
        return;
      }

      const format = winston.default.format;
      const transports = winston.default.transports;

      this.logger = winston.default.createLogger({
        level: process.env.LOG_LEVEL || 'info',
        format: format.combine(format.timestamp(), format.json()),
        transports: [new transports.Console()],
      });
    } catch (error) {
      // no winston, no problem
    }
  }

  public info(message: any) {
    this.logger?.info(message);
  }

  public warn(message: any) {
    this.logger?.warn(message);
  }

  public error(message: any) {
    this.logger?.error(message);
  }

  public debug(message: any) {
    this.logger?.debug(message);
  }
}

export const logger = new Logger();
