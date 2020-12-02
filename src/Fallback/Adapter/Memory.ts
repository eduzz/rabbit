import { IFallbackAdapter, IFallbackData } from '../../interfaces/IFallbackAdapter';
import { IMessage } from '../../interfaces/IMessage';
import { Connection } from '../../Connection';
import { IPublishResult } from '../../interfaces/IPublishResult';

export class Memory implements IFallbackAdapter {
  private buffer: IFallbackData[] = [];
  private interval!: NodeJS.Timeout;

  constructor(private maxItems = Number.MAX_SAFE_INTEGER) {}

  public async store(topic: string, message: IMessage<any>): Promise<IPublishResult> {
    this.buffer.push({
      topic,
      message
    });
    return { status: true, destination: 'buffer', adapter: 'memory' };
  }

  public setConnection(connection: Connection) {
    clearInterval(this.interval);

    let working = false;

    this.interval = setInterval(async () => {
      const length = this.buffer.length;

      if (!connection.isConnected() || length === 0 || working) {
        return;
      }

      working = true;

      while (this.buffer.length > 0) {
        const data = this.buffer.splice(0, 1)[0];

        const publishers = connection.getPublishersByTopic(data.topic);

        if (publishers.length === 0) {
          console.log('[rabbit/memory] no publisher found for topic: ', data.topic, 'discarding message');
          continue;
        }

        for (let publisher of publishers) {
          await publisher.send(data.message);
        }
      }

      console.log('[rabbit/memory] buffer sent: ', length);

      working = false;
    }, 1000);
  }
}
