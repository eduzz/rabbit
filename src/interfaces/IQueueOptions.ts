export interface IQueueOptions {
  topic: string;
  name: string;
  durable: boolean;
  nackQueue: string;
  retryTopic: string;
  nackTopic: string;
  enableNack: boolean;
  retryTimeout: number;
}
