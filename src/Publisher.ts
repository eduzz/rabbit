import { Connection } from './Connection';
import { sleep } from './fn';
import { logger } from './Logger';

interface ISendMessage<T = unknown> {
  payload: T;
  expiration?: number;
  priority?: number;
}

interface IFullOptions<T = unknown> extends ISendMessage<T> {
  persistent: boolean;
}

export class Publisher {
  private options = {
    topic: '',
    persistent: false,
    maxAttempts: 100,
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

  public async send(data: ISendMessage): Promise<void> {
    const options: IFullOptions = {
      ...data,
      persistent: this.options.persistent,
    };

    if (data.expiration) {
      options.expiration = data.expiration;
    }

    let result = false;
    let attempts = 0;

    do {
      attempts++;

      if (attempts > this.options.maxAttempts) {
        throw new Error(`Failed to send message to queue after ${attempts} attempts.`);
      }

      try {
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

        logger.debug({
          message: 'SENT',
          success: result,
          data,
        });
      } catch (err) {
        // just to be
      }
    } while (!result);
  }
}
