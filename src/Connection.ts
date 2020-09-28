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

  public async createChannel(): Promise<amqp.Channel> {
    const connection = await this.getConnection();

    const channel = await connection.createChannel();

    channel.assertExchange(this.options.exchange, this.options.exchangeType);

    return channel;
  }

  public async close() {
    const channel = await this.getChannel();
    await channel.close();
    const connection = await this.getConnection();
    await connection.close();
  }

  public registerShutdownSignal() {
    process.once('SIGINT', async () => {
      await this.close();
    });

    return this;
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

    this.connection = amqp.connect(this.options.dsn, {
      clientProperties: { connection_name: this.options.connectionName }
    });

    return this.connection;
  }
}
