"use strict";
const pm2 = require("pm2");

module.exports = class ShardManager {
  // { location, shardIds, shardCount, appName, token, redisIdentityKey }
  constructor(options) {
    this.main;
    this.shardIds;
    this.shardCount;
    this.token;
    this.env;
    this.launchCount = 0;
    // this.location = location;
    // this.shardIds = shardIds;
    // this.shardCount = shardCount;
    this.appName =
      options.appName !== undefined ? options.appName : "Discord Bot";
    // this.token = token;

    this.detach = detach.bind(this);
    Object.assign(this, options);
  }

  launch(pm2Options = {}) {
    const env = {
      RIPCORD_MANAGED: true,
      TOKEN: this.token,
      REDISIDENTITYKEY: this.redisIdentityKey || this.appName,
      SHARDCOUNT: this.shardCount
    };

    try {
      pm2.connect(err => {
        if (err) {
          console.error(err);
          process.exit(2);
        }

        for (const shardId of this.shardIds)
          pm2.start(
            {
              name: `${this.appName} - Shard ${shardId}`,
              script: this.location,
              env: {
                ...this.env,
                ...env,
                SHARDID: shardId
              },
              ...pm2Options
            },
            this.detach
          );
      });
    } catch (err) {
      console.error(err);
    }
  }
};

function detach(err) {
  if (++this.launchCount === this.shardIds.length) {
    console.log("Disconnecting pm2 API");
    pm2.disconnect();
  }
  if (err) throw err;
}
