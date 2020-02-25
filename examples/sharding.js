'use strict';

const { ShardLauncher } = require('../index');

const main = './path/to/bot/entry/file';

const shardsToSpawn = [0, 1];
const totalShards = 2;

const launcher = new ShardLauncher(main, {
  shardIds: shardsToSpawn,
  shardCount: totalShards,
});

launcher.launch();

/*
    From here, pm2 will spawn each shard in shardIds into its own process in pm2.
    You can view a list of these by running `pm2 l` on the cli.
*/
