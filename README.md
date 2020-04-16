# Eduzz RabbitMQ Client 

This is an simplified and padronized RabbitMQ Client for NodeJS

### How to use

Create a connection

```ts
import { Connection } from '@eduzz/rabbit';

export const myRabbit = new Connection({
  dsn: 'amqp://...',
  exchange: 'my-exchange'
});
```

Send an message to an topic:

```ts
import { myRabbit } from './myRabbit';

myRabbit
  .topic('some.topic')
  .persistent()
  .send({
    hello: 'world'
  })
```

Listen to an topic:

```ts
import { myRabbit } from './myRabbit';

myRabbit
  .queue('my.queue')
  .topic('some.topic')
  .durable()
  .retryTimeout(60000)
  .listen(async (data) => {
    console.log(data);
    return true;
  });

```

### Full working demo

```ts
import { Connection } from '@eduzz/rabbit';

const connection = new Connection({
  dsn: 'amqp://....',
  exchange: 'theExchange',
  exchangeType: 'topic'
});

(async () => {
  const publisher = connection.topic('my.topic');

  await connection
    .queue('my.queue')
    .topic('my.topic')
    .durable()
    .retryTimeout(15000)
    .listen<string>(async msg => {
      console.log(msg);
      await publisher.send(`${Number(msg) + 1}`);
      return true;
    });

  publisher.send('0');
})();
```