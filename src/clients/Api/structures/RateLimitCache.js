"use strict";
const RateLimitMap = require("./RateLimitMap");
const RateLimit = require("./RateLimit");

// TODO(lando): add a periodic sweep for ratelimits to fix potential memory leak.

/** @typedef {import("./Request")} Request */

/** @typedef {string} RateLimitRequestMeta Combination of request parameters that idenitfy a bucket. */
/** @typedef {string} RateLimitBucket From Discord - A uid that identifies a group of requests that share a rate limit. */
/** @typedef {string} RateLimitKey */

/**
 * @typedef {Map<RateLimitRequestMeta, RateLimitBucket|void>} RateLimitMetaToBucket
 * `RateLimitBucket` will be `null` if there is no rate limit associated with the request's meta.
 */

/**
 * @typedef {RateLimit} RateLimitTemplate A frozen instance of a rate limit that is used as
 * a reference for requests with the same bucket but without an existing cached state.
 */

/** @typedef {Map<RateLimitBucket, void|RateLimitTemplate>} RateLimitTemplateMap */

/** Stores the state of all known rate limits this client has encountered. */
module.exports = class RateLimitCache {
  /** Creates a new rate limit cache. */
  constructor() {
    /** @type {RateLimitMetaToBucket} Request meta values to their associated rate limit bucke; or to `null` if no rate limit for the meta. */
    this.rateLimitMetaToBucket = new Map();
    /** @type {RateLimitMap} Rate limit keys to their associate rate limit. */
    this.rateLimits = new RateLimitMap();
    /** @type {RateLimitTemplateMap} Bucket Ids to saved rate limits state to create new rate limits from known constraints. */
    this.templates = new Map();
  }

  /**
   * Decorator for requests. Decrements rate limit when executing if one exists for this request.
   *
   * @param {Function} requestFunc `request` method of an axios instance.
   * @returns {WrappedRequest} Wrapped function.
   */
  wrapRequest(requestFunc) {
    /** @type {WrappedRequest} */
    const wrappedRequest = request => {
      const rateLimit = this.getRateLimitFromCache(request);

      if (rateLimit !== undefined) {
        rateLimit.decrementRemaining();
      }

      return requestFunc.apply(this, [request.sendData]);
    };

    return wrappedRequest;
  }

  /**
   * Authorizes a request being check via the rate limit rpc service.
   *
   * @param {BaseRequest} request Request's rate limit key formed in BaseRequest.
   * @returns {number} When the client should wait until before asking to authorize this request again.
   */
  authorizeRequestFromClient(request) {
    const rateLimit = this.getRateLimitFromCache(request);
    if (rateLimit === undefined) {
      return 0;
    } else if (!rateLimit.isRateLimited) {
      rateLimit.decrementRemaining();
      return 0;
    } else {
      return rateLimit.resetAfter;
    }
  }

  /**
   * Gets the rate limit, creating a new one from an existing template if the rate limit does not already exist.
   * @private
   *
   * @param {BaseRequest|Request} request Request that may have a rate limit.
   * @return {RateLimit} `undefined` when there is no cached rate limit or matching template for this request.
   */
  getRateLimitFromCache(request) {
    const { rateLimitBucketKey, rateLimitKey } = request;

    const bucket = this.rateLimitMetaToBucket.get(rateLimitBucketKey);
    if (bucket !== null && bucket !== undefined) {
      const rateLimit = this.rateLimits.get(rateLimitKey);
      if (rateLimit !== undefined) {
        return rateLimit;
      }
      return this.createRateLimitFromTemplate(bucket, rateLimitKey);
    }
  }

  /**
   * Creates a new rate limit from a template if one exists.
   * @private
   *
   * @param {string} bucket Request's bucket Id.
   * @param {string} rateLimitKey Request's rate limit key.
   * @return {RateLimit} `undefined` when there is no matching template.
   */
  createRateLimitFromTemplate(bucket, rateLimitKey) {
    const rateLimitTemplate = this.templates.get(bucket);
    if (rateLimitTemplate !== undefined) {
      return this.rateLimits.upsert(rateLimitKey, rateLimitTemplate);
    }
  }

  /**
   * Updates this cache using the response headers after making a request.
   *
   * @param {BaseRequest|Request} request Request that was made.
   * @param {RateLimitHeaders} rateLimitHeaders Rate limit values from the response.
   */
  update(request, rateLimitHeaders) {
    const { rateLimitBucketKey, rateLimitKey } = request;

    if (rateLimitHeaders === undefined) {
      this.rateLimitMetaToBucket.set(rateLimitBucketKey, null);
    } else {
      const { bucket, ...state } = rateLimitHeaders;

      this.rateLimitMetaToBucket.set(rateLimitBucketKey, bucket);
      this.rateLimits.upsert(rateLimitKey, state);
      this.setTemplateIfNotExists(bucket, state);
    }
  }

  /**
   * Creates a new template if one does not already exist.
   * @private
   *
   * @param {string} rateLimitBucketKey Request's bucket key.
   * @param {void|RateLimitState} state State of the rate limit if one exists derived from a set of response headers.
   */
  setTemplateIfNotExists(bucket, state) {
    if (!this.templates.has(bucket)) {
      const template = {
        resetTimestamp: undefined,
        remaining: state.limit,
        limit: state.limit
      };
      this.templates.set(bucket, Object.freeze(new RateLimit(template)));
    }
  }

  /**
   * Runs a request's rate limit meta against the cache to determine if it would trigger a rate limit.
   *
   * @param {Request} request The request to reference when chacking the rate limit state.
   * @returns {boolean} `true` if rate limit would get triggered.
   */
  returnIsRateLimited(request) {
    const rateLimit = this.getRateLimitFromCache(request);

    if (rateLimit !== undefined) {
      return rateLimit.isRateLimited;
    }

    return false;
  }
};
