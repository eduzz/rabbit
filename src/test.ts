import { Connection } from './Connection';
import { sleep } from './fn';
import { Memory } from './Fallback/Adapter/Memory';

const connection = new Connection({
  dsn: 'amqps://mcatyrps:Gb9K8cuKGV4PXw4rNJqkNSJIlT3sEe7E@woodpecker.rmq.cloudamqp.com/mcatyrps',
  exchange: 'test',
  exchangeType: 'topic',
  connectionName: 'test',
  maxConnectionAttempts: 10,
  processExitWhenUnableToConnectFirstTime: false,
});

connection.setFallbackAdapter(new Memory());

connection
  .queue('events')
  .topic('event.sent')
  .durable(true)
  .prefetch(1)
  .retryTimeout(20000)
  .deadLetterAfter(5)
  .listen(async message => {
    console.log('received:', message);
    return false;
  });

(async () => {
  const publisher = connection.topic('event.sent').persistent();

  while (true) {
    console.log('sending message');
    await publisher.send({ payload: 'message' });
    await sleep(5000);
  }
})();

console.log('started');
