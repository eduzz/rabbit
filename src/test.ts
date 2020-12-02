import { Connection } from './Connection';
import { sleep } from './fn';
import { Memory } from './Fallback/Adapter/Memory';

const connection = new Connection({
  dsn: 'amqp://guest:guest@localhost:5672/',
  exchange: 'test',
  exchangeType: 'topic',
  connectionName: 'test'
});

connection.setFallbackAdapter(new Memory());

connection
  .queue('listener.fallback')
  .topic('listen.topic')
  .durable(true)
  .prefetch(10)
  .retryTimeout(60000)
  .listen(async message => {
    console.log('received:', message);

    await sleep(4000);

    return true;
  });

connection
  .queue('listener.fallback')
  .topic('listen.topic')
  .durable(true)
  .prefetch(10)
  .retryTimeout(60000)
  .listen(async message => {
    console.log('received:', message);

    await sleep(4000);

    return true;
  });

connection.delayQueue('asasdd.asdasdasd').durable().from('ouvindo.xpto').to('depois.do.delay').timeout(5000).create();

(async () => {
  const publisher = connection.topic('listen.topic').persistent();

  while (true) {
    const result = await publisher.send({ data: 'message' });
    console.log(result);
    await sleep(1000);
  }
})();

console.log('started');