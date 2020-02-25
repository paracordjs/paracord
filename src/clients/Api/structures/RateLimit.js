'use strict';

const Utils = require('../../../utils');

/** State of a Discord rate limit. */
module.exports = class RateLimit {
  /**
   * Creates a new rate limit state.
   *
   * @param {RateLimitState}
   */
  constructor({ remaining, resetTimestamp, limit }) {
    /** @type {number} Number of requests available before hitting rate limit. Triggers internal rate limiting when 0. */
    this.remaining = remaining;
    /** @type {number|void}  When the rate limit's remaining requests resets to `limit`. */
    this.resetTimestamp = resetTimestamp;
    /** @type {number} From Discord - Rate limit request cap. */
    this.limit = limit;
  }

  /**
   * If a request can be made without triggering a Discord rate limit.
   * @private
   * @type {boolean}
   */
  get hasRemainingUses() {
    return this.remaining > 0;
  }

  /**
   * If it is past the time Discord said the rate limit would reset.
   * @private
   * @type {boolean}
   */
  get rateLimitHasExpired() {
    return this.resetTimestamp <= new Date().getTime();
  }

  /** @type {number} How long until the rate limit resets in ms. */
  get resetAfter() {
    const resetAfter = Utils.millisecondsFromNow(this.resetTimestamp);
    return resetAfter > 0 ? resetAfter : 0;
  }

  /**
   * If the request cannot be made without triggering a Discord rate limit.
   * @type {boolean} `true` if the rate limit exists and is active. Do no send a request.
   */
  get isRateLimited() {
    if (this.rateLimitHasExpired) {
      this.reset();
      return false;
    } if (this.hasRemainingUses) {
      return false;
    }
    return true;
  }

  /** Sets the remaining requests back to the known limit. */
  reset() {
    this.remaining = this.limit;
  }

  /** Reduces the reamining requests before internally rate limiting by 1. */
  decrementRemaining() {
    --this.remaining;
  }

  /**
   * Updates state properties if incoming state is more "strict".
   * Strictness is defined by the value that decreases the chance of getting rate limit.
   *
   * @param {RateLimitState}
   */
  assignIfStricter({ remaining, resetTimestamp, limit }) {
    if (resetTimestamp !== undefined && remaining < this.remaining) {
      this.remaining = remaining;
    }
    if (resetTimestamp !== undefined && resetTimestamp > this.resetTimestamp) {
      this.resetTimestamp = resetTimestamp;
    }
    if (resetTimestamp !== undefined && limit < this.limit) {
      this.limit = limit;
    }
  }
};
