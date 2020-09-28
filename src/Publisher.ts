import { Connection } from './Connection';
import { IPublishOptions, DeliveryMode } from './interfaces/IPublishOptions';

export class Publisher {
  private connection: Connection;
  private topic: string;

  private options: IPublishOptions = {
    deliveryMode: DeliveryMode.Peristent
  };

  constructor(connection: Connection, topic: string) {
    this.connection = connection;
    this.topic = topic;
  }

  public persistent(persist: boolean = true) {
    this.options.deliveryMode = persist ? DeliveryMode.Peristent : DeliveryMode.NonPersistent;
    return this;
  }

  public async send<T = any>(message: T, priority?: number) {
    const channel = await this.connection.getChannel();

    const msg = Buffer.from(JSON.stringify(message));

    const options = {
      ...this.options,
      persistent: this.options.deliveryMode === DeliveryMode.Peristent
    };

    return channel.publish(this.connection.getExchange(), this.topic, msg, { ...options, priority });
  }
}
