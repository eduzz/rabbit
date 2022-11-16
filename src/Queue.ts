import { Connection } from './Connection';
import { IQueueOptions } from './interfaces/IQueueOptions';
import * as amqp from 'amqplib';
import { sleep } from './fn';

export class Queue {
  private connection: Connection;
  private options: IQueueOptions;
  private arguments: { [key: string]: any } = {};

  constructor(connection: Connection, name: string) {
    this.connection = connection;

    this.options = {
      name,
      topics: [],
      durable: true,
      enableNack: true,
      retryTimeout: 0,
      nackQueue: `${name}.nack`,
      DQLQueue: `${name}.dlq`,
      retryTopic: `${name}.retry`,
      nackTopic: `${name}.nack`,
      autoDelete: false,
      exclusive: false,
      prefetch: 1,
      deadLeaterAfter: -1
    };
  }

  public topic(...topics: string[]) {
    this.options.topics.push(...topics);
    return this;
  }

  public durable(durable: boolean = true) {
    this.options.durable = durable;
    return this;
  }

  public deadLeaterAfter(numberOfNacks: number) {

    if (numberOfNacks <= 0) {
      throw new Error("the number of nacks to the DLQ must be positive or zero")
    }

    this.options.deadLeaterAfter = numberOfNacks;

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

  public ephemeral() {
    this.options.autoDelete = true;

    const id = Math.ceil(Math.random() * Number.MAX_SAFE_INTEGER);

    this.options.name = `${this.options.name}.${id}`;
    this.options.nackQueue = `${this.options.name}.nack`;
    this.options.retryTopic = `${this.options.name}.retry`;
    this.options.nackTopic = `${this.options.name}.nack`;

    return this;
  }

  public exclusive() {
    this.options.exclusive = true;
    return this;
  }

  public prefetch(quantity: number) {
    if (quantity <= 0) {
      throw new Error('prefetch must be greater than zero');
    }

    this.options.prefetch = quantity;
    return this;
  }

  public priority(max: number) {
    this.arguments['x-max-priority'] = max;
    return this;
  }

  public async create() {
    const ch = await this.connection.createChannel();
    const exchange = this.connection.getExchange();

    await this.configureNackQueue(exchange, ch);
    await this.configureDLQQueue(ch);
    await this.configureQueue(exchange, ch);
  }

  public async listen<T>(callback: (data: T, message?: amqp.ConsumeMessage) => Promise<boolean>) {
    if (this.options.topics.length === 0) {
      throw new Error('You must specify an least one topic');
    }

    let active = false;

    while (true) {
      try {
        if (active) {
          await sleep(1000);
          continue;
        }

        const channel = await this.connection.createChannel(() => {
          active = false;
        });
        const exchange = this.connection.getExchange();

        await this.configureDLQQueue(channel);
        await this.configureNackQueue(exchange, channel);
        await this.configureQueue(exchange, channel);

        await channel.prefetch(this.options.prefetch);

        const consumeFn = async (msg: amqp.ConsumeMessage | null) => {
          if (!msg) {
            return;
          }

          try {
            const payload = JSON.parse(msg.content.toString()) as T;
            const result = await callback(payload, msg);
            if (!result) {
              await this.handleFailedMessage(channel, msg);
              return;
            }
            channel.ack(msg);
          } catch (err) {
            try {
              await this.handleFailedMessage(channel, msg);
            } catch { }
          }
        };

        active = true;

        await channel.consume(this.options.name, consumeFn, { noAck: false });
      } catch (err) {
        console.log('[rabbit] connection failed');
      }
    }
  }

  private async handleFailedMessage(channel: amqp.Channel, msg: amqp.ConsumeMessage) {
    if (!msg.properties?.headers['x-death']) {
      channel.nack(msg, false, false);
      return;
    }

    const failedAttempts = msg.properties.headers['x-death'][0].count

    if (failedAttempts >= this.options.deadLeaterAfter) {
      channel.sendToQueue(this.options.DQLQueue, msg.content);
      channel.ack(msg);
      return
    }

    channel.nack(msg, false, false);
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
      autoDelete: this.options.autoDelete || false,
      arguments: args
    });

    await ch.bindQueue(this.options.nackQueue, exchange, this.options.nackTopic);
  }

  private async configureDLQQueue(ch: amqp.Channel) {
    if (this.options.deadLeaterAfter === -1) {
      return;
    }

    if (this.options.autoDelete) {
      throw new Error("you cannot use DQL with ephemeral queues")
    }

    await ch.assertQueue(this.options.DQLQueue, {
      durable: true,
      autoDelete: false,
      arguments: {}
    });
  }

  private async configureQueue(exchange: string, ch: amqp.Channel) {
    if (this.options.enableNack) {
      this.arguments['x-dead-letter-exchange'] = exchange;
      this.arguments['x-dead-letter-routing-key'] = this.options.nackTopic;
    }

    await ch.assertQueue(this.options.name, {
      durable: this.options.durable,
      autoDelete: this.options.autoDelete || false,
      exclusive: this.options.exclusive || false,
      arguments: this.arguments
    });

    for (const topic of this.options.topics) {
      await ch.bindQueue(this.options.name, exchange, topic);
    }

    if (this.options.enableNack && this.options.retryTimeout) {
      await ch.bindQueue(this.options.name, exchange, this.options.retryTopic);
    }
  }
}
