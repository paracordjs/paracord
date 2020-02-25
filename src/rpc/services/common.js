/* eslint-disable no-sync */

'use strict';

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

/**
 * Load in a protobuf from a file.
 *
 * @param {string} proto Name of the proto file.
 */
exports.loadProto = function (proto) {
  const protopath = __filename.replace(
    'services/common.js',
    `protobufs/${proto}.proto`,
  );

  return protoLoader.loadSync(protopath, {
    keepCase: true,
  });
};

/**
 * Create the proto definition from a loaded into protobuf.
 *
 * @param {string} proto Name of the proto file.
 */
exports.loadProtoDefinition = function (proto) {
  return grpc.loadPackageDefinition(exports.loadProto(proto));
};

/**
 * Create the parameters passed to a service definition constructor.
 *
 * @param {ServiceOptions} options
 */
exports.constructorDefaults = function (options) {
  const host = options.host || '127.0.0.1';
  const port = options.port || '50051';
  const channel = options.channel || grpc.ChannelCredentials.createInsecure();

  return [`${host}:${port}`, channel, { keepCase: true }];
};
