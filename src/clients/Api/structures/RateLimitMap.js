"use strict";
const RateLimit = require("./RateLimit");

/** @typedef {import("./Request")} Request */

/**
 * Rate limit keys to their associated state.
 * @extends Map<string,RateLimit>
 */
module.exports = class RateLimitMap extends Map {
  constructor(props) {
    super(props);
  }

  /**
   * Inserts rate limit if not exists. Otherwise, updates its state.
   *
   * @param {string} rateLimitKey Internally-generated key for this state.
   * @param {RateLimitState} state Rate limit state derived from response headers.
   * @returns {RateLimit} New / updated rate limit.
   */
  upsert(rateLimitKey, state) {
    let rateLimit = this.get(rateLimitKey);

    if (rateLimit === undefined) {
      this.set(rateLimitKey, new RateLimit(state));
    } else {
      rateLimit.assignIfStricter(state);
    }

    return rateLimit;
  }
};
