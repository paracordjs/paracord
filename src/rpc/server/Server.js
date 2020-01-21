/* eslint-disable no-sync */
"use strict";
const grpc = require("@grpc/grpc-js");

const {
  identifyLockCallbacks,
  requestCallbacks,
  rateLimitCallbacks
} = require("../services");

const { loadProto } = require("../services/common");
const { Lock } = require("../structures");

const Api = require("../../clients/Api");
const { RateLimitCache } = require("../../clients/Api/structures");

const { LOGSOURCE, LOGLEVEL } = require("../../utils/constants");

const requestProto = loadProto("request");
const lockProto = loadProto("identify_lock");
const rateLimitProto = loadProto("rate_limit");

/**
 * Rpc server.
 * @extends grpc.Server
 */
module.exports = class Server extends grpc.Server {
  /**
   * Creates a new rpc Server.
   *
   * @param {RpcServerOptions} options
   */
  constructor(options = {}) {
    super();
    /** @type {import("events").EventEmitter} Emitter for debug logging. */
    this.emitter;
    /** @type {RpcServerBindArgs} Argumenets passed when binding the server to its port. */
    this.bindArgs;

    /** @type {void|Api} Api client when the "request" service is added. */
    this.apiClient;
    /** @type {void|Lock} Lock instance when the "identify lock" service is added. */
    this.identifyLock;

    this.constructorDefaults(options);
  }

  /**
   * Assigns default values to this rpc server based on the options.
   * @private
   *
   * @param {RpcServerOptions} options
   */
  constructorDefaults(options) {
    const defaults = {
      host: "127.0.0.1",
      port: "50051",
      channel: grpc.ServerCredentials.createInsecure(),
      ...options
    };

    Object.assign(this, defaults);

    this.bindArgs = this.bindArgs || this.createDefaultBindArgs();
  }

  /**
   * Establishes the arguments that will be passed to `bindAsync()` when starting the server.
   * @private
   */
  createDefaultBindArgs() {
    const callback = () => {
      this.start();

      let message = `Rpc server running at http://${this.host}:${this.port}`;
      this.emit("DEBUG", {
        source: LOGSOURCE.RPC,
        level: LOGLEVEL.INFO,
        message
      });
    };

    return [`${this.host}:${this.port}`, this.channel, callback];
  }

  /**
   * Emits logging events.
   * @private
   *
   * @param  {...any} args Arguments to pass directly into the emitter.
   */
  emit(...args) {
    if (this.emitter !== undefined) {
      this.emitter.emit(...args);
    }
  }

  /**
   * Adds the request service to this server. Allows the server to handle Discord API requests from clients.
   *
   * @param {string} token Discord token. Will be coerced into a bot token.
   * @param {ApiOptions} apiOptions Optional parameters for the api handler.
   */
  addRequestService(token, apiOptions = {}) {
    apiOptions.requestOptions = apiOptions.requestOptions || {};
    apiOptions.requestOptions.transformResponse = data => {
      return data;
    };

    this.apiClient = new Api(token, apiOptions);
    this.apiClient.startQueue();

    this.addService(requestProto.RequestService, requestCallbacks(this));
    this.emit("DEBUG", {
      source: LOGSOURCE.RPC,
      level: LOGLEVEL.INFO,
      message: "The request service has been added to the server."
    });
  }

  /** Adds the identify lock service to this erver. Allows the server to maintain a lock for clients. */
  addLockService() {
    this.identifyLock = new Lock(this.emitter);

    this.addService(
      lockProto.LockService,
      identifyLockCallbacks(this, this.identifyLock)
    );
    this.emit("DEBUG", {
      source: LOGSOURCE.RPC,
      level: LOGLEVEL.INFO,
      message: "The identify lock service has been to the server."
    });
  }

  addRateLimitService() {
    this.rateLimitCache = new RateLimitCache();

    this.addService(
      rateLimitProto.RateLimitService,
      rateLimitCallbacks(this, this.rateLimitCache)
    );
    this.emit("DEBUG", {
      source: LOGSOURCE.RPC,
      level: LOGLEVEL.INFO,
      message: "The rate limit service has been to the server."
    });
  }

  /** Start the cserver. */
  serve() {
    this.bindAsync(...this.bindArgs);
  }

  log(level, message) {
    this.emit("DEBUG", {
      source: LOGSOURCE.RPC,
      level: LOGLEVEL[level],
      message
    });
  }
};
