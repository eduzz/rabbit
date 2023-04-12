import { Connection } from './Connection';
import { sleep } from './fn';

(async () => {
  const connection = new Connection({
    dsn: '',
    exchange: 'xpto',
    connectionName: 'yay',
    logLevel: 'debug',
  });

  await connection.connect();

  try {
    await connection
      .queue('blabla')
      .topic('xpto')
      .durable()
      .prefetch(100)
      .retryTimeout(10000)
      .deadLetterAfter(10)
      .listen(async (payload) => {
        console.log('RECEIVED', payload);
        await sleep(1000);

        return true;
      });

    await connection.delayQueue('myNiceDelayQueue').timeout(30000).from('xpto.from').to('xpto').create();

    const publisher = connection.topic('xpto').persistent();

    let id = 0;

    setInterval(async () => {
      await publisher.send({
        payload: { x: ++id },
      });
    }, 1000);
  } catch (err) {
    console.log(err);
  }
})();
