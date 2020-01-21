"use strict";
module.exports = class Identity {
  constructor(token, shard) {
    this.token = token;
    this.shard = shard;
    this.properties = {
      os: process.platform,
      browser: "Ripcord",
      device: "Ripcord"
    };
    this.presence = {
      status: "online",
      afk: false
    };
  }
};
