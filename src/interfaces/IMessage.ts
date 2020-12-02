export interface IMessage<T> {
  data: T;
  priority?: number;
}
