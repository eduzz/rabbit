import { Connection } from './Connection';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const connection = new Connection({
  dsn: 'amqp://guest:guest@rabbitmq/test',
  exchange: 'test',
  connectionName: 'test',
});

let count = 0;
connection
  .queue('events')
  .topic('event.sent')
  .durable(true)
  .prefetch(100)
  .retryTimeout(1)
  .deadLetterAfter(5000)
  .listen(async (message) => {
    count++;
    console.log('count:', count);
    throw new Error('error');
  });

(async () => {
  const publisher = connection.topic('event.sent').persistent();
  console.log('sending message');
  await sleep(3000);
  await publisher.send({ payload: 'message' });
})();

console.log('started');
