"use strict";
const ws = require("ws");
const { EventEmitter } = require("events");
const Api = require("../Api");
const Utils = require("../../utils/Utils");
const Identity = require("./structures/Identity");
const { IdentifyLockService } = require("../../rpc/services");

const {
  SECONDINMILLISECONDS,
  MINUTEINMILLISECONDS,
  GIGABYTEINBYTES,
  GATEWAYDEFAULTWSPARAMS,
  GATEWAYOPCODES,
  GATEWAYCLOSECODE,
  GATEWAYMAXREQUESTSPERMINUTE,
  GATEWAYREQUESTBUFFER,
  LOGLEVEL,
  LOGSOURCE
} = require("../../utils/constants");

/**
 * @typedef {Object<string, number>} WebsocketRateLimitCache Information about the current request count and time that it should reset in relation to Discord ratelimits. https://discordapp.com/developers/docs/topics/gateway#rate-limiting
 * @property {number} wsRateLimitCache.resetTimestamp Timestamp in ms when the request limit is expected to reset.
 * @property {number} wsRateLimitCache.remainingRequests How many more requests will be allowed.
 */

/** A client to handle a Discord gateway connection. */
module.exports = class Gateway {
  /**
   * Creates a new Discord gateway handler.
   * @param {string} token Discord token. Will be coerced into a bot token.
   * @param {GatewayOptions} [options={}] Optional parameters for this handler.
   */
  constructor(token, options = {}) {
    /** @type {boolean} If the gateway client is currently i nthe process of getting the ws url to connect. */
    this.loggingIn;

    /** @type {Api} Client through which to make REST api calls to Discord. */
    this.api;
    /** @type {void|IdentifyLockService} Rpc service through which to coordinate identifies with other shards. */
    this.identifyLock_1;
    /** @type {void|IdentifyLockService} Rpc service through which to coordinate identifies with other shards. */
    this.identifyLock_2;
    /** @type {string} Unique value that this client received from the server identifyLock_1. */
    this.identifyLockToken_1;
    /** @type {string} Unique value that this client receive from the server identifyLock_2. */
    this.identifyLockToken_2;
    /** @type {boolean} When using the identify lock service, if the client is allowed to continue without this lock when not able to connect to the server. */
    this.identifyLockAllowFallback_1;
    /** @type {boolean} When using the identify lock service, if the client is allowed to continue without this lock when not able to connect to the server. */
    this.identifyLockAllowFallback_2;

    /** @type {ws} Websocket used to connect to gateway. */
    this.ws;
    /** @type {string} From Discord - Websocket URL instructed to connect to. Also used to indicate it the client has an open websocket. */
    this.wsUrl;
    /** @type  {number} Time to wait between this client's attempts to connect to the gateway in seconds.*/
    this.wsUrlRetryWait;
    /** @type {WebsocketRateLimitCache} */
    this.wsRateLimitCache;

    /** @type {number} From Discord - Most recent event sequence id received. https://discordapp.com/developers/docs/topics/gateway#payloads */
    this.sequence;
    /** @type {string)} From Discord - ID of this gateway connection. https://discordapp.com/developers/docs/topics/gateway#ready-ready-event-fields */
    this.sessionId;
    /** @type {boolean} If the last heartbeat packet sent to Discord received an ACK. */
    this.heartbeatAck;
    /** @type {number} Time when last heartbeat packet was sent in ms. */
    this.lastHeartbeatTimestamp;
    /** @type {NodeJS.Timer} Interval that checks and sends heartbeasts. */
    this.heartbeatInterval;

    /** @type {import("events").EventEmitter} Emitter for gateway and Api events. Will create a default if not provided via the options. */
    this.emitter;
    /** @type {Object<string,string>} Key:Value mapping DISCORD_EVENT to user's preferred emitted value. */
    this.events;

    /** @type {Identity} Object passed to Discord when indentifying. */
    this.identity;
    /** @type {number} Minimum time to wait between gateway identifies in ms. */
    this.retryWait;

    /** @type {number} Time that the shard's identify mutex will be locked for in ms. */
    this.remoteLoginWait;

    this.constructorDefaults(token, options);
  }

  /** @type {boolean} Whether or not the client has the conditions necessary to attempt to resume a gateway connection. */
  get resumable() {
    return this.sessionId !== undefined && this.sequence !== 0;
  }

  /** @type {void|Shard} [ShardID, ShardCount] to identify with; `undefined` if not sharding. */
  get shard() {
    return this.identity.shard ? this.identity.shard[0] : undefined;
  }

  /*
   ********************************
   ********* CONSTRUCTOR **********
   ********************************
   */

  /**
   * Assigns default values to this Gateway instance based on the options.
   * @private
   *
   * @param {string} token Discord token. Will be coerced into a bot token.
   * @param {GatewayOptions} options Optional parameters for this handler.
   */
  constructorDefaults(token, options) {
    this.validateParams(token, options);

    const defaults = {
      emitter: options.emitter || new EventEmitter(),
      sequence: 0,
      wsRateLimitCache: {
        remainingRequests: GATEWAYMAXREQUESTSPERMINUTE,
        resetTimestamp: 0
      },
      ...options
    };

    Object.assign(this, defaults);

    const botToken = Utils.coerceTokenToBotLike(token);
    this.assignIdentity(botToken, options.identity);

    this.bindTimerFunctions();
  }

  /**
   * Throws errors and warnings if the parameters passed to the constructor aren't sufficient.
   * @private
   *
   * @param {string} token Discord token.
   * @param {GatewayOptions} options Optional parameters for this handler.
   */
  validateParams(token, options) {
    if (token === undefined && options.serverOptions === undefined) {
      throw Error("client requires either a 'token' or 'serverOptions' ");
    }
  }

  /**
   * Creates and assigns or merges an Identity object used to identify with the gateway.
   * @private
   *
   * @param {string} token Discord token.
   * @param {Object<string, any>} identity An object containing information for identifying with the gateway. https://discordapp.com/developers/docs/topics/gateway#identify-identify-structure
   */
  assignIdentity(token, identity) {
    this.identity = new Identity(token, identity);
  }

  /**
   * Binds `this` to certain methods so that they are able to be called in `setInterval()` and `setTimeout()`.
   * @private
   */
  bindTimerFunctions() {
    this.login = this.login.bind(this);
    this.heartbeat = this.heartbeat.bind(this);
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

  /*
   ********************************
   ********* RPC SERVICE **********
   ********************************
   */

  /**
   * Adds the service that will acquire a lock from a server(s) before identifying.
   *
   * @param  {...ServerOptions} serverOptions A number of options for conencting this service to the server.
   * The order these are in is the order that the locks must be acquired.
   */
  addIdentifyLockService(...serverOptions) {
    const [lockOptions1, lockOptions2] = serverOptions;

    this.identifyLock_1 = new IdentifyLockService(lockOptions1);
    this.identifyLockAllowFallback_1 = lockOptions1.allowFallback;
    this.validateLockOptions(lockOptions1);
    this.identifyLockDuration_1 = lockOptions1.duration;
    let message = `Rpc service created for identify coordination. Connected to: ${this.identifyLock_1.target}`;

    if (lockOptions2 !== undefined) {
      this.identifyLock_2 = new IdentifyLockService(lockOptions2);
      this.validateLockOptions(lockOptions2);
      this.identifyLockDuration_2 = lockOptions1.duration;
      message = `2 rpc services created for identify coordination. First: ${this.identifyLock_1.target}. Second: ${this.identifyLock_2.target}`;
      this.identifyLockAllowFallback_2 = lockOptions2.allowFallback;
    }

    this.log("INFO", message);
  }

  /**
   * Verifies parameters to set lock are valid.
   *
   * @param {*} options
   */
  validateLockOptions(options) {
    const { duration } = options;
    if (typeof duration !== "number" && duration <= 0) {
      throw Error("Lock duration must be a number larger than 0.");
    }
  }

  /*
   ********************************
   ************ PUBLIC ************
   ********************************
   */

  /**
   * Sends a `Request Guild Members` websocket message.
   *
   * @param {string} guildId Id of the guild to request members from.
   * @param {Object} options Additional options to send with the request. Mirrors the remaining fields in the docs: https://discordapp.com/developers/docs/topics/gateway#request-guild-members
   * @param {string} [options.query] "string that username starts with, or an empty string to return all members"
   * @param {number} [options.limit] "maximum number of members to send matching the query; a limit of 0 can be used with an empty string query to return all members"
   * @param {boolean} [options.presences] "used to specify if we want the presences of the matched members"
   * @param {Array<string>} [options.user_ids] "used to specify which users you wish to fetch"
   */
  requestGuildMembers(guildId, options = {}) {
    const defaults = { limit: 0, query: "", presences: false, user_ids: [] };

    for (const [k, v] of Object.entries(defaults)) {
      if (options[k] === undefined) {
        options[k] = v;
      }
    }

    return this.send(GATEWAYOPCODES.REQUEST_GUILD_MEMBERS, {
      guild_id: guildId,
      ...options
    });
  }

  /**
   * Connects to Discord's event gateway.
   *
   * @param {import("ws")} [_Websocket] Ignore. For unittest dependency injection only.
   */
  async login(_Websocket = ws) {
    if (this.loggingIn || this.wsUrl !== undefined) {
      const message = `Client is currently trying to log in or is already identified.`;
      this.log("ERROR", message);
    }

    this.loggingIn = true;

    try {
      if (this.wsUrl === true) {
        throw Error("gateway already logged in");
      }

      try {
        this.wsUrl = await this.getWebsocketUrl();

        if (this.wsUrl === undefined) {
          return;
        }

        this.log("DEBUG", `Connecting to url: ${this.wsUrl}`);

        this.ws = new _Websocket(this.wsUrl, { maxPayload: GIGABYTEINBYTES });
        this.assignWebsocketMethods();
      } catch (err) {
        if (err.response) {
          console.error(err.response.data.message);
        } else {
          console.error(err);
        }
      }
    } finally {
      this.loggingIn = false;
    }
  }

  /**
   * Obtains the websocket url from Discord's REST API. Will attempt to login again after some time if the return status !== 200 and !== 401.
   * @private
   *
   * @returns {string|void} Url if status === 200; or undefined if status !== 200.
   */
  async getWebsocketUrl() {
    if (this.api === undefined) {
      this.createApiClient();
    }

    const { status, statusText, data } = await this.api.request(
      "get",
      "gateway/bot"
    );

    if (status === 200) {
      const { total, remaining, reset_after } = data.session_start_limit;

      const message = `Login limit: ${total}. Remaining: ${remaining}. Reset after ${reset_after}ms (${new Date(
        new Date().getTime() + reset_after
      )})`;
      this.log("INFO", message);

      return data.url + GATEWAYDEFAULTWSPARAMS;
    } else {
      this.handleBadStatus(status, statusText, data.message, data.code);
    }
  }

  /**
   * Creates a new Api client with default settings.
   * @private
   */
  createApiClient() {
    this.api = new Api(this.identity.token);
    this.api.startQueue();
  }

  /**
   * Emits logging message and sets a timeout to re-attempt login. Throws on 401 status code.
   * @private
   *
   * @param {number} status HTTP status code.
   * @param {string} statusText Status message from Discord.
   * @param {string} dataMessage Discord's error message.
   * @param {number} dataCode Discord's error code.
   */
  handleBadStatus(status, statusText, dataMessage, dataCode) {
    let message = `Failed to get websocket information from API. Status ${status}. Status text: ${statusText}. Discord code: ${dataCode}. Discord message: ${dataMessage}.`;

    if (status !== 401) {
      message += ` Trying again in ${this.wsUrlRetryWait} seconds.`;
      this.log("WARNING", message);

      setTimeout(() => this.login(), this.wsUrlRetryWait);
    } else {
      // 401 is bad token, unable to continue.
      message += " Please check your token.";
      throw Error(message);
    }
  }

  /**
   * Binds `this` to methods used by the websocket.
   * @private
   */
  assignWebsocketMethods() {
    this.ws.onopen = this._onopen.bind(this);
    this.ws.onerror = this._onerror.bind(this);
    this.ws.onclose = this._onclose.bind(this);
    this.ws.onmessage = this._onmessage.bind(this);
  }

  /**
   * Handles emitting events from Discord. Will first pass through `this.emitter.eventHandler` function if one exists.
   * @private
   *
   * @param {string} type Type of event. (e.g. CHANNEL_CREATE) https://discordapp.com/developers/docs/topics/gateway#commands-and-events-gateway-events
   * @param {Object} data Data of the event from Discord.
   */
  async handleEvent(type, data) {
    if (this.emitter.eventHandler !== undefined) {
      data = await this.emitter.eventHandler(type, data);
    }

    if (data !== undefined) {
      this.emit(type, data);
    }
  }

  /**
   * Emits various events through `this.emitter`, both Discord and Api. Will emit all events if `this.events` is undefined; otherwise will only emit those defined as keys in the `this.events` object.
   * @private
   *
   * @param {string} type Type of event. (e.g. "GATEWAY_CLOSE" or "CHANNEL_CREATE")
   * @param {void|Object<string, any>} data Data to send with the event.
   */
  emit(type, data) {
    if (this.emitter !== undefined) {
      this.emitter.emit(type, data);
    }
  }

  /*
   ********************************
   ******* WEBSOCKET - OPEN *******
   ********************************
   */

  /**
   * Assigned to websocket `onopen`.
   * @private
   */
  _onopen() {
    this.log("DEBUG", "Websocket open.");

    this.wsRateLimitCache.remainingRequests = GATEWAYMAXREQUESTSPERMINUTE;
    this.handleEvent("GATEWAY_OPEN", null);
  }

  /*
   ********************************
   ******* WEBSOCKET - CLOSE ******
   ********************************
   */

  /**
   * Assigned to websocket `onerror`.
   * @private
   */
  _onerror(err) {
    this.log("ERROR", `Websocket error. Message: ${err.message}`);
  }

  /*
   ********************************
   ****** WEBSOCKET - CLOSE *******
   ********************************
   */

  /**
   * Assigned to webscoket `onclose`. Cleans up and attempts to re-connect with a fresh connection after waiting some time.
   * @private
   *
   * @param {Object<string, any>} event Object containing information about the close.
   */
  async _onclose(event) {
    this.clearHeartbeat();

    const shouldReconnect = this.handleCloseCode(event.code);

    await this.handleEvent("GATEWAY_CLOSE", null);
    this.wsUrl = undefined;
    if (shouldReconnect) {
      setImmediate(() => this.login());
    }
  }

  /**
   * Uses the close code to determine what message to log and if the client should attempt to reconnect.
   * @private
   *
   * @param {number} code Code that came with the websocket close event.
   * @return {boolean} Whether or not the client should attempt to login again.
   */
  handleCloseCode(code) {
    const {
      CLEAN,
      UNKNOWN_ERROR,
      UNKNOWN_OPCODE,
      DECODE_ERROR,
      NOT_AUTHENTICATED,
      AUTHENTICATION_FAILED,
      ALREADY_AUTHENTICATED,
      SESSION_NO_LONGER_VALID,
      INVALID_SEQ,
      RATE_LIMITED,
      SESSION_TIMEOUT,
      INVALID_SHARD,
      SHARDING_REQUIRED,
      MISSED_HEARTBEAT
    } = GATEWAYCLOSECODE;

    let message;
    let shouldReconnect = true;
    let logLevel;
    if (code === UNKNOWN_ERROR) {
      logLevel = LOGLEVEL.WARNING;
      message = "Discord's not sure what went wrong. Reconnecting.";
    } else if (code === UNKNOWN_OPCODE) {
      logLevel = LOGLEVEL.ERROR;
      message =
        "Sent an invalid Gateway opcode or an invalid payload for an opcode. Don't do that!";
    } else if (code === DECODE_ERROR) {
      logLevel = LOGLEVEL.ERROR;
      message = "Sent an invalid payload. Don't do that!";
    } else if (code === NOT_AUTHENTICATED) {
      logLevel = LOGLEVEL.ERROR;
      message = "Sent a payload prior to identifying. Please login first.";
    } else if (code === AUTHENTICATION_FAILED) {
      logLevel = LOGLEVEL.FATAL;
      message =
        "Account token sent with identify payload is incorrect. Terminating login.";
      shouldReconnect = false;
    } else if (code === ALREADY_AUTHENTICATED) {
      logLevel = LOGLEVEL.ERROR;
      message =
        "Sent more than one identify payload. Stahp. Terminating login.";
      shouldReconnect = false;
    } else if (code === SESSION_NO_LONGER_VALID) {
      logLevel = LOGLEVEL.INFO;
      message =
        "Session is no longer valid. Reconnecting with new session. Also occurs when trying to reconnect with a bad or mismatched token (different than identified with.";
      this.sessionId = undefined;
      this.sequence = 0;
    } else if (code === INVALID_SEQ) {
      message = logLevel = LOGLEVEL.INFO;
      ("Sequence sent when resuming the session was invalid. Reconnecting with a new session.");
    } else if (code === RATE_LIMITED) {
      logLevel = LOGLEVEL.ERROR;
      message =
        "Woah nelly! You're sending payloads too quickly. Slow it down!";
    } else if (code === SESSION_TIMEOUT) {
      logLevel = LOGLEVEL.INFO;
      message = "Session timed out. Reconnecting with a new session.";
    } else if (code === INVALID_SHARD) {
      logLevel = LOGLEVEL.FATAL;
      message = "Sent an invalid shard when identifying. Terminating login.";
      shouldReconnect = false;
    } else if (code === SHARDING_REQUIRED) {
      logLevel = LOGLEVEL.FATAL;
      message =
        "Session would have handled too many guilds - client is required to shard connection in order to connect. Terminating login.";
      shouldReconnect = false;
    } else if (code === MISSED_HEARTBEAT) {
      logLevel = LOGLEVEL.WARNING;
      message = "Missed a heartbeart from Discord.";
    } else if (code === CLEAN) {
      logLevel = LOGLEVEL.INFO;
      message = "Clean close.";
    } else {
      logLevel = LOGLEVEL.INFO;
      message = "Unknown close code.";
    }

    this.emit("DEBUG", {
      source: LOGSOURCE.GATEWAY,
      level: logLevel,
      message: `Websocket closed. Code: ${code}. Reason: ${message}`
    });

    return shouldReconnect;
  }

  /**
   * Unsets heartbeat values and clears the heartbeatinterval.
   * @private
   */
  clearHeartbeat() {
    clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = undefined;
    this.heartbeatAck = undefined;
  }

  /*
   ********************************
   ****** WEBSOCKET MESSAGE *******
   ********************************
   */

  /**
   * Assigned to websocket `onmessage`.
   * @private
   */
  _onmessage(m) {
    this.handleMessage(JSON.parse(m.data));
  }

  /**
   * Processes incoming messages from Discord's gateway.
   * @private
   *
   * @param {Object} p Packet from Discord. https://discordapp.com/developers/docs/topics/gateway#payloads-gateway-payload-structure
   */
  handleMessage(p) {
    const { t: type, s: sequence, op: opCode, d: data } = p;

    if (opCode === GATEWAYOPCODES.DISPATCH) {
      if (type === "READY") {
        this.handleReady(data);
      } else if (type === "RESUMED") {
        this.handleResumed();
      } else {
        setImmediate(() => this.handleEvent(type, data));
      }
    } else if (opCode === GATEWAYOPCODES.HELLO) {
      this.handleHello(data);
    } else if (opCode === GATEWAYOPCODES.HEARTBEAT_ACK) {
      this.handleHeartbeatAck();
    } else if (opCode === GATEWAYOPCODES.HEARTBEAT) {
      this.send(GATEWAYOPCODES.HEARTBEAT, 0);
    } else if (opCode === GATEWAYOPCODES.INVALID_SESSION) {
      this.handleInvalidSession(data);
    } else if (opCode === GATEWAYOPCODES.RECONNECT) {
      this.log("INFO", `Gateway has requested the client reconnect.`);

      this.ws.close(GATEWAYCLOSECODE.CLEAN);
    } else {
      this.log("WARNING", `Unhandled packet. op: ${opCode} | data: ${data}`);

      this.updateSequence(sequence);
    }
  }

  /**
   * Handles "Ready" packet from Discord. https://discordapp.com/developers/docs/topics/gateway#ready
   * @private
   *
   * @param {Object} data From Discord.
   */
  handleReady(data) {
    this.log("INFO", `Received Ready. Session ID: ${data.session_id}.`);

    this.sessionId = data.session_id;
    this.sequence = 0;

    this.handleEvent("READY", data);
  }

  /**
   * Handes "Resumed" packet from Discord. https://discordapp.com/developers/docs/topics/gateway#resumed
   * @private
   */
  handleResumed() {
    this.log("INFO", "Replay finished. Resuming events.");

    this.handleEvent("RESUMED", null);
  }

  /**
   * Handles "Hello" packet from Discord. Start heartbeats and identifies with gateway. https://discordapp.com/developers/docs/topics/gateway#connecting-to-the-gateway
   * @private
   *
   * @param {Object} data From Discord.
   */
  handleHello(data) {
    this.log("DEBUG", `Received Hello. ${JSON.stringify(data)}.`);
    this.startHeartbeat(data.heartbeat_interval);
    this.connect(this.resumable);

    this.handleEvent("HELLO", data);
  }

  /**
   * Starts heartbeating. https://discordapp.com/developers/docs/topics/gateway#heartbeating
   * @private
   *
   * @param {number} heartbeatInterval From Discord - Number of ms to wait between sending heartbeats.
   */
  startHeartbeat(heartbeatInterval) {
    this.heartbeatAck = true;
    this.heartbeatInterval = setInterval(this.heartbeat, heartbeatInterval);
  }

  /**
   * Checks if heartbeat ack was received. If not, closes gateway connection. If so, send a heartbeat.
   * @private
   */
  heartbeat() {
    if (this.heartbeatAck === false) {
      this.ws.close(GATEWAYCLOSECODE.MISSED_HEARTBEAT);
    } else {
      this.lastHeartbeatTimestamp = new Date().getTime();
      this.heartbeatAck = false;
      this.send(GATEWAYOPCODES.HEARTBEAT, 0);
    }
  }

  /**
   * Handles "Heartbeat ACK" packet from Discord. https://discordapp.com/developers/docs/topics/gateway#heartbeating
   * @private
   */
  handleHeartbeatAck() {
    this.heartbeatAck = true;
    this.handleEvent("HEARTBEAT_ACK", null);

    const message = `Heartbeat acknowledged. Latency: ${new Date().getTime() -
      this.lastHeartbeatTimestamp}ms`;
    this.log("DEBUG", message);
  }

  /**
   * Connects to gateway.
   * @private
   */
  connect(resume) {
    if (resume) {
      this.resume();
    } else {
      this.identify();
    }
  }

  /**
   * Sends a "Resume" payload to Discord's gateway.
   * @private
   */
  resume() {
    const message = `Attempting to resume connection. Session_id: ${this.sessionId}. Sequence: ${this.sequence}`;
    this.log("INFO", message);

    const payload = {
      token: this.token,
      session_id: this.sessionId,
      seq: this.sequence
    };

    this.handleEvent("GATEWAY_RESUME", payload);

    this.send(GATEWAYOPCODES.RESUME, payload);
  }

  /**
   * Sends an "Identify" payload.
   * @private
   */
  async identify() {
    this.sessionId = undefined;
    this.sequence = 0;

    if (this.identifyLock_1) {
      const receivedLocks = await this.acquireLocks();
      if (!receivedLocks) {
        return;
      }
    }

    if (this.shard) {
      this.log(
        "INFO",
        `Identifying as shard: ${this.shard[0]}/${this.shard[1] - 1}`
      );
    }

    this.handleEvent("GATEWAY_IDENTIFY", this.identity);

    this.send(GATEWAYOPCODES.IDENTIFY, this.identity);
  }

  /**
   * Attempts to acquire the necessary locks for identifying.
   * @private
   * @returns {boolean} true if acquires locks; false if not.
   */
  async acquireLocks() {
    let success = await this.acquireFirstLock();

    if (success && this.identifyLock_2 !== undefined) {
      success = await this.acquireSecondLock();
    }

    return success;
  }

  // TODO(lando): There's surely a more elegant way to handle this. Perhaps an array of locks that must be acquired in succession.

  /**
   * Attempts to acquire the first lock.
   * @private
   * @returns {boolean} true if the lock was acquired; false if not.
   */
  async acquireFirstLock() {
    try {
      const { token, message } = await this.acquireIdentifyLock(
        this.identifyLock_1,
        this.identifyLockDuration_1,
        this.identifyLockToken_1
      );

      if (token !== undefined) {
        this.identifyLockToken_1 = token;
        return true;
      } else {
        this.log(
          "DEBUG",
          `Was not able to acquire lock 1. Message: ${message}`
        );

        return false;
      }
    } catch (err) {
      if (err.code === 14 && this.identifyLockAllowFallback_1) {
        return true;
      } else {
        throw err;
      }
    }
  }

  /**
   * Attempts to acquire the second lock.
   * @private
   * @returns {boolean} true if the lock was acquired; false if not.
   */
  async acquireSecondLock() {
    try {
      const { token, message: message_a } = await this.acquireIdentifyLock(
        this.identifyLock_2,
        this.identifyLockDuration_2,
        this.identifyLockToken_2
      );

      if (token !== undefined) {
        this.identifyLockToken_2 = token;
        return true;
      } else {
        this.log(
          "DEBUG",
          `Was not able to acquire lock 2. Message: ${message_a}`
        );

        const message_r = await this.releaseIdentifyLock(
          this.identifyLock_1,
          this.identifyLockToken_1
        );

        if (message_r !== undefined) {
          this.log(
            "DEBUG",
            `Was not able to release lock 1. Message: ${message_r}`
          );
        }

        return false;
      }
    } catch (err) {
      if (err.code === 14 && this.identifyLockAllowFallback_1) {
        return true;
      } else {
        throw err;
      }
    }
  }

  /**
   * Attempts to acquire the identity lock when identifying. If fails, sets client to attempt again in 1 second.
   * @private
   * @returns {boolean} true if acquired lock; false if not.
   */
  async acquireIdentifyLock(lock, timeOut, token) {
    const { success, token: newToken, message } = await lock.acquire(
      timeOut,
      token
    );

    if (success !== true) {
      setTimeout(() => this.identify(), SECONDINMILLISECONDS);
    }

    return { token: newToken, message };
  }

  /**
   * Releases the identity lock.
   * @private
   * @returns {boolean} true if acquired lock; false if not.
   */
  async releaseIdentifyLock(lock, token) {
    const { message } = await lock.release(token);
    return message;
  }

  /**
   * Sends a websocket message to Discord.
   * @private
   *
   * @param {number} op Gateway Opcode https://discordapp.com/developers/docs/topics/opcodes-and-status-codes#gateway-gateway-opcodes
   * @param {Object} data Data of the message.
   * @returns {boolean} true if the packet was sent; false if the packet was not due to rate limiting or websocket not open.
   */
  send(op, data) {
    if (
      this.canSendPacket(op) &&
      this.ws !== undefined &&
      this.ws.readyState === ws.OPEN
    ) {
      const safeData = { ...data };
      if (safeData.token !== undefined) {
        safeData.token = "<truncated>";
      }

      const message = `Sending payload:  ${JSON.stringify({
        op,
        d: safeData
      })}`;

      this.log("DEBUG", message);

      const packet = JSON.stringify({ op, d: data });
      this.ws.send(packet);

      this.updateWsRateLimit();

      return true;
    }

    return false;
  }

  /**
   * Returns whether or not the message to be sent will exceed the ratelimit or not, taking into account padded buffers for high priority packets (e.g. heartbeats, resumes).
   * @private
   *
   * @param {number} op Op code of the message to be sent.
   * @returns {boolean} true if sending message won't exceed ratelimit or padding; false if it will
   */
  canSendPacket(op) {
    const now = new Date().getTime();

    if (now >= this.wsRateLimitCache.resetTimestamp) {
      this.wsRateLimitCache.remainingRequests = GATEWAYMAXREQUESTSPERMINUTE;
      return true;
    } else if (
      this.wsRateLimitCache.remainingRequests >= GATEWAYREQUESTBUFFER
    ) {
      return true;
    } else if (
      this.wsRateLimitCache.remainingRequests <= GATEWAYREQUESTBUFFER &&
      (op === GATEWAYOPCODES.HEARTBEAT || op === GATEWAYOPCODES.RECONNECT)
    ) {
      return true;
    } else {
      return false;
    }
  }

  /**
   * Updates the rate limit cache upon sending a websocket message, resetting it if enough time has passed
   * @private
   */
  updateWsRateLimit() {
    if (
      this.wsRateLimitCache.remainingRequests === GATEWAYMAXREQUESTSPERMINUTE
    ) {
      this.wsRateLimitCache.resetTimestamp =
        new Date().getTime() + MINUTEINMILLISECONDS;
    }

    --this.wsRateLimitCache.remainingRequests;
  }

  /**
   * Handles "Invalid Session" packet from Discord. Will attempt to resume a connection if Discord allows it and there is already a sessionId and sequence.
   * Otherwise, will send a new identify payload. https://discordapp.com/developers/docs/topics/gateway#invalid-session
   * @private
   *
   * @param {boolean} resumable Whether or not Discord has said that the connection as able to be resumed.
   */
  handleInvalidSession(resumable) {
    this.log(
      "INFO",
      `Received Invalid Session packet. Resumable: ${resumable}`
    );

    this.handleEvent("INVALID_SESSION", resumable);
    this.connect(resumable && this.resumable);
  }

  /**
   * Updates the sequence value of Discord's gateway if it's larger than the current.
   * @private
   *
   * @param {number} s Sequence value from Discord.
   */
  updateSequence(s) {
    if (s > this.sequence + 1) {
      this.log(
        "WARNING",
        `Non-consecutive sequence (${this.sequence} -> ${s})`
      );
    }

    if (s > this.sequence) {
      this.sequence = s;
    }
  }
};
