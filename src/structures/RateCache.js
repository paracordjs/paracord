"use strict";
const RateLimits = require("./RateLimits");
const RateLimit = require("./RateLimit");
const Util = require("../util/Util");

module.exports = class RateCache {
  constructor() {
    /** @type {Map<string,string|void>} */
    this.buckets = new Map();
    /** @type {Map<string,import("./RateLimits")>} */
    this.rateLimits = new RateLimits();
    /** @type {Map<string,RateLimit|void>} */
    this.templates = new Map();
  }

  wrapRequest(func) {
    return function(rateLimitBucketKey, rateLimitKey, request) {
      const bucket = this.buckets.get(rateLimitBucketKey);

      if (bucket !== undefined && bucket !== null) {
        const ratelimit = this.rateLimits.get(rateLimitKey);

        if (ratelimit !== undefined && ratelimit !== null) {
          ratelimit.decrementRemaining();
        }
      }

      return func.apply(this, [request]);
    }.bind(this);
  }

  checkIfRateLimited(request) {
    const bucket = this.buckets.get(request.rateLimitBucketKey);
    if (bucket !== undefined && bucket !== null) {
      const rateLimit = this.getRateLimit(request);

      if (rateLimit !== undefined) {
        const { resetTimestamp, remaining } = rateLimit;

        const now = new Date().getTime();
        if (resetTimestamp !== null && resetTimestamp <= now) {
          rateLimit.reset();

          return false;
        } else if (remaining === 0) {
          return true;
        }
      }
    }

    return false;
  }

  getRateLimit(request) {
    const rateLimit = this.rateLimits.get(request.rateLimitKey);
    if (rateLimit !== undefined) return rateLimit;
    return this.setRateLimitFromTemplate(request);
  }

  setRateLimitFromTemplate(request) {
    const bucket = this.buckets.get(request.rateLimitBucketKey);
    const rateLimitTemplate = this.templates.get(bucket);

    if (rateLimitTemplate !== undefined) {
      const rateLimit = new RateLimit(rateLimitTemplate);
      this.rateLimits.set(request.rateLimitKey, rateLimit);
      return rateLimit;
    }
  }

  update(headers, request) {
    const rateLimitConstraints = RateCache.extractRateLimitFromHeaders(headers);
    
    if (rateLimitConstraints === undefined) {
      this.buckets.set(request.rateLimitBucketKey, null);
      this.setTemplateIfNotSet(request, null);
    } else {
      this.buckets.set(request.rateLimitBucketKey, rateLimitConstraints.bucket);
      this.rateLimits.upsert(request, rateLimitConstraints);
      this.setTemplateIfNotSet(request, rateLimitConstraints);
    }
  }

  setTemplateIfNotSet(request, rateLimitConstraints) {
    if (!this.templates.has(request.rateLimitBucketKey)) {
      if (rateLimitConstraints === null) {
        this.templates.set(request.rateLimitBucketKey, null);
      } else {
        const template = {
          resetTimestamp: null,
          remaining: rateLimitConstraints.limit,
          limit: rateLimitConstraints.limit
        };
        this.templates.set(
          rateLimitConstraints.bucket,
          Object.freeze(new RateLimit(template))
        );
      }
    }
  }

  static extractRateLimitFromHeaders(headers) {
    if (headers["x-ratelimit-bucket"] !== undefined) {
      const {
        "x-ratelimit-bucket": bucket,
        "x-ratelimit-limit": limit,
        "x-ratelimit-remaining": remaining,
        "x-ratelimit-reset-after": resetAfter
      } = headers;

      return {
        bucket,
        remaining: Number(remaining),
        resetTimestamp: Util.timestampNSecondsInFuture(resetAfter),
        limit: Number(limit)
      };
    }
  }
};
