import * as amqp from 'amqplib';

import { DelayQueue } from './DelayQueue';
import { Memory } from './Fallback/Adapter/Memory';
import { sleep } from './fn';
import { IConnectionOptions } from './interfaces/IConnectionOptions';
import { IFallbackAdapter } from './interfaces/IFallbackAdapter';
import { IMessage } from './interfaces/IMessage';
import { Publisher } from './Publisher';
import { Queue } from './Queue';
import fs from 'fs';
import { IPublishResult } from './interfaces/IPublishResult';

type closeFn = () => void;

const version = JSON.parse(fs.readFileSync(__dirname + '/../package.json').toString()).version;

export class Connection {
  private connected = false;
  private channels: amqp.Channel[] = [];
  private connection?: amqp.Connection;
  private options: IConnectionOptions;
  private initialized = false;
  private fallbackAdapter!: IFallbackAdapter;
  private publishers: Publisher[] = [];

  constructor(options: IConnectionOptions) {
    const optionsDefaults = {
      processExitWhenUnableToConnectFirstTime: true,
    };

    this.options = { ...optionsDefaults, ...options };
    this.setFallbackAdapter(new Memory());
  }

  public async createChannel(onClose: closeFn = () => { }): Promise<amqp.Channel> {
    const connection = await this.getConnection();

    const channel = await connection.createChannel();

    channel.assertExchange(this.options.exchange, this.options.exchangeType);

    this.channels.push(channel);

    const removeChannel = () => {
      const index = this.channels.findIndex(c => c === channel);
      this.channels.splice(index, 1);
    };

    channel.on('error', () => {
      removeChannel();
      onClose();
    });

    channel.on('close', () => {
      removeChannel();
      onClose();
    });

    return channel;
  }

  public isConnected() {
    return this.connected;
  }

  public registerShutdownSignal() {
    process.once('SIGINT', () => {
      this.destroy();
    });

    return this;
  }

  public setFallbackAdapter(adapter: IFallbackAdapter) {
    this.fallbackAdapter = adapter;
    this.fallbackAdapter.setConnection(this);
    return this;
  }

  public async storeFallback(publisher: Publisher, message: IMessage<any>): Promise<IPublishResult> {
    await this.fallbackAdapter.store(publisher.getTopic(), message);

    return { status: true, destination: 'buffer', adapter: 'memory' };
  }

  public getPublishersTopics() {
    return this.publishers.map(p => p.getTopic());
  }

  public getPublishersByTopic(topic: string) {
    return this.publishers.filter(p => p.getTopic() === topic);
  }

  public topic(topic: string) {
    const existingPublisher = this.getPublishersByTopic(topic);

    if (existingPublisher.length > 0) {
      return existingPublisher[0];
    }

    const publisher = new Publisher(this, topic);
    this.publishers.push(publisher);
    return publisher;
  }

  public queue(name: string) {
    return new Queue(this, name);
  }

  public delayQueue(name: string) {
    return new DelayQueue(this, name);
  }

  public getExchange() {
    return this.options.exchange;
  }

  public async initialize() {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    let connectionAttempts = 0;
    let totalConnectionAttempts = 0;

    const { dsn, maxConnectionAttempts, connectionName, processExitWhenUnableToConnectFirstTime } = this.options;

    while (true) {
      try {
        if (this.connected) {
          await sleep(1000);
          continue;
        }

        const separator = dsn.includes('?') ? '&' : '?';

        const connection = await amqp.connect(`${dsn}${separator}heartbeat=3`, {
          clientProperties: {
            product: `@eduzz/rabbit\nv${version}\n☕`,
            // eslint-disable-next-line camelcase
            connection_name: connectionName,
            timeout: 2000
          }
        });

        connection.on('error', async err => {
          console.log('[rabbit] connection error!', err);
          this.destroy();
        });

        connection.on('close', async err => {
          console.log('[rabbit] connection closed!', err);
          this.destroy();
        });

        connectionAttempts++;
        console.log(`[rabbit] connected: connectionAttempts= ${connectionAttempts}, totalConnectionAttempts=${totalConnectionAttempts}`);
        totalConnectionAttempts = 0;
        this.connected = true;
        this.connection = connection;

      } catch (err) {
        this.destroy();
        totalConnectionAttempts++;
        console.log(`[rabbit] trying to connect, connectionAttempts=${connectionAttempts}, totalConnectionAttempts=${totalConnectionAttempts}`);

        if (processExitWhenUnableToConnectFirstTime && connectionAttempts === 0) {
          console.log('[rabbit] failed to connect to rabbitmq', err);
          console.log('[rabbit] finishing the process');
          process.exit(1);
        }

        if (maxConnectionAttempts && totalConnectionAttempts > maxConnectionAttempts) {
          console.log(`[rabbit] number of connection attempts exceeded: ${totalConnectionAttempts}`, err);
          throw err;
        }
      }

      await sleep(1000);
    }
  }

  private destroy() {
    if (!this.connection || !this.connected) {
      return;
    }

    this.connected = false;

    const connection = this.connection;
    (this.connection as any) = null;

    try {
      this.channels = [];
      connection.removeAllListeners('error');
      connection.close().catch(() => { });
    } catch { }
  }

  private async getConnection(): Promise<amqp.Connection> {
    this.initialize();

    while (true) {
      if (this.connection) {
        return this.connection;
      }

      await sleep(1000);
    }
  }
}
