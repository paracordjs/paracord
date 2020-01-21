"use strict";
module.exports = class RateLimit {
  constructor({ remaining, resetTimestamp, limit }) {
    /** @type {number} */
    this.remaining = remaining;
    /** @type {number} */
    this.resetTimestamp = resetTimestamp;
    /** @type {number} */
    this.limit = limit;
  }

  assignIfStricter({ remaining, resetTimestamp, limit }) {
    if (remaining < this.remaining) this.remaining = remaining;
    if (resetTimestamp > this.resetTimestamp) this.resetTimestamp = resetTimestamp;
    if (limit < this.limit) this.limit = limit;
  }

  /**
      If ratelimit is being struggle-snuggled, pad wait time in hopes that this request
      will return with the information needed to accurately judge others in queue
    */
  reset() {
    this.remaining = this.limit;
    this.resetTimestamp = new Date().getTime() + 1e3;
  }

  decrementRemaining() {
    --this.remaining;
  }
};
