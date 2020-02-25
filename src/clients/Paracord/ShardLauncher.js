/* eslint-disable no-console */

'use strict';

const pm2 = require('pm2');
const Api = require('../Api/');

/** @typedef {number[]} InternalShardIds Shard Ids designated to be spawned internally. */

/** A script that spawns shards into pm2, injecting shard information into the Paracord client. */
module.exports = class ShardLauncher {
  /**
   * Creates a new shard launcher.
   *
   * @param {string} main Relative location of the app's entry file.
   * @param {ShardLauncherOptions} options Optional parameters for this handler.
   */
  constructor(main, options) {
    ShardLauncher.validateParams(main, options);

    /** @type {string} Relative location of the app's entry point. */
    this.main = main;
    /** @type {InternalShardIds} Ids of the shards to start internally. Ignored if `shardChunks` is defined. */
    this.shardIds;
    /** @type {InternalShardIds[]} Arrays of shard Ids to launch. Each item will spawn a pm2 process with the designated shards internally. */
    this.shardChunks;
    /** @type {number} Total number of shards this app will be running across all instances. */
    this.shardCount;

    /** @type {Object<string, any>} Additional environment variables to load into the app. */
    this.env;
    /** @type {string} Name that will appear beside the shard number in pm2. */
    this.appName = options.appName !== undefined ? options.appName : 'Discord Bot';

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
  static validateParams(main, options) {
    const { token, shardIds, shardCount } = options;

    if (main === undefined) {
      throw Error(
        "Main must be defined. Please provide the path to your app's entry file.",
      );
    }
    if (token === undefined && shardIds === undefined) {
      throw Error('Must provide either a token or shardIds in the options.');
    }
    if (shardCount <= 0) {
      throw Error('Shard count may not be 0 or smaller.');
    }
    // if (shardIds && shardCount && shardCount < shardIds.length) {
    //   throw Error('Shard count may not be less than the number of shard IDs.');
    // }
    if (shardCount && shardIds === undefined) {
      throw Error('Shard Ids must be given with shard count.');
    }
    if (shardIds !== undefined) {
      console.warning('shardIds defined without shardCount. Ignoring shardIds.');
    }
  }

  /**
   * Launches shards.
   *
   * @param {import("pm2").StartOptions} pm2Options
   */
  async launch(pm2Options = {}) {
    let { shardCount, shardIds, shardChunks } = this;

    if (shardChunks === undefined && shardCount === undefined) {
      ({ shardCount, shardIds } = await this.getShardInfo());
    }

    try {
      pm2.connect((err) => {
        if (err) {
          console.error(err);
          process.exit(2);
        }

        if (shardChunks !== undefined) {
          shardChunks.forEach((s) => {
            this.launchShard(s, shardCount, pm2Options);
          });
        } else {
          this.launchShard(shardIds, shardCount, pm2Options);
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
    console.log('Retrieving shard information from API.');
    const shardCount = await this.getRecommendedShards();

    console.log(
      `Using Discord recommended shard count: ${shardCount} shard${
        shardCount > 0 ? 's' : ''
      }`,
    );

    const shardIds = [];
    for (let i = 0; i < shardCount; ++i) {
      shardIds.push(i);
    }

    return { shardCount, shardIds };
  }

  launchShard(shardIds, shardCount, pm2Options) {
    const shardIdsCsv = shardIds.join(',');
    const paracordEnv = {
      PARACORD_TOKEN: this.token,
      PARACORD_SHARDCOUNT: shardCount,
      PARACORD_SHARDIDS: shardIdsCsv,
    };

    const pm2Config = {
      name: `${this.appName} - Shards ${shardIdsCsv}`,
      script: this.main,
      env: {
        ...(this.env || {}),
        ...paracordEnv,
      },
      ...pm2Options,
    };

    pm2.start(pm2Config, this.detach);
  }

  /** Gets the recommended shard count from Discord. */
  async getRecommendedShards() {
    const api = new Api(this.token);
    const { status, statusText, data } = await api.request(
      'get',
      'gateway/bot',
    );

    if (status === 200) {
      return data.shards;
    }
    throw Error(
      `Failed to get shard information from API. Status ${status}. Status text: ${statusText}. Discord code: ${data.code}. Discord message: ${data.message}.`,
    );
  }

  /**
   * Disconnects from pm2 when all shards have been launched.
   * @private
   */
  detach(err) {
    if (++this.launchedCount === this.shardIds.length) {
      console.log('All shards launched. Disconnecting from pm2.');
      pm2.disconnect();
    }
    if (err) throw err;
  }
};
