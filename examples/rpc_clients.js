"use strict";

/*
 ************************
 *********GATEWAY********
 ************************
 */
{
  const { Gateway } = require("paracord");

  const token = "myBotToken"; // https://discordapp.com/developers/applications/
  const gateway = new Gateway(token);
  /* Connect to a server and set the lock to 5000 milliseconds (5 seconds). */
  gateway.addIdentifyLockService({ duration: 5000, allowFallback: true });
  /* 
    Provide a host/port to point to services to point to a different server than default.
    gateway.addIdentifyLockService({
        duration: 5000,
        host: 127.0.0.1,
        port: 55051
    });
  */
  /*
    For the addIdentifyLockService, provide two host/ports to set up two locks.
    gateway.addIdentifyLockService({
        duration: 5000,
        host: 127.0.0.1,
        port: 55051
    },{
        duration: 10000,
        host: 127.0.0.1,
        port: 55052
    });
   */

  gateway.login();
}

/*
 ************************
 **********API***********
 ************************
 */
{
  const { Api } = require("paracord");

  const token = "myBotToken"; // https://discordapp.com/developers/applications/
  const api = new Api(token);

  api.addRateLimitService({ allowFallback: true }); // Only one of these services may be added to a client.
  // api.addRequestService();

  api.request("GET", "/channels/123456789").then(res => {
    if (res.status === 200) {
      console.log(res.data);
    } else {
      throw Error("Bad response.");
    }
  });
}

/*
 ************************
 ********PARACORD********
 ************************
 */
{
  const { Paracord } = require("paracord");

  const token = "myBotToken"; // https://discordapp.com/developers/applications/
  const bot = new Paracord(token);

  bot.on("PARACORD_STARTUP_COMPLETE", () => {
    console.log("Hello world!");
  });
  /* Same as the Gateway and Api examples above. */
  bot.addRateLimitService({ allowFallback: true });
  // bot.addRequestService();
  bot.addIdentifyLockService({ duration: 5000, allowFallback: true });

  bot.login();
}
