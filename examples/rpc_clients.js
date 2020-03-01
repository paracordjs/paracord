'use strict';

/*
 ************************
 *********GATEWAY********
 ************************
 */
{
  const { Gateway } = require('paracord');

  const token = 'myBotToken'; // https://discordapp.com/developers/applications/
  const gateway = new Gateway(token);
  /*
    Connect to a server and set the main lock duration to 5000 milliseconds (5 seconds).
    When acquiring the lock, it will remaining locked for the duration.
    The main lock will not be unlocked by this client or Paracord.
    `allowFallback` will ignore the lock if the client cannot reach the server. defaults to `true`.
  */
  gateway.addIdentifyLockServices({ duration: 5000, allowFallback: true });
  gateway.login();
}

{
  const { Gateway } = require('paracord');

  const token = 'myBotToken'; // https://discordapp.com/developers/applications/
  const gateway = new Gateway(token);
  /*
    Additional locks can be passed and will be acquired in succession when identifying.
    The main lock will be acquired last since it will not be unlocked by Paracord.
  */
  gateway.addIdentifyLockServices(
    {
      // acquired third
      duration: 5000, // using default host:port (127.0.0.1:50051)
    },
    {
      // acquired first
      host: '127.0.0.1', port: 50052, duration: 10000,
    },
    {
      // acquired second
      host: '127.0.0.1', port: 50053, duration: 20000,
    },
  );
  gateway.login();
}

{
  const { Gateway } = require('paracord');

  const token = 'myBotToken'; // https://discordapp.com/developers/applications/
  const gateway = new Gateway(token);
  /*
    Pass in `null` as the first parameter to not set the main lock.
  */
  gateway.addIdentifyLockServices(
    null,
    {
      // only lock
      host: '127.0.0.1', port: 50052, duration: 10000,
    },

  );
  gateway.login();
}

/*
  Provide a host/port to point to services to point to a different server than default.
  gateway.addIdentifyLockService({
      duration: 5000,
      host: '127.0.0.1', // default host
      port: 50051 // default port
  });
*/

/*
  For the addIdentifyLockService, provide additional locks as parameters. They will be acquired in order defined.
  gateway.addIdentifyLockService(
    {
      duration: 5000,
      host: '127.0.0.1',
      port: 50051,
    },
    {
      duration: 10000,
      host: '127.0.0.1',
      port: 50052,
    },
  );
  */

/*
 ************************
 **********API***********
 ************************
 */
{
  const { Api } = require('paracord');

  const token = 'myBotToken'; // https://discordapp.com/developers/applications/
  const api = new Api(token);

  /*  `allowFallback` defaults to `true`. */
  api.addRateLimitService({ allowFallback: true }); // Only one of these services may be added to a client.
  // api.addRequestService();

  api.request('GET', '/channels/123456789').then((res) => {
    if (res.status === 200) {
      console.log(res.data);
    } else {
      throw Error('Bad response.');
    }
  });
}

/*
 ************************
 ********PARACORD********
 ************************
 */
{
  const { Paracord } = require('paracord');

  const token = 'myBotToken'; // https://discordapp.com/developers/applications/
  const bot = new Paracord(token);

  bot.on('PARACORD_STARTUP_COMPLETE', () => {
    console.log('Hello world!');
  });
  /* Same as the Gateway and Api examples above. */
  bot.addRateLimitService({ allowFallback: true });
  // bot.addRequestService();
  bot.addIdentifyLockService({ duration: 5000, allowFallback: true });

  bot.login();
}
