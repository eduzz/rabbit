export interface IDelayQueueOptions {
  name: string;
  fromTopic: string;
  toTopic: string;
  durable: boolean;
  timeout: number | undefined;
}
