"use strict";
const pm2 = require("pm2");
const Api = require("../Api/");

/** A script that spawns shards into pm2, injecting shard information into the Paracord client. */
module.exports = class ShardLauncher {
  /**
   * Creates a new shard launcher.
   *
   * @param {string} main Relative location of the app's entry file.
   * @param {ShardLauncherOptions} options Optional parameters for this handler.
   */
  constructor(main, options) {
    this.validateParams(main, options);

    /** @type {string} Relative location of the app's entry point. */
    this.main = main;
    /** @type {[number]} IDs of the shards to launch. */
    this.shardIds;
    /** @type Total number of shards this app will be running across all instances. */
    this.shardCount;

    /** @type {Object<string, any>} Additional environment variables to load into the app. */
    this.env;
    /** @type {string} Name that will appear beside the shard number in pm2. */
    this.appName =
      options.appName !== undefined ? options.appName : "Discord Bot";

    /** @type {string} Discord token. Used to find recommended shard count. Will be coerced into a bot token. */
    this.token;
    /** @type {number} Count of shards that have been launched. */
    this.launchedCount = 0;

    Object.assign(this, options);

    this.bindCallbackFunctions();
  }

  /**
   * Binds `this` to functions used in callbacks.
   * @private
   */
  bindCallbackFunctions() {
    this.detach = this.detach.bind(this);
  }

  /**
   * Throws errors and warns if the parameters passed to the constructor aren't sufficient.
   * @private
   */
  validateParams(main, options) {
    const { token, shardIds, shardCount } = options;

    if (main === undefined) {
      throw Error(
        "Main must be defined. Please provide the path to your app's entry file."
      );
    }
    if (token === undefined && shardIds === undefined) {
      throw Error("Must provide either a token or shardIds in the options.");
    }
    if (shardCount <= 0) {
      throw Error("Shard count may not be 0 or smaller.");
    }
    if (shardIds && shardCount && shardCount < shardIds.length) {
      throw Error("Shard count may not be less than the number of shard IDs.");
    }
    if (shardCount && shardIds === undefined) {
      throw Error("Shard IDs must be given with shard count.");
    }
  }

  /**
   * Launches shards.
   *
   * @param {import("pm2").StartOptions} pm2Options
   */
  async launch(pm2Options = {}) {
    if (this.shardCount === undefined) {
      await this.getShardInfo();
    }

    const env = {
      PARACORD_TOKEN: this.token,
      PARACORD_SHARDCOUNT: this.shardCount || this.shardIds.length
    };

    try {
      pm2.connect(err => {
        if (err) {
          console.error(err);
          process.exit(2);
        }

        for (const shardId of this.shardIds) {
          pm2.start(
            {
              name: `${this.appName} - Shard ${shardId}`,
              script: this.main,
              env: {
                ...this.env,
                ...(env || {}),
                PARACORD_SHARDID: shardId
              },
              ...pm2Options
            },
            this.detach
          );
        }
      });
    } catch (err) {
      console.error(err);
    }
  }

  /**
   * Fills missing shard information.
   * @private
   */
  async getShardInfo() {
    console.log("Retrieving shard information from API.");
    const shardCount = await this.getRecommendedShards();

    console.log(
      `Using Discord recommended shard count: ${shardCount} shard${
        shardCount > 0 ? "s" : ""
      }`
    );
    if (this.shardIds === undefined) {
      this.shardIds = [];
      for (let i = 0; i < shardCount; ++i) {
        this.shardIds.push(i);
      }
    }
  }

  /** Gets the recommended shard count from Discord. */
  async getRecommendedShards() {
    const api = new Api(this.token);
    const { status, statusText, data } = await api.request(
      "get",
      "gateway/bot"
    );

    if (status === 200) {
      return data.shards;
    } else {
      throw Error(
        `Failed to get shard information from API. Status ${status}. Status text: ${statusText}. Discord code: ${data.code}. Discord message: ${data.message}.`
      );
    }
  }

  /**
   * Disconnects from pm2 when all shards have been launched.
   * @private
   */
  detach(err) {
    if (++this.launchedCount === this.shardIds.length) {
      console.log("All shards launched. Disconnecting from pm2.");
      pm2.disconnect();
    }
    if (err) throw err;
  }
};
