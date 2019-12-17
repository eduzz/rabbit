export enum DeliveryMode {
  NonPersistent = 1,
  Peristent = 2
}

export interface IPublishOptions {
  expiration?: string | number;
  persistent?: boolean;
  deliveryMode?: DeliveryMode;
  headers?: any;
  replyTo?: string;
  messageId?: string;
}
