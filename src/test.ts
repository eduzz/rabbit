import { Connection } from './Connection';
import { sleep } from './fn';

const connection = new Connection({
  dsn: 'amqp://guest:guest@localhost:5672/',
  exchange: 'test',
  exchangeType: 'topic',
  connectionName: 'test'
});

connection
  .queue('listener.fallback')
  .topic('listen.topic')
  .durable(true)
  .prefetch(1)
  .retryTimeout(60000)
  .listen(async message => {
    console.log('received:', message);

    await sleep(4000);

    return true;
  });

const publisher = connection.topic('listen.topic').persistent();

(async () => {
  while (true) {
    const result = await publisher.send({ data: 'message' });
    console.log(result);
    await sleep(1000);
  }
})();

console.log('started');
