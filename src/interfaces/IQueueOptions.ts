export interface IQueueOptions {
  topics: string[];
  name: string;
  durable: boolean;
  nackQueue: string;
  DQLQueue: string;
  retryTopic: string;
  nackTopic: string;
  enableNack: boolean;
  retryTimeout: number;
  autoDelete: boolean;
  exclusive: boolean;
  prefetch: number;
  deadLetterAfter: number;
}
