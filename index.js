"use strict";

module.exports = {
  // /** @type {import("./src/Gateway")} Gateway object in charge of maintaining the gateway connection and emitting events.*/
  Gateway: require("./src/Gateway"),
  // /** @type {import("./src/RipcordClient")} Ultra lightweight, no frills Discord interface.*/
  RipcordClient: require("./src/RipcordClient"),
  // /** @type {import("./src/ParacordClient")} Configurable, user-friendly Discord interface built on top of Ripcord.*/
  ParacordClient: require("./src/ParacordClient"),
  // /** @type {import("./src/ShardingManager")} Sharding process which spins up designated shards as new node modules with pm2.*/
  ShardingManager: require("./src/ShardingManager"),
  // /** @type {import("./src/util/Util")} Various utility functions.*/
  Util: require("./src/util/Util")
};
