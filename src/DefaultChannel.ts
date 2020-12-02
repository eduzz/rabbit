import * as amqp from 'amqplib';
import { Connection } from './Connection';

export abstract class DefaultChannel {
  private static channel: Promise<amqp.Channel>;
  protected connection!: Connection;

  protected getChannel() {
    if (DefaultChannel.channel) {
      return DefaultChannel.channel;
    }

    DefaultChannel.channel = this.connection.createChannel(() => {
      (DefaultChannel.channel as any) = null;
    });

    return DefaultChannel.channel;
  }
}
