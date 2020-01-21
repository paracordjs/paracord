"use strict";
const Utils = require("../../../utils/Utils");

/** Representation of rate limit values from the header of a response from Discord. */
module.exports = class RateLimitHeaders {
  /**
   * Creates a new rate limit headers.
   *
   * @param {boolean} global From Discord - If the request was globally rate limited.
   * @param {string} bucket From Discord - Id of the rate limit bucket.
   * @param {number} limit From Discord - Number of requests that can be made between rate limit triggers.
   * @param {number} remaining From Discord - Number of requests available before hitting rate limit.
   * @param {number} resetAfter From Discord - How long in ms the rate limit resets.
   */
  constructor(global, bucket, limit, remaining, resetAfter) {
    /** @type {boolean} From Discord - If the request was globally rate limited. */
    this.global = global || false;
    /** @type {string} From Discord - Id of the rate limit bucket. */
    this.bucket = bucket;
    /** @type {number} From Discord - Number of requests that can be made between rate limit triggers. */
    this.limit = limit;
    /** @type {number} From Discord - Number of requests available before hitting rate limit. */
    this.remaining = remaining;
    /** @type {number} From Discord - How long in ms the rate limit resets. */
    this.resetAfter = resetAfter;
    /** @type {number} A localized timestamp of when the rate limit resets. */
    this.resetTimestamp = Utils.timestampNSecondsInFuture(this.resetAfter);
  }

  /** @type {boolean} Whether or not the header values indicate the request has a rate limit. */
  get hasState() {
    return this.bucket !== undefined;
  }

  /** @type {[boolean, string, number, number, number]} Values to send over the rate limit service rpc. */
  get rpcArgs() {
    return [
      this.global,
      this.bucket,
      this.limit,
      this.remaining,
      this.resetAfter
    ];
  }

  /**
   * Extracts the rate limit state information if they exist from a set of response headers.
   * @private
   *
   * @param {*} headers Headers from a response.
   * @returns {RateLimitHeaders} Rate limit state with the bucket id; or `undefined` if there is no rate limit information.
   */
  static extractRateLimitFromHeaders(headers) {
    if (headers["x-ratelimit-bucket"] === undefined) {
      return undefined;
    }

    const {
      "x-ratelimit-global": global,
      "x-ratelimit-bucket": bucket,
      "x-ratelimit-limit": limit,
      "x-ratelimit-remaining": remaining,
      "x-ratelimit-reset-after": resetAfter
    } = headers;

    return new RateLimitHeaders(
      global,
      bucket,
      Number(limit),
      Number(remaining),
      Number(resetAfter)
    );
  }
};
