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
  heartbeat?: number;
  logger?: ILogger;
}

interface IChannelSpec {
  name: string;
}

interface IChannelSpecWithChannl extends IChannelSpec {
  channel: Promise<amqplib.Channel>;
}

process.on('unhandledRejection', (...args) => {
  console.log('[@eduzz/rabbit] unhandledRejection', args);
});

process.on('uncaughtException', (...args) => {
  console.log('[@eduzz/rabbit] uncaughtException', args);
});

let version = 'undefined';

try {
  version = JSON.parse(fs.readFileSync(__dirname + '/../package.json').toString()).version;
} catch (err) {
  // unknown environment
}

export class Connection extends EventEmitter {
  private connection: Promise<amqplib.ChannelModel> | undefined;
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
            logger.error({
              message: `Channel ${spec.name} errored`,
              error: err,
            });
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
    let dsn: URL;

    try {
      dsn = new URL(`${this.options.dsn}`.trim());
      dsn.searchParams.set('heartbeat', String(this.options.heartbeat ?? 30));
    } catch (err) {
      throw new Error('Invalid rabbitMQ DSN');
    }

    if (!dsn.protocol.match(/^amqps?:/)) {
      throw new Error('Invalid rabbitMQ DSN Protocol, expected amqp:// or amqps://');
    }

    const connectionGenerator = () =>
      new Promise<amqplib.ChannelModel>(async (resolve, reject) => {
        let failed = false;

        const localFailed = {
          localFailed: true,
        };

        const timeout = setTimeout(() => {
          logger.error('Connection failed by timeout');
          failed = true;
          reject(localFailed);
        }, 5000);

        try {
          const amqp = await amqplib.connect(dsn.toString(), {
            timeout: 7000,
            clientProperties: {
              product: `@eduzz/rabbit\nv${version}\n☕`,
              connection_name: this.options.connectionName,
              timeout: 7000,
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
        } catch (err: any) {
          if (err.code === 'EAI_AGAIN') {
            logger.error('Connection failed by, no internet connection');
            return reject(localFailed);
          }

          reject(err);
        } finally {
          clearTimeout(timeout);
        }
      });

    while (true) {
      try {
        return await connectionGenerator();
      } catch (err: any) {
        if (!err.localFailed) {
          throw err;
        }

        await sleep(1000);
      }
    }
  }
}
