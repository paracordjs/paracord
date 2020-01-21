"use strict";
const { EventEmitter } = require("events");
const axios = require("axios");
const Util = require("./util/Util");
const Gateway = require("./Gateway");
const RateCache = require("./structures/RateCache");
const Request = require("./structures/Request");
const RequestQueue = require("./structures/RequestQueue");
const { DISCORDURI, REQUESTTIMEOUTDEFAULT } = require("./util/constants");

/**
 * A client to interact with Discord's REST API and elegantly navigate ratelimits.
 *
 * @extends events.EventEmitter To provide an elegant interface between the user
 * and the Gateway should a Discord gateway connection be established.
 */
module.exports = class RipcordClient extends EventEmitter {
  /**
   * Creates a new Ripcord client.
   *
   * @param {string} token Discord bot token. Will be coerced into a bot token.
   */
  constructor(token) {
    super();

    /** @type {string} Discord bot token. Will be coerced into a bot token. */
    this.token;
    /** @type {import("./structures/RateCache")} */
    this.rateCache;
    /** @type {import("./structures/RequestQueue")} */
    this.requestQueue;
    /** @type {import("./Gateway")} */
    this.gateway;
    /** @type {Object} User details given by Discord in the "Ready" event form the gateway. https://discordapp.com/developers/docs/topics/gateway#ready-ready-event-fields */
    this.user;
    /** @type {Function} `axios.request()` decorated with ratelimit handling. */
    this.wrappedRequest;
    /** @type {NodeJS.Timer} Interval for processing ratelimited requests on the queue. */
    this.requestQueueProcessInterval;

    this.ripcordConstructorDefaults(token);
    this.createWrappedRequest();
  }

  /**
   * Assigns default values to this RipcordClient instance.
   * @private
   *
   * @param {string} token Discord bot token. Will be coerced into a bot token.
   */
  ripcordConstructorDefaults(token) {
    const rateCache = new RateCache();

    const defaults = {
      rateCache,
      requestQueue: new RequestQueue(rateCache),
      token: Util.coerceTokenToBotLike(token)
    };

    Object.assign(this, defaults);
  }

  /**
   * Starts the requestQueue processesing.
   *
   * @param {number} [interval=1e3] Time between checks in ms
   */
  startProcessingRequestQueue(interval = 1e3) {
    this.requestQueueProcessInterval = setInterval(
      this.requestQueue.process.bind(this.requestQueue),
      interval
    );
  }

  /**
   * Creates an isolated axios instance for use by this REST handler.
   * @private
   */
  createWrappedRequest() {
    const instance = axios.create({
      baseURL: DISCORDURI,
      headers: {
        Authorization: this.token,
        "Content-Type": "application/json",
        "X-RateLimit-Precision": "millisecond"
      }
    });

    this.wrappedRequest = this.rateCache.wrapRequest(instance.request);
  }

  /**
   * Connects to Discord's gateway and begins receiving events. There is no need to log in when only using `request()` however this must be executed once in a bot token's lifetime in order to do so.
   *
   * @param {Object} config Configuration items for this handler.
   * @param {string} config.token Discord bot token. Will be coerced into a bot token.
   * @param {Object<string,string>} config.events Key:Value mapping DISCORD_EVENT to user's preferred emitted name.
   * @param {[number,number]} [config.shard] [ShardId, ShardCount] to identify with.
   * @param {string} [config.redisIdentityKey="Discord Bot"] Redis key used to mitigate overlapping shard identify's.
   */
  login(config) {
    // TODO(lando): throw on missing mandatory params
    if (config.token === undefined) config.token = this.token;
    this.gateway = new Gateway(this, config);
    return this.gateway.login();
  }

  /**
   * Makes a request to Discord, handling any ratelimits and returning when a non-429 response is received or the timeout is exceeded.
   *
   * @param {Object} options
   * @param {string} options.method Http method of the request.
   * @param {string} options.endpoint The Discord endpoint. (e.g. "/channels/abc123")
   * @param {Object} [options.data] Data to send with the request.globalThis
   * @param {Object} [options.headers] Headers to send with the request. "Authorization" and "Content-Type" will override the defaults.
   * @param {number} [options.timeout=REQUESTTIMEOUTDEFAULT] Duration of time in ms to continue trying the request before rejecting if the request enters the queue.
   */
  request({
    method,
    endpoint,
    data,
    headers,
    timeout = REQUESTTIMEOUTDEFAULT
  }) {
    if (endpoint.startsWith("/")) endpoint = endpoint.slice(1);

    const request = new Request(
      this.wrappedRequest,
      method.toUpperCase(),
      endpoint,
      data,
      headers,
      timeout
    );
    return this.makeRequest(request, timeout);
  }

  /**
   * Make the request and handle 429's.
   * @private
   */
  async makeRequest(request) {
    let response;
    if (!this.rateCache.checkIfRateLimited(request)) {
      const message = "Sending request.";
      const event = { message, data: request, verbose: true };
      this.emitThroughGatewayIfDefined("RIPCORD_DEBUG", event);
      response = await request.send();
    } else {
      const message = "Enqueing request.";
      const event = { message, data: request, verbose: true };
      this.emitThroughGatewayIfDefined("RIPCORD_DEBUG", event);
      response = await this.enqueueRequest(request);
    }

    while (response.status === 429) {
      let message;
      if (response.headers["x-ratelimit-global"] !== undefined) {
        message = "Request global ratelimited.";
      } else {
        message = "Request ratelimited.";
      }

      this.emitThroughGatewayIfDefined("RIPCORD_DEBUG", {
        message,
        data: response.headers
      });

      this.rateCache.update(response.headers, request);
      response = await this.enqueueRequest(request);
    }

    this.rateCache.update(response.headers, request);

    return response;
  }

  emitThroughGatewayIfDefined(type, event) {
    if (this.gateway !== undefined) {
      this.gateway.emit(type, event);
    } else {
      this.emit(type, event);
    }
  }

  /**
   * Puts the Ripcord Request onto the queue to be executed when the ratelimit has reset.
   * @private
   *
   * @param {import("./structures/Request")} request The Ripcord Request to queue.
   * @param {number} timeout Duration of time in ms to continue trying the request before rejecting.
   */
  enqueueRequest(request, timeout) {
    request.timeout = new Date().getTime() + timeout;

    this.requestQueue.push(request);
    request.response = undefined;

    function checkRequest(resolve, reject) {
      const { response, timeout } = request;
      if (response !== undefined) {
        resolve(response);
      } else if (timeout < new Date().getTime()) {
        // TODO(lando): standardize error
        reject("Request timeout.");
      } else {
        setTimeout(() => checkRequest(resolve, reject));
      }
    }

    return new Promise(checkRequest);
  }
};
