import fs from 'fs';
import { EventEmitter } from 'stream';

import amqplib from 'amqplib';

import { DelayQueue } from './DelayQueue';
import { sleep } from './fn';
import { ILogger, LogLevel, logger } from './Logger';
import { Publisher } from './Publisher';
import { Queue } from './Queue';

interface IConnectionOptions {
  dsn: string;
  exchange: string;
  connectionName: string;
  logLevel?: LogLevel;
  logger?: ILogger;
}

interface IChannelSpec {
  name: string;
}

interface IChannelSpecWithChannl extends IChannelSpec {
  channel: Promise<amqplib.Channel>;
}

process.on('unhandledRejection', () => {
  // just to exist
});

process.on('uncaughtException', () => {
  // just to exist
});

const version = JSON.parse(fs.readFileSync(__dirname + '/../package.json').toString()).version;

export class Connection extends EventEmitter {
  private connection: Promise<amqplib.Connection> | undefined;
  private channels = new Map<string, IChannelSpecWithChannl>();
  private blocked = false;

  constructor(private readonly options: IConnectionOptions) {
    super();
    logger.initDefaultLogger(options.logLevel || 'none', options.logger);
  }

  public async loadChannel(spec: IChannelSpec) {
    const currentChannel = this.channels.get(spec.name);

    if (currentChannel) {
      return currentChannel.channel;
    }

    const channelData = {
      ...spec,
      channel: (async () => {
        const connection = await this.getConnection();
        const channel = await connection.createChannel();

        channel.on('close', async () => {
          logger.debug(`Channel ${spec.name} closed`);
          this.channels.delete(spec.name);
        });

        channel.on('error', async (err) => {
          try {
            logger.debug(`Channel ${spec.name} errored`);
            channel.close();
          } finally {
            this.channels.delete(spec.name);
          }
        });

        channel.on('drain', () => {
          logger.debug(`Channel ${spec.name} drained`);
        });

        await channel.assertExchange(this.options.exchange, 'topic', {
          durable: true,
        });

        logger.debug(`Channel ${spec.name} created`);
        return channel;
      })(),
    };

    this.channels.set(spec.name, channelData);

    return channelData.channel;
  }

  public getExchange() {
    return this.options.exchange;
  }

  public topic(topicName: string) {
    return new Publisher(this, topicName);
  }

  public queue(name: string) {
    return new Queue(this, name);
  }

  public delayQueue(name: string) {
    return new DelayQueue(this, name);
  }

  public isBlocked() {
    return this.blocked;
  }

  public async connect() {
    await this.getConnection();
  }

  private async getConnection() {
    if (!this.connection) {
      logger.info('Connecting');
      this.connection = this.doConnection();
    }

    return await this.connection;
  }

  private async doConnection() {
    const connectionGenerator = () =>
      new Promise<amqplib.Connection>(async (resolve, reject) => {
        let failed = false;

        setTimeout(() => {
          logger.debug('Connection failed by timeout');
          failed = true;
          reject();
        }, 5000);

        const amqp = await amqplib.connect(`${this.options.dsn}?heartbeat=1`, {
          timeout: 1000,
          clientProperties: {
            product: `@eduzz/rabbit\nv${version}\n☕`,
            connection_name: this.options.connectionName,
            timeout: 1000,
          },
        });

        if (failed) {
          logger.debug('Connection failed');
          amqp.removeAllListeners();
          await amqp.close();
          reject();
        }

        amqp.on('blocked', () => {
          this.blocked = true;
          logger.debug('Connection is blocked');
        });

        amqp.on('unblocked', () => {
          this.blocked = false;
          logger.debug('Connection is released');
        });

        amqp.on('error', async () => {
          logger.error('Connection error');
        });

        amqp.on('close', async () => {
          logger.info('Connection closed');

          this.channels.clear();

          try {
            await amqp.close();
          } finally {
            this.connection = undefined;
          }
        });

        this.emit('connected', amqp);

        logger.info('Connected');

        resolve(amqp);
      });

    while (true) {
      try {
        return await connectionGenerator();
      } catch (err) {
        await sleep(1000);
      }
    }
  }
}
