import { Connection } from '../Connection';
import { IMessage } from './IMessage';
import { IPublishResult } from './IPublishResult';

export interface IFallbackAdapter {
  store(topic: string, data: IMessage<any>): Promise<IPublishResult>;
  setConnection(connection: Connection): void;
}

export interface IFallbackData {
  topic: string;
  message: IMessage<any>;
}
