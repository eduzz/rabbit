import { Connection } from './Connection';
import { IQueueOptions } from './interfaces/IQueueOptions';
import * as amqp from 'amqplib';

export class Queue {
  private connection: Connection;
  private options: IQueueOptions;

  constructor(connection: Connection, name: string) {
    this.connection = connection;

    this.options = {
      name,
      topic: '',
      durable: true,
      enableNack: true,
      retryTimeout: 0,
      nackQueue: `${name}.nack`,
      retryTopic: `${name}.retry`,
      nackTopic: `${name}.nack`
    };
  }

  public topic(topic: string) {
    this.options.topic = topic;
    return this;
  }

  public durable(durable: boolean = true) {
    this.options.durable = durable;
    return this;
  }

  public disableNack() {
    this.options.enableNack = false;
    return this;
  }

  public retryTimeout(timeout: number) {
    if (timeout < 0) {
      throw new Error('Invalid timeout');
    }

    this.options.retryTimeout = timeout;
    return this;
  }

  public async listen<T>(callback: (data: T, message?: amqp.ConsumeMessage) => Promise<boolean>) {
    if (!this.options.topic) {
      throw new Error('You must specify an topic');
    }

    const ch = await this.connection.getChannel();
    const exchange = this.connection.getExchange();

    await this.configureNackQueue(exchange, ch);
    await this.configureQueue(exchange, ch);

    const consumeFn = async (msg: amqp.ConsumeMessage | null) => {
      if (!msg) {
        return;
      }

      try {
        const payload = JSON.parse(msg.content.toString()) as T;
        const result = await callback(payload, msg);
        if (!result) {
          ch.nack(msg, false, false);
          return;
        }
        ch.ack(msg);
      } catch (err) {
        ch.nack(msg, false, false);
      }
    };

    await ch.consume(this.options.name, consumeFn, { noAck: false });
  }

  private async configureNackQueue(exchange: string, ch: amqp.Channel) {
    if (!this.options.enableNack) {
      return;
    }

    let args = {};

    if (this.options.retryTimeout) {
      args = {
        'x-dead-letter-exchange': exchange,
        'x-dead-letter-routing-key': this.options.retryTopic,
        'x-message-ttl': this.options.retryTimeout
      };
    }

    await ch.assertQueue(this.options.nackQueue, {
      durable: this.options.durable,
      arguments: args
    });

    await ch.bindQueue(this.options.nackQueue, exchange, this.options.nackTopic);
  }

  private async configureQueue(exchange: string, ch: amqp.Channel) {
    let args = {};

    if (this.options.enableNack) {
      args = {
        'x-dead-letter-exchange': exchange,
        'x-dead-letter-routing-key': this.options.nackTopic
      };
    }

    await ch.assertQueue(this.options.name, {
      durable: this.options.durable,
      arguments: args
    });
    await ch.bindQueue(this.options.name, exchange, this.options.topic);

    if (this.options.enableNack && this.options.retryTimeout) {
      await ch.bindQueue(this.options.name, exchange, this.options.retryTopic);
    }
  }
}
