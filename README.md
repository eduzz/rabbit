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

const payload = {
  hello: 'world'
};

myRabbit.topic('some.topic').persistent().send({ payload });
```

Listen to one or multiple topics:

```ts
import { myRabbit } from './myRabbit';

myRabbit
  .queue('my.queue')
  .topic('some.topic')
  .topic('another.topic')
  .durable()
  .retryTimeout(60000)
  .listen(async data => {
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
  exchangeType: 'topic',
  connectionName: 'my app'
});

// Listening some topic
await connection
  .queue('my.queue')
  .topic('my.topic')
  .durable()
  .retryTimeout(60000)
  .listen<string>(async msg => {
    console.log(msg);
    return true;
  });

// Publishing message
(async () => {
  const publisher = connection.topic('my.topic').persistent();

  setInterval(async () => {
    const payload = {
      number: Math.random() * 1000
    };

    publisher.send({
      payload
    });
  }, 1000);
})();

// Delaying Messages
connection.delayQueue('my.delay.queue').durable().from('from.topic').to('to.topic').timeout(5000).create();
```
