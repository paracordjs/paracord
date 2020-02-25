'use strict';

/* Spawn shards internally on a single process. */
{
  const { ShardLauncher } = require('../index');

  const main = './path/to/bot/entry/file';

  const shardsToSpawn = [0, 1];
  const totalShards = 2;

  const launcher = new ShardLauncher(main, {
    shardIds: shardsToSpawn,
    shardCount: totalShards,
  });

  launcher.launch();
}

/* Spawn shards internally in separate "chunks", each chunk receiving its own pm2 process. */
{
  const { ShardLauncher } = require('../index');

  const main = './path/to/bot/entry/file';

  const shardsToSpawn = [[0, 1], [2, 3], [4, 5]];
  const totalShards = 6;

  const launcher = new ShardLauncher(main, {
    shardChunks: shardsToSpawn,
    shardCount: totalShards,
  });

  launcher.launch();
}

/*
    From here, pm2 will spawn each shard in shardIds into its own process in pm2.
    You can view a list of these by running `pm2 l` on the cli.
*/
