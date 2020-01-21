"use strict";
module.exports = class RequestQueue {
  constructor(rateCache) {
    this.rateCache = rateCache;
    /** @type {boolean}  */
    this.processing = false;
    /** @type {import("./Request")[]} client An event emitter. */
    this.requests = new Array();
    this.stackLength = 0;
  }

  get length() {
    return this.stackLength;
  }
  push(...items) {
    for (const i of items) this.requests[++this.stackLength - 1] = i;
  }
  spliceMany(indices) {
    if (indices.length === 0) return;

    this.stackLength = 0;

    for (let idx = 0; idx < this.requests.length; ++idx) {
      if (this.requests[idx] === undefined || this.requests[idx] === null) break;
      if (indices.includes(idx)) continue;

      this.requests[this.stackLength] = this.requests[idx];
      ++this.stackLength;
    }

    for (let idx = this.stackLength; idx < this.requests.length; ++idx) {
      if (this.requests[idx] === undefined || this.requests[idx] === null) break;

      this.requests[idx] = null;
    }
  }
  process() {
    if (this.length === 0 || this.processing) return;

    try {
      this.processing = true;

      let j = 0;
      const processedIndices = new Array(this.length);

      for (let idx = 0; idx < this.length; ++idx) {
        const request = this.requests[idx];
        if (request.timeout <= new Date().getTime()) {
          processedIndices[j++] = idx;
        } else if (!this.rateCache.checkIfRateLimited(request)) {
          request.response = request.send();

          processedIndices[j++] = idx;
        }
      }

      this.spliceMany(processedIndices);
    } finally {
      this.processing = false;
    }
  }
};
