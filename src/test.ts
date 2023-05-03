import { Connection } from './Connection';
import { sleep } from './fn';

(async () => {
  const connection = new Connection({
    dsn: 'amqps://doehrbmi:1sfqvtXmdi8MCz0xOJ80r-6utLBjfj24@moose.rmq.cloudamqp.com/doehrbmi',
    exchange: 'xpto',
    connectionName: 'yay',
    logLevel: 'debug',
  });

  try {
    await connection.connect();

    await connection
      .queue('adasdasdqewwq')
      .topic('xpto')
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
