"use strict";

/*
    All Discord events can be found in the docs. They will be in all caps and spaces will be replaced with underlines.
    https://discordapp.com/developers/docs/topics/gateway#commands-and-events-gateway-events
*/

/* No emitter in options. */
{
  const { Gateway } = require("paracord");

  const token = "myBotToken"; // https://discordapp.com/developers/applications/

  const gateway = new Gateway(token);

  async function main() {
    /* If you do not provide an emitter through the GatewayOptions, one will be created and returned by `login()`. */
    const emitter = await gateway.login();
    
    emitter.on("READY", data => {
      console.log("Ready packet received.");
      console.log(data);
    });
    emitter.on("GUILD_CREATE", data => {
      console.log("Guild create packet received.");
      console.log(data);
    });
  }

  main();
}

/* Emitter in options. */
{
  const { EventEmitter } = require("events");
  const { Gateway } = require("paracord");

  const emitter = new EventEmitter();
  emitter.on("READY", data => {
    console.log("Ready packet received.");
    console.log(data);
  });
  emitter.on("GUILD_CREATE", data => {
    console.log("Guild create packet received.");
    console.log(data);
  });

  const token = "myBotToken"; // https://discordapp.com/developers/applications/
  const options = { emitter };
  const gateway = new Gateway(token, options);

  /* If you do not provide an emitter through the GatewayOptions, one will be created and returned by `login()`. */
  gateway.login();
}
