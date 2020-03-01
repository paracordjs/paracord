/* eslint-disable prefer-destructuring */

'use strict';

const {
  LockRequestMessage,
  StatusMessage,
  TokenMessage,
} = require('../../structures');
const { loadProtoDefinition, constructorDefaults } = require('../common');

const definition = loadProtoDefinition('identify_lock');

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
    /** @type {boolean} Used by the client to determine if it should fallback to an alternative method or not. */
    this.allowFallback;
    /** @type {number} How long in ms the client tells the server it should wait before expiring the lock. */
    this.duration;
    /** @type {string} Unique ID given to this client when acquiring the lock. */
    this.token;
  }

  /**
   * Sends a request to acquire the lock to the server, returning a promise with the parsed response.
   * @returns {Promise<StatusMessage>}
   */
  acquire() {
    const message = new LockRequestMessage(this.duration, this.token).proto;

    return new Promise((resolve, reject) => {
      super.acquire(message, (err, res) => {
        if (err === null) {
          const statusMessage = StatusMessage.fromProto(res);
          ({ token: this.token } = statusMessage);
          resolve(statusMessage);
        } else {
          reject(err);
        }
      });
    });
  }

  /**
   * Sends a request to release the lock to the server, returning a promise with the parsed response.
   * @returns {Promise<StatusMessage>}
   */
  release() {
    const message = new TokenMessage(this.token).proto;

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
