/* eslint-disable prefer-destructuring */

'use strict';

const {
  RequestMetaMessage,
  AuthorizationMessage,
  RateLimitStateMessage,
} = require('../../structures');
const { loadProtoDefinition, constructorDefaults } = require('../common');

const definition = loadProtoDefinition('rate_limit');

/** Definition for the identity lock rpc service. */
module.exports = class RateLimitService extends definition.RateLimitService {
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
   * Receives authorization from rate limit handling server to make the request.
   *
   * @param {Request} request The request being authorized.
   * @returns {Promise<AuthorizationMessage>}
   */
  authorize(request) {
    const { method, url } = request;

    const message = new RequestMetaMessage(method, url).proto;

    return new Promise((resolve, reject) => {
      super.authorize(message, (err, res) => {
        if (err === null) {
          resolve(AuthorizationMessage.fromProto(res));
        } else {
          reject(err);
        }
      });
    });
  }

  /**
   *
   * @param {Request} request The request being authorized.
   * @returns {Promise<void>}
   */
  update(request, global, bucket, limit, remaining, resetAfter) {
    const { method, url } = request;
    const requestMeta = new RequestMetaMessage(method, url);
    const message = new RateLimitStateMessage(
      requestMeta,
      global,
      bucket,
      limit,
      remaining,
      resetAfter,
    ).proto;

    return new Promise((resolve, reject) => {
      super.update(message, (err) => {
        if (err === null) {
          resolve();
        } else {
          reject(err);
        }
      });
    });
  }
};
