import * as amqp from 'amqplib';
import { Connection } from './Connection';

export abstract class DefaultChannel {
  private channel: Promise<amqp.Channel>|null = null;
  protected connection!: Connection;

  protected getChannel() {
    if (this.channel) {
      return this.channel;
    }

    this.channel = this.connection.createChannel(() => {
      (this.channel as any) = null;
    });

    return this.channel;
  }
}
