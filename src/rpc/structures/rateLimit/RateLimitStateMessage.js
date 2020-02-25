'use strict';

const RequestMetaMessage = require('./RequestMetaMessage');

/** A class for the RateLimitStateMessage protobuf. */
module.exports = class RateLimitStateMessage {
  /**
   * Creates a new RateLimitStateMessage sent from client to server.
   *
   * @param {RequestMetaMessage} requestMeta Meta data from the requests used to identify the rate limit.
   * @param {boolean} global From Discord - If the request was globally rate limited.
   * @param {string} bucket From Discord - Id of the rate limit bucket.
   * @param {number} limit From Discord - Number of requests that can be made between rate limit triggers.
   * @param {number} remaining From Discord - Number of requests available before hitting rate limit.
   * @param {number} resetAfter From Discord - How long in ms the rate limit resets.
   */
  constructor(requestMeta, global, bucket, limit, remaining, resetAfter) {
    /** @type {RequestMetaMessage} Meta data from the requests used to identify the rate limit. */
    this.requestMeta = requestMeta;
    /** @type {boolean} From Discord - If the request was globally rate limited. */
    this.global = global || false;
    /** @type {string} bucket From Discord - Id of the rate limit bucket. */
    this.bucket = bucket;
    /** @type {number} limit From Discord - Number of requests that can be made between rate limit triggers. */
    this.limit = limit;
    /** @type {number} remaining From Discord - Number of requests available before hitting rate limit. */
    this.remaining = remaining;
    /** @type {number} resetAfter From Discord - How long in ms the rate limit resets. */
    this.resetAfter = resetAfter;
  }

  /** @type {RateLimitStateProto} The properties of this message formatted for sending over rpc. */
  get proto() {
    RateLimitStateMessage.validateOutgoing(this);

    return {
      request_meta: this.requestMeta.proto,
      bucket: this.bucket,
      limit: this.limit,
      remaining: this.remaining,
      reset_after: this.resetAfter,
      global: this.global,
    };
  }

  /**
   * Verifies that the message being sent is valid.
   *
   * @param {RateLimitStateMessage} requestMeta
   */
  static validateOutgoing(rateLimitState) {
    const {
      requestMeta,
      global,
      bucket,
      remaining,
      resetAfter,
      limit,
    } = rateLimitState;
    if (
      requestMeta === undefined
      || !(requestMeta instanceof RequestMetaMessage)
    ) {
      throw Error("'requestMeta' must be a defined RequestMetaMessage");
    }
    if (global === undefined) {
      throw Error("'global' must be a defined boolean if bucket is defined");
    }

    if (bucket !== undefined) {
      if (remaining === undefined) {
        throw Error(
          "'remaining' must be a defined number if bucket is defined",
        );
      }
      if (resetAfter === undefined) {
        throw Error(
          "'resetAfter' must be a defined number if bucket is defined",
        );
      }
      if (limit === undefined) {
        throw Error("'limit' must be a defined number if bucket is defined");
      }
    }
  }

  /**
   * Validates that the message being received is valid.
   *
   * @param {RateLimitStateProto} message
   */
  static validateIncoming(message) {
    if (message.request_meta === undefined) {
      throw Error("received invalid message. missing property 'request_meta'");
    }
    if (message.global === undefined) {
      throw Error("received invalid message. missing property 'global'");
    }

    if (message.bucket !== undefined) {
      if (message.remaining === undefined) {
        throw Error("received invalid message. missing property 'remaining'");
      }
      if (message.reset_after === undefined) {
        throw Error("received invalid message. missing property 'reset_after'");
      }
      if (message.limit === undefined) {
        throw Error("received invalid message. missing property 'limit'");
      }
    }
  }

  /**
   * Translates the rpc message into an instance of this class.
   *
   * @param {RateLimitStateProto} message
   * @return {RateLimitStateMessage}
   */
  static fromProto(message) {
    RateLimitStateMessage.validateIncoming(message);

    return new RateLimitStateMessage(
      RequestMetaMessage.fromProto(message.request_meta),
      message.global,
      message.bucket,
      message.limit,
      message.remaining,
      message.reset_after,
    );
  }
};
