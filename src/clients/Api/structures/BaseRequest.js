"use strict";

/** Basic information in a request to Discord. */
module.exports = class BaseRequest {
  /**
   * Creates a new base request object with its associated rate limit identifiers.
   *
   * @param {string} method HTTP method of the request.
   * @param {string} url Discord REST endpoint target of the request. (e.g. channels/123)
   */
  constructor(method, url) {
    /** @type {string} HTTP method of the request. */
    this.method = method;
    /** @type {string} Discord REST endpoint target of the request. (e.g. channels/123) */
    this.url = BaseRequest.stripUrlLeadingSlash(url);

    /** @type {string} Key generated from the method and minor parameters of a request used internally to get shared buckets. */
    this.rateLimitBucketKey;
    /** @type {string} Key for this specific requests rate limit state in the rate limit cache. */
    this.rateLimitKey;

    Object.assign(this, BaseRequest.assignRateLimitMeta(method, url));
  }

  /**
   * Standardizes url by stripping the leading `/` if it exists.
   * @private
   *
   * @param {string} url Discord endpoint the request will be sent to.
   * @returns {string} A url stripped of leading `/`.
   */
  static stripUrlLeadingSlash(url) {
    return url.startsWith("/") ? url.replace("/", "") : url;
  }

  /**
   * Extracts the rate limit information needed to navigate rate limits.
   * @private
   *
   * @param {string} method HTTP method of the request.
   * @param {string} url Discord endpoint the request will be sent to.
   * @returns An object containing the `rateLimitBucketKey` and `rateLimitKey`.
   */
  static assignRateLimitMeta(method, url) {
    const [
      rateLimitMajorType,
      rateLimitMajorID,
      ...rateLimitMinorParameters
    ] = url.split("/");

    const rateLimitBucketKey = BaseRequest.convertMetaToBucketKey(
      method,
      rateLimitMinorParameters
    );

    const rateLimitKey = `${rateLimitMajorType}-${rateLimitMajorID}-${rateLimitBucketKey}`;

    return { rateLimitBucketKey, rateLimitKey };
  }

  /**
   * Takes the method and url "minor parameters" to create a key used in navigating rate limits.
   * @private
   *
   * @param {string} method HTTP method of the request.
   * @param {string} rateLimitMinorParameters Request method and parameters in the url following the major parameter.
   * @returns {string} A key used internally to find related buckets.
   */
  static convertMetaToBucketKey(method, rateLimitMinorParameters) {
    const key = [];

    if (method === "GET") key.push("ge");
    else if (method === "POST") key.push("p");
    else if (method === "PATCH") key.push("u");
    else if (method === "DELETE") key.push("d");

    for (const param of rateLimitMinorParameters) {
      if (param === "members") key.push("m");
      else if (param === "guilds") key.push("gu");
      else if (param === "channels") key.push("c");
    }

    return key.join("-");
  }
};
