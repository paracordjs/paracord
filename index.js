
module.exports = {
  Gateway: require('./src/clients/Gateway/Gateway'),
  Api: require('./src/clients/Api/Api'),
  Paracord: require('./src/clients/Paracord/Paracord'),
  ShardLauncher: require('./src/clients/Paracord/ShardLauncher'),
  Server: require('./src/rpc/server/Server'),
};
