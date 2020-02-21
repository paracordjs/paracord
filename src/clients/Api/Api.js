"use strict";
const axios = require("axios");
const Utils = require("../../utils/Utils");
const { RequestService, RateLimitService } = require("../../rpc/services");
const {
  RateLimitCache,
  Request,
  RequestQueue,
  RateLimitHeaders
} = require("./structures");

const {
  LOGLEVEL,
  LOGSOURCE,
  DISCORDAPIURL,
  DISCORDAPIDEFAULTVERSION
} = require("../../utils/constants");

/** @typedef {import("./structures/Request")} Request */
/** @typedef {import("../../rpc/")} Response */

/** A client used to interact with Discord's REST API and navigate its rate limits. */
module.exports = class Api {
  /**
   * Creates a new Api client.
   *
   * @param {string} token Discord token. Will be coerced into a bot token.
   * @param {ApiOptions} [options={}] Optional parameters for this handler.
   */
  constructor(token, options = {}) {
    /** @type {RateLimitCache} Contains rate limit state information. For use when not using rpc; or in fallback. */
    this.rateLimitCache;
    /** @type {RequestQueue} Rate limited requests queue. For use when not using rpc; or in fallback, */
    this.requestQueue;
    /** @type {NodeJS.Timer} Interval for processing ratelimited requests on the queue. */
    this.requestQueueProcessInterval;

    /** @type {RequestService} When using Rpc, the service through which to pass requests to the server. */
    this.rpcRequestService;
    /** @type {RateLimitService} When using Rpc, the service through which to get authorization to make requests. */
    this.rpcRateLimitService;
    /** @type {boolean} Whether or not this client should handle requests locally for as long as it cannot connect to the rpc server. */
    this.allowFallback;

    /** @type {Object<string, string>} Key:Value mapping DISCORD_EVENT to user's preferred emitted value. */
    this.events;
    /** @type {import("events").EventEmitter} */
    this.emitter;

    this.constructorDefaults(token, options);
  }

  /*
   ********************************
   ********* CONSTRUCTOR **********
   ********************************
   */

  /**
   * Assigns default values to this Api instance.
   * @private
   *
   * @param {string} token Discord token.
   * @param {ApiOptions} [options={}] Optional parameters for this handler.
   */
  constructorDefaults(token, options) {
    this.validateParams(token, options);
    Object.assign(this, options);
    this.rateLimitCache = new RateLimitCache();
    this.requestQueue = new RequestQueue(this.rateLimitCache, this);

    const botToken = Utils.coerceTokenToBotLike(token);
    this.createWrappedRequest(botToken);
  }

  /**
   * Throws errors and warnings if the parameters passed to the constructor aren't sufficient.
   * @private
   *
   * @param {string} token Discord bot token.
   */
  validateParams(token) {
    if (token === undefined) {
      throw Error("client requires a bot token");
    }
  }

  /**
   * Creates an isolated axios instance for use by this REST handler.
   * @private
   */
  createWrappedRequest(token) {
    const instance = axios.create({
      baseURL: `${DISCORDAPIURL}/${DISCORDAPIDEFAULTVERSION}`,
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
        "X-RateLimit-Precision": "millisecond"
      },
      ...(this.requestOptions || {})
    });

    /** @type {WrappedRequest} `axios.request()` decorated with ratelimit handling. */
    this.wrappedRequest = this.rateLimitCache.wrapRequest(instance.request);
  }

  /*
   ********************************
   *********** INTERNAL ***********
   ********************************
   */

  /**
   * Simple alias for logging events emitted by this client.
   * @private
   *
   * @param {string} level Key of the logging level of this message.
   * @param {string} message Content of the log
   * @param {*} [data] Data pertinent to the event.
   */
  log(level, message, data) {
    this.emit("DEBUG", {
      source: LOGSOURCE.API,
      level: LOGLEVEL[level],
      message,
      data
    });
  }

  /**
   * Emits all events if `this.events` is undefined; otherwise will emit those defined as keys in `this.events` as the paired value.
   * @private
   *
   * @param {string} type Type of event. (e.g. "DEBUG" or "CHANNEL_CREATE")
   * @param {Object<string, any>} data Data to send with the event.
   */
  emit(type, data) {
    if (this.emitter !== undefined) {
      this.emitter.emit(type, data);
    }
  }

  /*
   ********************************
   ********* RPC SERVICE **********
   ********************************
   */

  /**
   * Adds the service that has a server make requests to Discord on behalf of the client.
   *
   * @param {ServerOptions} [serverOptions={}]
   */
  addRequestService(serverOptions = {}) {
    if (
      this.rpcRateLimitService !== undefined ||
      this.rpcRequestService !== undefined
    ) {
      throw Error(
        "A rpc service has already been defined for this client. Only one may be added."
      );
    }

    this.rpcRequestService = new RequestService(serverOptions || {});
    this.allowFallback = serverOptions.allowFallback;

    const message = `Rpc service created for sending requests remotely. Connected to: ${this.rpcRequestService.target}`;
    this.log("INFO", message);

    if (!this.allowFallback) {
      const message =
        "`allowFallback` option is not true. Requests will fail when unable to connect to the Rpc server.";
      this.log("WARNING", message);
    }
  }

  /**
   * Adds the service that first checks with a server before making a request to Discord.
   *
   * @param {ServerOptions} [serverOptions={}]
   */
  addRateLimitService(serverOptions = {}) {
    if (
      this.rpcRateLimitService !== undefined ||
      this.rpcRequestService !== undefined
    ) {
      throw Error(
        "A rpc service has already been defined for this client. Only one may be added."
      );
    }

    this.rpcRateLimitService = new RateLimitService(serverOptions || {});
    this.allowFallback = serverOptions.allowFallback;

    const message = `Rpc service created for handling rate limits remotely. Connected to: ${this.rpcRateLimitService.target}`;
    this.log("INFO", message);

    if (!this.allowFallback) {
      const message =
        "`allowFallback` option is not true. Requests will fail when unable to connect to the Rpc server.";
      this.log("WARNING", message);
    }
  }

  /*
   ********************************
   ******** REQUEST QUEUE *********
   ********************************
   */

  /**
   * Starts the request rate limit queue processesing.
   *
   * @param {number} [interval=1e3] Time between checks in ms.
   */
  startQueue(interval = 1e3) {
    if (this.requestQueueProcessInterval === undefined) {
      this.log("INFO", "Starting request queue.");
      this.requestQueueProcessInterval = setInterval(
        this.requestQueue.process.bind(this.requestQueue),
        interval
      );
    } else {
      throw Error("request queue already started");
    }
  }

  /** Stops the request rate limit queue processesing. */
  stopQueue() {
    this.log("INFO", "Stopping request queue.");
    clearInterval(this.requestQueueProcessInterval);
    this.requestQueueProcessInterval = undefined;
  }

  /**
   * Makes a request from the queue.
   *
   * @param {Request} request Request being made.
   */
  sendQueuedRequest(request) {
    const message = `Sending queued request: ${request.method} ${request.url}`;
    this.log("DEBUG", message, request);
    return this.wrappedRequest(request);
  }

  /*
   ********************************
   *********** REQUEST ************
   ********************************
   */

  /**
   * Sends the request to the rpc server for handling.
   *
   * @param {Request} request Request being made.
   */
  async handleRequestRemote(request) {
    this.emit("DEBUG", {
      source: LOGSOURCE.API,
      level: LOGLEVEL.DEBUG,
      message: "Sending request over Rpc to server."
    });

    let res = {};
    try {
      res = await this.rpcRequestService.request(request);
    } catch (err) {
      if (err.code === 14 && this.allowFallback) {
        const message =
          "Could not reach RPC server. Falling back to handling request locally.";
        this.log("ERROR", message);

        res = await this.handleRequestLocal(request);
      } else {
        throw err;
      }
    }

    return res;
  }

  /**
   * Makes a request to Discord, handling any ratelimits and returning when a non-429 response is received.
   *
   * @param {string} method HTTP method of the request.
   * @param {string} url Discord endpoint url. (e.g. "/channels/abc123")
   * @param {Object} [options]
   * @param {Object} [options.data] Data to send with the request.
   * @param {Object} [options.headers] Headers to send with the request. "Authorization" and "Content-Type" will override the defaults.
   * @param {boolean} [options.local] If true, executes the request locally ignoring any rpc services. Be sure to `startQueue()` to handle rate limited requests.
   * @returns {Promise<ApiResponse>} Response to the request made.
   */
  async request(method, url, options = {}) {
    const { data, headers, local } = options;

    if (url.startsWith("/")) {
      url = url.slice(1);
    }

    const request = new Request(method.toUpperCase(), url, {
      data,
      headers
    });

    if (this.rpcRequestService === undefined || local) {
      return this.handleRequestLocal(request);
    } else {
      return this.handleRequestRemote(request);
    }
  }

  /**
   * Send the request and handle 429's.
   * @private
   *
   * @param {Request} request The request being sent.
   * @returns {Object<string, any>} axios response.
   */
  async handleRequestLocal(request) {
    if (this.requestQueueProcessInterval === undefined) {
      const message =
        "Making a request with a local Api client without a running request queue. Please invoke `startQueue()` on this client so that rate limits may be handled.";
      this.log("WARNING", message);
    }

    // TODO(lando): Review 429-handling logic. This loop may be stacking calls.

    let response = await this.sendRequest(request);
    const rateLimitHeaders = RateLimitHeaders.extractRateLimitFromHeaders(
      response.headers
    );

    while (response.status === 429) {
      if (this.requestQueueProcessInterval === undefined) {
        const message =
          "A request has been rate limited and will not be processed. Please invoke `startQueue()` on this client so that rate limits may be handled.";
        this.log("WARNING", message);
      }
      response = await this.handleRateLimitedRequest(request, rateLimitHeaders);
    }

    this.updateRateLimitCache(request, rateLimitHeaders);

    return response;
  }

  /**
   * Updates the local rate limit cache and sends an update to the server if there is one.
   * @private
   *
   * @param {Request} request The request made.
   * @param {RateLimitHeaders} rateLimitHeaders Headers from the response.
   */
  updateRateLimitCache(request, rateLimitHeaders) {
    this.rateLimitCache.update(request, rateLimitHeaders);

    if (
      this.rpcRateLimitService !== undefined &&
      rateLimitHeaders !== undefined
    ) {
      this.updateRpcCache(request, rateLimitHeaders);
    }
  }

  async updateRpcCache(request, rateLimitHeaders) {
    try {
      await this.rpcRateLimitService.update(
        request,
        ...rateLimitHeaders.rpcArgs
      );
    } catch (err) {
      if (err.code !== 14) {
        throw err;
      }
    }
  }

  /**
   * Determines how the request will be made based on the client's options and makes it.
   * @private
   *
   * @param {Request} request Request being made,
   */
  async sendRequest(request) {
    if (await this.returnOkToMakeRequest(request)) {
      const message = `Sending request: ${request.method} ${request.url}`;
      this.log("DEBUG", message, request);
      return this.wrappedRequest(request);
    } else {
      const message = `Enqueuing request: ${request.method} ${request.url}`;
      this.log("DEBUG", message, request);
      return this.enqueueRequest(request);
    }
  }

  /**
   * Checks request against relevant service or cache to see if it will trigger a rate limit.
   * @param {Request} request Request being made.
   * @returns {boolean} `true` if request will not trigger a rate limit.
   */
  async returnOkToMakeRequest(request) {
    if (this.rpcRateLimitService !== undefined) {
      return this.authorizeRequestWithServer(request);
    } else {
      return !this.rateLimitCache.returnIsRateLimited(request);
    }
  }

  /**
   * Gets authorization from the server to make the request.
   * @private
   *
   * @param {Request} request Request being made.
   * @returns {boolean} `true` if server has authorized the request.
   */
  async authorizeRequestWithServer(request) {
    try {
      const { resetAfter } = await this.rpcRateLimitService.authorize(request);

      if (resetAfter === 0) {
        return true;
      } else {
        if (
          request.waitUntil === undefined ||
          request.waitUntil < new Date().getTime()
        ) {
          const waitUntil = Utils.timestampNMillisecondsInFuture(resetAfter);
          request.assignIfStricterWait(waitUntil);
        }
        return false;
      }
    } catch (err) {
      if (err.code === 14 && this.allowFallback) {
        const message =
          "Could not reach RPC server. Fallback is allowed. Allowing request to be made.";
        this.log("ERROR", message);

        return true;
      } else {
        throw err;
      }
    }
  }

  /**
   * Updates the rate limit state and enqueues the request.
   * @private
   *
   * @param {RateLimitHeaders} headers Response headers.
   * @param {Request} request Request being sent.
   * @returns {Object<string, any>} axios response.
   */
  handleRateLimitedRequest(request, rateLimitHeaders) {
    let message;
    if (rateLimitHeaders === undefined || rateLimitHeaders.global) {
      message = `Request global rate limited: ${request.method} ${request.url}`;
    } else {
      message = `Request rate limited: ${request.method} ${request.url}`;
    }

    this.log("DBEUG", message, rateLimitHeaders);

    this.updateRateLimitCache(request);
    return this.enqueueRequest(request);
  }

  /**
   * Puts the Api Request onto the queue to be executed when the ratelimit has reset.
   * @private
   *
   * @param {import("./structures/Request")} request The Api Request to queue.
   * @returns {Promise} Resolves as the reponsse to the request.
   */
  enqueueRequest(request) {
    // request.timeout = new Date().getTime() + timeout;

    this.requestQueue.push(request);
    request.response = undefined;

    /** Continuously checks if the response has returned. */
    function checkRequest(resolve, reject) {
      const { response } = request;
      if (response !== undefined) {
        resolve(response);
      } else {
        setTimeout(() => checkRequest(resolve, reject));
      }

      // } else if (timeout < new Date().getTime()) { } - keeping this temporarily for posterity
    }

    return new Promise(checkRequest);
  }
};
