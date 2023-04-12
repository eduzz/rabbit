import amqp from 'amqplib';

import { Connection } from './Connection';
import { logger } from './Logger';

export class Queue {
  private topics: string[] = [];

  private options = {
    durable: false,
    retryTimeout: -1,
    deadLetterAfter: -1,
    enableNack: true,
    ephemeral: false,
    exclusive: false,
    prefetch: 1,
    maxPriority: -1,
    names: {
      queueName: '',
      nackQueue: '',
      retryTopic: '',
      nackTopic: '',
      dlqQueue: '',
    },
  };

  constructor(private readonly connection: Connection, private readonly baseQueueName: string) {
    // empty
  }

  public async listen<T = unknown>(callback: (data: T, message?: amqp.ConsumeMessage) => Promise<boolean>) {
    if (this.options.retryTimeout > 0 && this.options.deadLetterAfter <= 0) {
      throw new Error('If you use retryTimeout, you need to specify a deadLetterAfter');
    }

    if (this.topics.length === 0) {
      throw new Error('You must specify an least one topic');
    }

    let channel: amqp.Channel;

    const configureChannel = async (newChannel: amqp.Channel) => {
      channel = newChannel;

      this.genrateQueueNames();

      await this.configureNackQueue(this.connection.getExchange(), channel);
      await this.configureQueue(this.connection.getExchange(), channel);
      await this.configureDLQQueue(channel);

      await channel.prefetch(this.options.prefetch);

      const consumeFn = async (msg: amqp.ConsumeMessage | null) => {
        if (!msg) {
          return;
        }

        try {
          const payload = JSON.parse(msg.content.toString()) as T;

          logger.debug({
            message: 'RECEIVED',
            queue: this.baseQueueName,
            data: payload,
          });

          const result = await callback(payload, msg);

          if (!result) {
            await this.handleFailedMessage(channel, msg);
            return;
          }

          channel.ack(msg);
        } catch (err) {
          try {
            await this.handleFailedMessage(channel, msg);
          } catch {
            logger.error({
              message: 'Failed to handle failed message',
            });
          }
        }
      };

      logger.debug(`Listening to queue ${this.baseQueueName}...`);

      await channel.consume(this.options.names.queueName, consumeFn, { noAck: false });
    };

    this.connection.on('connected', async () => {
      const oldChannel = channel;
      const newChannel = await this.getChannel();

      if (newChannel === channel) {
        return;
      }

      logger.debug(`New channel found for queue ${this.baseQueueName}`);
      await configureChannel(newChannel);

      try {
        oldChannel?.close();
      } catch (err) {
        // nothing;
      }
    });

    configureChannel(await this.getChannel());
  }

  public topic(topic: string) {
    this.topics = [...new Set([...this.topics, topic])];
    return this;
  }

  public durable(durable = true) {
    this.options.durable = durable;
    return this;
  }

  public retryTimeout(timeout: number) {
    if (timeout < 1) {
      throw new Error('Invalid timeout');
    }

    this.options.retryTimeout = timeout;

    return this;
  }

  public deadLetterAfter(numberOfFailures: number) {
    this.options.deadLetterAfter = numberOfFailures;
    return this;
  }

  public disableNack() {
    this.options.enableNack = false;
    return this;
  }

  public ephemeral() {
    this.options.ephemeral = true;
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
    if (max <= 1 || max > 255) {
      throw new Error('invalid priority (must be between 1 and 255)');
    }

    this.options.maxPriority = max;
    return this;
  }

  private getChannel() {
    return this.connection.loadChannel({
      name: `__receiver__pref: ${this.options.prefetch}: ${this.baseQueueName}`,
    });
  }

  private genrateQueueNames() {
    const id = Math.ceil(Math.random() * Number.MAX_SAFE_INTEGER);

    const suffix = this.options.ephemeral ? `.ephemeral.${id}` : '';

    const name = `${this.baseQueueName}${suffix}`;
    const queueName = name;
    const nackQueue = name + '.nack';
    const retryTopic = name + '.retry';
    const nackTopic = name + '.nack';
    const dlqQueue = name + '.dlq';

    this.options.names = {
      queueName,
      nackQueue,
      retryTopic,
      nackTopic,
      dlqQueue,
    };
  }

  private async configureDLQQueue(ch: amqp.Channel) {
    if (this.options.deadLetterAfter < 1) {
      return;
    }

    if (this.options.ephemeral) {
      throw new Error('you cannot use DQL with ephemeral queues');
    }

    await ch.assertQueue(this.options.names.dlqQueue, {
      durable: true,
      autoDelete: false,
      arguments: {},
    });
  }

  private async configureNackQueue(exchange: string, ch: amqp.Channel) {
    if (!this.options.enableNack) {
      return;
    }

    let args: Record<string, any> = {};

    if (this.options.retryTimeout) {
      args = {
        'x-dead-letter-exchange': exchange,
        'x-dead-letter-routing-key': this.options.names.retryTopic,
        'x-message-ttl': this.options.retryTimeout,
      };
    }

    await ch.assertQueue(this.options.names.nackQueue, {
      durable: this.options.durable,
      autoDelete: this.options.ephemeral || false,
      arguments: args,
    });

    await ch.bindQueue(this.options.names.nackQueue, exchange, this.options.names.nackTopic);
  }

  private async configureQueue(exchange: string, ch: amqp.Channel) {
    const args: Record<string, any> = {};

    if (this.options.enableNack) {
      args['x-dead-letter-exchange'] = exchange;
      args['x-dead-letter-routing-key'] = this.options.names.nackTopic;
    }

    await ch.assertQueue(this.options.names.queueName, {
      durable: this.options.durable,
      autoDelete: this.options.ephemeral || false,
      exclusive: this.options.exclusive || false,
      arguments: args,
    });

    for (const topic of this.topics) {
      await ch.bindQueue(this.options.names.queueName, exchange, topic);
    }

    if (this.options.enableNack && this.options.retryTimeout) {
      await ch.bindQueue(this.options.names.queueName, exchange, this.options.names.retryTopic);
    }
  }

  private async handleFailedMessage(channel: amqp.Channel, msg: amqp.ConsumeMessage) {
    if (!msg.properties?.headers['x-death']) {
      channel.nack(msg, false, false);
      return;
    }

    const failedAttempts = msg.properties.headers['x-death'][0].count;

    if (failedAttempts >= this.options.deadLetterAfter) {
      channel.sendToQueue(this.options.names.dlqQueue, msg.content);
      channel.ack(msg);
      return;
    }

    channel.nack(msg, false, false);
  }
}
