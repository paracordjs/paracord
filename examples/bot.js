"use strict";
const { Paracord } = require("paracord");

/* Simple bot and log in. */
{
  const token = "myBotToken"; // https://discordapp.com/developers/applications/
  const bot = new Paracord(token);

  bot.on("PARACORD_STARTUP_COMPLETE", () => {
    console.log("Hello world!");
  });

  bot.login();
}

/* You can provide an object of custom names for events. */
{
  const token = "myBotToken"; // https://discordapp.com/developers/applications/
  const clientOptions = {
    events: { PARACORD_START_UP: "startupComplete" } // key (original event name): value (name you want emitted)
  };
  const bot = new Paracord(token, clientOptions);

  bot.on("startupComplete", () => {
    console.log("Hello world!");
  });

  bot.login();
}

/* Making a request with the Paracord client is the same as the Api client. */
{
  const token = "myBotToken"; // https://discordapp.com/developers/applications/
  const bot = new Paracord(token);

  const method = "GET";
  const endpoint = "/channels/123456789"; // https://discordapp.com/developers/docs/resources/channel

  bot.request(method, endpoint).then(res => {
    if (res.status === 200) {
      console.log(res.data);
    } else {
      throw Error("Bad response.");
    }
  });
}
