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
  .durable(true)
  .retryTimeout(60000)
  .listen(async (data) => {
    console.log(data);
    return true;
  });
  
```