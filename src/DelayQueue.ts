import { Connection } from './Connection';
import { logger } from './Logger';

export class DelayQueue {
  private options = {
    name: '',
    fromTopic: '',
    toTopic: '',
    timeout: 0,
  };

  constructor(private readonly connection: Connection, name: string) {
    this.options.name = name;
  }

  public timeout(value: number) {
    if (value <= 0) {
      throw new Error('You must specify a positive timeout');
    }

    this.options.timeout = value;
    return this;
  }

  public useTimeoutFromMessage() {
    this.options.timeout = -1;
    return this;
  }

  public from(topic: string) {
    this.options.fromTopic = topic;
    return this;
  }

  public to(topic: string) {
    this.options.toTopic = topic;
    return this;
  }

  public async create() {
    if (!this.options.fromTopic) {
      throw new Error('You must specify an source topic');
    }

    if (!this.options.toTopic) {
      throw new Error('You must specify an destination topic');
    }

    if (this.options.timeout === 0) {
      throw new Error('You must specify a timeout or set to use message timeout');
    }

    const ch = await this.connection.loadChannel({
      name: `__delay__${this.options.fromTopic}`,
    });

    const exchange = this.connection.getExchange();

    const args: Record<string, any> = {
      'x-dead-letter-exchange': exchange,
      'x-dead-letter-routing-key': this.options.toTopic,
    };

    if (this.options.timeout > 0) {
      args['x-message-ttl'] = this.options.timeout;
    }

    await ch.assertQueue(this.options.name, {
      durable: true,
      autoDelete: false,
      arguments: args,
    });

    await ch.bindQueue(this.options.name, exchange, this.options.fromTopic);
    await ch.close();

    logger.debug(`Delay queue ${this.options.name} created`);
  }
}
