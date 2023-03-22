export interface IMessage<T> {
  payload: T;
  priority?: number;
  expiration?: number;
}
