"use strict";
/* eslint-disable prefer-destructuring */

const {
  LockRequestMessage,
  StatusMessage,
  TokenMessage
} = require("../../structures");
const { loadProtoDefinition, constructorDefaults } = require("../common");

const definition = loadProtoDefinition("identify_lock");

/** Definition for the identity lock rpc service. */
module.exports = class IdentifyLockService extends definition.LockService {
  /**
   * Creates an identity lock service.
   *
   * @param {ServiceOptions} options
   */
  constructor(options) {
    const defaultArgs = constructorDefaults(options || {});
    super(...defaultArgs);
    this.target = defaultArgs[0];
  }

  /**
   * Sends to the server a request to acquire the lock, returning a promise with the parsed response.
   * @returns {Promise<StatusMessage>}
   */
  acquire(value) {
    const message = new LockRequestMessage(value).proto;

    return new Promise((resolve, reject) => {
      super.acquire(message, (err, res) => {
        if (err === null) {
          resolve(StatusMessage.fromProto(res));
        } else {
          reject(err);
        }
      });
    });
  }

  /**
   * Sends to the server a request to release the lock, returning a promise with the parsed response.
   * @returns {Promise<StatusMessage>}
   */
  release(value) {
    const message = new TokenMessage(value).proto;

    return new Promise((resolve, reject) => {
      super.release(message, (err, res) => {
        if (err === null) {
          resolve(StatusMessage.fromProto(res));
        } else {
          reject(err);
        }
      });
    });
  }
};
