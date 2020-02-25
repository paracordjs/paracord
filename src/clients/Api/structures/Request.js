'use strict';

const BaseRequest = require('./BaseRequest');

/**
 * A request that will be made to Discord's REST API.
 * @extends BaseRequest
 */
module.exports = class Request extends BaseRequest {
  /**
   * Creates a new request object.
   *
   * @param {string} method HTTP method of the request.
   * @param {string} url Discord REST endpoint target of the request. (e.g. channels/123)
   * @param {RequestOptions} [options] Optional parameters for this request.
   */
  constructor(method, url, options) {
    super(method, url);
    /** @type {*} Data to send in the body of the request. */
    this.data;
    /** @type {Object} Addtional headers to send with the request. */
    this.headers;
    // /** @type {number} If rate limited, how long in seconds to allow the request to sit in the queue before canceling. */
    // this.timeout;

    /** @type {Object<string, any>} If queued, will be the response when this request is sent. */
    this.response;
    /** @type {number} If queued when using the rate limit rpc service, a timestamp of when the request will first be availble to try again. */
    this.waitUntil;

    Object.assign(this, options);
  }

  /** @type {Object<string, any>} Data relevant to sending this request via axios. */
  get sendData() {
    return {
      method: this.method,
      url: this.url,
      data: this.data,
      headers: this.headers,
      validateStatus: null, // Tells axios not to throw errors when a non-200 response codes are encountered.
    };
  }

  /**
   * Assigns a stricter value to `waitUntil`.
   * Strictness is defined by the value that decreases the chance of getting rate limited.
   * @param {number} waitUntil A timestamp of when the request will first be availble to try again when queued due to rate limits.
   */
  assignIfStricterWait(waitUntil) {
    if (this.waitUntil === undefined || this.waitUntil < waitUntil) {
      this.waitUntil = waitUntil;
    }
  }
};
