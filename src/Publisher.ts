import { Channel } from 'amqplib';

import { Connection } from './Connection';
import { sleep } from './fn';
import { logger } from './Logger';

interface ISendMessage<T = unknown> {
  payload: T;
  expiration?: number;
  priority?: number;
  drainTimeout?: number;
}

interface IFullOptions<T = unknown> extends ISendMessage<T> {
  persistent: boolean;
}

export class Publisher {
  private options = {
    topic: '',
    persistent: false,
    maxAttempts: 100,
    drainTimeout: 30_000,
  };

  constructor(private readonly connection: Connection, topic: string) {
    this.options.topic = topic;
  }

  public persistent(isPersistent = true) {
    this.options.persistent = isPersistent;
    return this;
  }

  public maxRetryAttempts(max: number) {
    this.options.maxAttempts = max;
    return this;
  }

  public drainTimeout(timeoutInMs: number) {
    this.options.drainTimeout = timeoutInMs;
    return this;
  }

  public async send(data: ISendMessage): Promise<void> {
    const options: IFullOptions = {
      ...data,
      persistent: this.options.persistent,
    };

    if (data.expiration) {
      options.expiration = data.expiration;
    }

    let result = false;

    do {
      if (this.connection.isBlocked()) {
        await sleep(100);
        continue;
      }

      const channel = await this.connection.loadChannel({
        name: '__topic__',
      });

      const msg = Buffer.from(JSON.stringify(data.payload));

      result = channel.publish(this.connection.getExchange(), this.options.topic, msg, {
        ...options,
        priority: data.priority,
      });

      if (!result) {
        try {
          await this.waitDrain(channel);
          continue;
        } catch (err) {
          logger.error({
            message: 'DRAIN TIMEOUT, Waiting',
          });
        }
      }

      logger.debug({
        message: 'SENT',
        success: result,
        data,
      });
    } while (!result);
  }

  private async waitDrain(channel: Channel) {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout'));
      }, this.options.drainTimeout);

      channel.once('drain', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }
}
