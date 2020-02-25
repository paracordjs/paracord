'use strict';

const { Paracord } = require('paracord');

/* Simple bot and log in. */
{
  const token = 'myBotToken'; // https://discordapp.com/developers/applications/
  const bot = new Paracord(token);

  bot.on('PARACORD_STARTUP_COMPLETE', () => {
    console.log('Hello world!');
  });

  bot.login();
}

/* You can provide an object of custom names for events. */
{
  const token = 'myBotToken'; // https://discordapp.com/developers/applications/
  const clientOptions = {
    events: { PARACORD_STARTUP_COMPLETE: 'ready' }, // key (original event name): value (name you want emitted)
  };
  const bot = new Paracord(token, clientOptions);

  bot.on('ready', () => {
    console.log('Hello world!');
  });

  bot.login();
}

/* For internal sharding, provide the shards and shard count as parameters to the login().
   The PARACORD_STARTUP_COMPLETE event will be emitted when all shards have logged in for the first time. */
{
  const token = 'myBotToken'; // https://discordapp.com/developers/applications/
  const bot = new Paracord(token);

  bot.on('PARACORD_STARTUP_COMPLETE', () => {
    console.log('All internal shards have successfully logged in!');
  });

  const shards = [0, 1, 2];
  const shardCount = 3;
  bot.login({ shards, shardCount });
}

/* Emit events during start up by passing `allowEventDuringStartup` to login. */
{
  const token = 'myBotToken'; // https://discordapp.com/developers/applications/
  const bot = new Paracord(token);

  bot.on('GUILD_CREATE', () => {
    console.log('This event may have been sent during startup.');
  });

  bot.login({ allowEventsDuringStartup: true });
}

/* Provide an identity object that will be cloned to each internal shard.
  (`properties` details will be overwritten.) */
{
  const token = 'myBotToken'; // https://discordapp.com/developers/applications/
  const bot = new Paracord(token);

  const identity = {
    presence: {
      game: {
        name: 'a game.',
        type: 0,
      },
      status: 'dnd',
      afk: false,
    },
    large_threshold: 250,
    intents: 32768,
  };

  bot.login({ identity });
}

/* Making a request with the Paracord client is the same as the Api client. */
{
  const token = 'myBotToken'; // https://discordapp.com/developers/applications/
  const bot = new Paracord(token);

  const method = 'GET';
  const endpoint = '/channels/123456789'; // https://discordapp.com/developers/docs/resources/channel

  bot.request(method, endpoint).then((res) => {
    if (res.status === 200) {
      console.log(res.data);
    } else {
      throw Error('Bad response.');
    }
  });
}
