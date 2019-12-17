import * as amqp from 'amqplib';
import { IConnectionOptions } from './interfaces/IConnectionOptions';
import { Publisher } from './Publisher';
import { Queue } from './Queue';

export class Connection {
  private channel!: Promise<amqp.Channel>;
  private connection!: Promise<amqp.Connection>;
  private options: IConnectionOptions;

  constructor(options: IConnectionOptions) {
    this.options = options;
  }

  public async getChannel(): Promise<amqp.Channel> {
    if (this.channel) {
      return this.channel;
    }

    const connection = await this.getConnection();

    this.channel = connection.createChannel().then(channel => {
      channel.assertExchange(this.options.exchange, this.options.exchangeType);
      return channel;
    });

    return this.channel;
  }

  public topic(topic: string) {
    return new Publisher(this, topic);
  }

  public queue(topic: string) {
    return new Queue(this, topic);
  }

  public getExchange() {
    return this.options.exchange;
  }

  private async getConnection(): Promise<amqp.Connection> {
    if (this.connection) {
      return this.connection;
    }

    this.connection = amqp.connect(this.options.dsn);

    return this.connection;
  }
}
