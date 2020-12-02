import { Connection } from './Connection';
import { DefaultChannel } from './DefaultChannel';
import { IPublishOptions, DeliveryMode } from './interfaces/IPublishOptions';
import { IMessage } from './interfaces/IMessage';
import { IPublishResult } from './interfaces/IPublishResult';
import { NoExtraProperties } from './types';

export class Publisher extends DefaultChannel {
  private topic: string;

  private options: IPublishOptions = {
    deliveryMode: DeliveryMode.Peristent
  };

  constructor(connection: Connection, topic: string) {
    super();
    this.connection = connection;
    this.topic = topic;
  }

  public persistent(persist: boolean = true) {
    this.options.deliveryMode = persist ? DeliveryMode.Peristent : DeliveryMode.NonPersistent;
    return this;
  }

  public getConnection() {
    return this.connection;
  }

  public getTopic() {
    return this.topic;
  }

  public async send<T = any>(data: NoExtraProperties<IMessage<T>>): Promise<IPublishResult> {
    this.connection.initialize();

    if (!this.connection.isConnected()) {
      return this.connection.storeFallback(this, data);
    }

    const channel = await this.getChannel();

    const msg = Buffer.from(JSON.stringify(data.payload));

    const options = {
      ...this.options,
      persistent: this.options.deliveryMode === DeliveryMode.Peristent
    };

    try {
      const result = channel.publish(this.connection.getExchange(), this.topic, msg, {
        ...options,
        priority: data.priority
      });

      if (result) {
        return { status: true, destination: 'rabbit' };
      }
    } catch (err) {}

    return this.connection.storeFallback(this, data);
  }
}
