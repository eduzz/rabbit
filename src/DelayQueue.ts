import { Connection } from './Connection';
import { IDelayQueueOptions } from './interfaces/IDelayQueueOptions';

export class DelayQueue {
  private connection: Connection;
  private options: IDelayQueueOptions;

  constructor(connection: Connection, name: string) {
    this.connection = connection;

    this.options = {
      name,
      fromTopic: '',
      toTopic: '',
      durable: true,
      timeout: 0
    };
  }

  public durable(durable: boolean = true) {
    this.options.durable = durable;
    return this;
  }

  public timeout(value: number) {
    this.options.timeout = value;
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

    if (!this.options.fromTopic) {
      throw new Error('You must specify an destination topic');
    }

    if (this.options.timeout <= 0) {
      throw new Error('You must specify a positive timeout');
    }

    const ch = await this.connection.getChannel();
    const exchange = this.connection.getExchange();

    const args = {
      'x-dead-letter-exchange': exchange,
      'x-dead-letter-routing-key': this.options.toTopic,
      'x-message-ttl': this.options.timeout
    };

    await ch.assertQueue(this.options.name, {
      durable: this.options.durable,
      autoDelete: false,
      arguments: args
    });

    await ch.bindQueue(this.options.name, exchange, this.options.fromTopic);
  }
}
