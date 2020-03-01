'use strict';

const ws = require('ws');
const { EventEmitter } = require('events');
const Api = require('../Api');
const Utils = require('../../utils/Utils');
const Identity = require('./structures/Identity');
const { IdentifyLockService } = require('../../rpc/services');

const {
  SECOND_IN_MILLISECONDS,
  MINUTE_IN_MILLISECONDS,
  GIGABYTE_IN_BYTES,
  GATEWAY_DEFAULT_WS_PARAMS,
  GATEWAY_OP_CODES,
  GATEWAY_CLOSE_CODES,
  GATEWAY_MAX_REQUESTS_PER_MINUTE,
  GATEWAY_REQUEST_BUFFER,
  LOG_LEVELS,
  LOG_SOURCES,
} = require('../../utils/constants');

/**
 * @typedef {Object<string, number>} WebsocketRateLimitCache Information about the current request count and time that it should reset in relation to Discord rate limits. https://discordapp.com/developers/docs/topics/gateway#rate-limiting
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
    /** @type {boolean} If the gateway client is currently in the process of getting the ws url to connect. */
    this.loggingIn;

    /** @type {Api} Client through which to make REST api calls to Discord. */
    this.api;
    /** @type {void|IdentifyLockService} Rpc service through which to coordinate identifies with other shards. Will not be released except by time out. Best used for global minimum wait time. */
    this.mainIdentifyLock;
    /** @type {void|IdentifyLockService[]} Rpc service through which to coordinate identifies with other shards. */
    this.identifyLocks;

    /** @type {ws} Websocket used to connect to gateway. */
    this.ws;
    /** @type {string} From Discord - Websocket URL instructed to connect to. Also used to indicate it the client has an open websocket. */
    this.wsUrl;
    /** @type  {number} Time to wait between this client's attempts to connect to the gateway in seconds. */
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
    /** @type {NodeJS.Timer} Interval that checks and sends heartbeats. */
    this.heartbeatInterval;

    /** @type {import("events").EventEmitter} Emitter for gateway and Api events. Will create a default if not provided via the options. */
    this.emitter;
    /** @type {Object<string,string>} Key:Value mapping DISCORD_EVENT to user's preferred emitted value. */
    this.events;

    /** @type {Identity} Object passed to Discord when identifying. */
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

  get token() {
    return this.identity.token;
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
    Gateway.validateParams(token, options);

    const defaults = {
      emitter: options.emitter || new EventEmitter(),
      sequence: 0,
      wsRateLimitCache: {
        remainingRequests: GATEWAY_MAX_REQUESTS_PER_MINUTE,
        resetTimestamp: 0,
      },
      identifyLocks: [],
      ...options,
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
  static validateParams(token, options) {
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
  log(level, message, data = {}) {
    data.shard = this.shard;
    this.emit('DEBUG', {
      source: LOG_SOURCES.API,
      level: LOG_LEVELS[level],
      message,
      data,
    });
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
   ********* RPC SERVICE **********
   ********************************
   */

  /**
   * Adds the service that will acquire a lock from a server(s) before identifying.
   *
   * @param  {void|ServerOptions} mainServerOptions Options for connecting this service to the identifylock server. Will not be released except by time out. Best used for global minimum wait time. Pass `null` to ignore.
   * @param  {ServerOptions} [serverOptions] Options for connecting this service to the identifylock server. Will be acquired and released in order.
   */
  addIdentifyLockServices(mainServerOptions, ...serverOptions) {
    if (mainServerOptions !== null) {
      this.mainIdentifyLock = this.configureLockService(mainServerOptions);
    }

    if (serverOptions.length) {
      serverOptions.forEach((options) => {
        this.identifyLocks.push(this.configureLockService(options));
      });
    }
  }

  configureLockService(serverOptions) {
    const identifyLock = new IdentifyLockService(serverOptions);
    Gateway.validateLockOptions(serverOptions);

    identifyLock.allowFallback = serverOptions.allowFallback;
    identifyLock.duration = serverOptions.duration;
    const message = `Rpc service created for identify coordination. Connected to: ${identifyLock.target}. Default duration of lock: ${identifyLock.duration}`;
    this.log('INFO', message);

    return identifyLock;
  }

  /**
   * Verifies parameters to set lock are valid.
   *
   * @param {*} options
   */
  static validateLockOptions(options) {
    const { duration } = options;
    if (typeof duration !== 'number' && duration <= 0) {
      throw Error('Lock duration must be a number larger than 0.');
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
    const defaults = {
      limit: 0, query: '', presences: false, user_ids: [],
    };

    for (const [k, v] of Object.entries(defaults)) {
      if (options[k] === undefined) {
        options[k] = v;
      }
    }

    return this.send(GATEWAY_OP_CODES.REQUEST_GUILD_MEMBERS, {
      guild_id: guildId,
      ...options,
    });
  }

  /**
   * Connects to Discord's event gateway.
   *
   * @param {import("ws")} [_Websocket] Ignore. For unittest dependency injection only.
   */
  async login(_Websocket = ws) {
    if (this.loggingIn || this.wsUrl !== undefined) {
      const message = 'Client is currently trying to log in or is already identified.';
      this.log('ERROR', message);
    }

    this.loggingIn = true;

    try {
      if (this.wsUrl === true) {
        throw Error('gateway already logged in');
      }

      try {
        this.wsUrl = await this.getWebsocketUrl();

        if (this.wsUrl === undefined) {
          return;
        }

        this.log('DEBUG', `Connecting to url: ${this.wsUrl}`);

        this.ws = new _Websocket(this.wsUrl, { maxPayload: GIGABYTE_IN_BYTES });
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
      'get',
      'gateway/bot',
    );

    if (status === 200) {
      const { total, remaining, reset_after } = data.session_start_limit;

      const message = `Login limit: ${total}. Remaining: ${remaining}. Reset after ${reset_after}ms (${new Date(
        new Date().getTime() + reset_after,
      )})`;
      this.log('INFO', message);

      return data.url + GATEWAY_DEFAULT_WS_PARAMS;
    }
    this.handleBadStatus(status, statusText, data.message, data.code);

    return undefined;
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
      this.log('WARNING', message);

      setTimeout(() => this.login(), this.wsUrlRetryWait);
    } else {
      // 401 is bad token, unable to continue.
      message += ' Please check your token.';
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
      data = await this.emitter.eventHandler(type, data, this.shard);
    }

    if (data !== undefined) {
      this.emit(type, data, this.shard);
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
    this.log('DEBUG', 'Websocket open.');

    this.wsRateLimitCache.remainingRequests = GATEWAY_MAX_REQUESTS_PER_MINUTE;
    this.handleEvent('GATEWAY_OPEN', null);
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
    this.log('ERROR', `Websocket error. Message: ${err.message}`);
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

    await this.handleEvent('GATEWAY_CLOSE', { shouldReconnect, gateway: this });
    this.wsUrl = undefined;
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
      ABNORMAL_CLOSE,
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
      INVALID_VERSION,
      INVALID_INTENT,
      DISALLOWED_INTENT,
      HEARTBEAT_TIMEOUT,
    } = GATEWAY_CLOSE_CODES;

    let message;
    let shouldReconnect = true;
    let level;
    if (code === ABNORMAL_CLOSE) {
      level = LOG_LEVELS.INFO;
      message = 'Abnormal close. Reconnecting.';
    } else if (code === UNKNOWN_ERROR) {
      level = LOG_LEVELS.WARNING;
      message = "Discord's not sure what went wrong. Reconnecting.";
    } else if (code === UNKNOWN_OPCODE) {
      level = LOG_LEVELS.ERROR;
      message = "Sent an invalid Gateway opcode or an invalid payload for an opcode. Don't do that!";
    } else if (code === DECODE_ERROR) {
      level = LOG_LEVELS.ERROR;
      message = "Sent an invalid payload. Don't do that!";
    } else if (code === NOT_AUTHENTICATED) {
      level = LOG_LEVELS.ERROR;
      message = 'Sent a payload prior to identifying. Please login first.';
    } else if (code === AUTHENTICATION_FAILED) {
      level = LOG_LEVELS.FATAL;
      message = 'Account token sent with identify payload is incorrect. Terminating login.';
      shouldReconnect = false;
    } else if (code === ALREADY_AUTHENTICATED) {
      level = LOG_LEVELS.ERROR;
      message = 'Sent more than one identify payload. Stahp. Terminating login.';
      shouldReconnect = false;
    } else if (code === SESSION_NO_LONGER_VALID) {
      level = LOG_LEVELS.INFO;
      message = 'Session is no longer valid. Reconnecting with new session. Also occurs when trying to reconnect with a bad or mismatched token (different than identified with).';
      this.sessionId = undefined;
      this.sequence = 0;
    } else if (code === INVALID_SEQ) {
      message = 'Sequence sent when resuming the session was invalid. Reconnecting with a new session.';
      level = LOG_LEVELS.INFO;
    } else if (code === RATE_LIMITED) {
      level = LOG_LEVELS.ERROR;
      message = "Woah nelly! You're sending payloads too quickly. Slow it down!";
    } else if (code === SESSION_TIMEOUT) {
      level = LOG_LEVELS.INFO;
      message = 'Session timed out. Reconnecting with a new session.';
    } else if (code === INVALID_SHARD) {
      level = LOG_LEVELS.FATAL;
      message = 'Sent an invalid shard when identifying. Terminating login.';
      shouldReconnect = false;
    } else if (code === SHARDING_REQUIRED) {
      level = LOG_LEVELS.FATAL;
      message = 'Session would have handled too many guilds - client is required to shard connection in order to connect. Terminating login.';
      shouldReconnect = false;
    } else if (code === INVALID_VERSION) {
      message = 'You sent an invalid version for the gateway.';
      shouldReconnect = false;
    } else if (code === INVALID_INTENT) {
      message = 'You sent an invalid intent for a Gateway Intent. You may have incorrectly calculated the bitwise value.';
      shouldReconnect = false;
    } else if (code === DISALLOWED_INTENT) {
      message = 'You sent a disallowed intent for a Gateway Intent. You may have tried to specify an intent that you have not enabled or are not whitelisted for';
      shouldReconnect = false;
    } else if (code === HEARTBEAT_TIMEOUT) {
      level = LOG_LEVELS.WARNING;
      message = 'Heartbeat Ack not received from Discord in time.';
    } else if (code === CLEAN) {
      level = LOG_LEVELS.INFO;
      message = 'Clean close.';
    } else {
      level = LOG_LEVELS.INFO;
      message = 'Unknown close code.';
    }

    this.emit('DEBUG', {
      source: LOG_SOURCES.GATEWAY,
      level,
      message: `Websocket closed. Code: ${code}. Reason: ${message}`,
    });

    return shouldReconnect;
  }

  /**
   * Clears heartbeat values and clears the heartbeatinterval.
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
    const {
      t: type, s: sequence, op: opCode, d: data,
    } = p;

    if (opCode === GATEWAY_OP_CODES.DISPATCH) {
      if (type === 'READY') {
        this.handleReady(data);
      } else if (type === 'RESUMED') {
        this.handleResumed();
      } else {
        setImmediate(() => this.handleEvent(type, data));
      }
    } else if (opCode === GATEWAY_OP_CODES.HELLO) {
      this.handleHello(data);
    } else if (opCode === GATEWAY_OP_CODES.HEARTBEAT_ACK) {
      this.handleHeartbeatAck();
    } else if (opCode === GATEWAY_OP_CODES.HEARTBEAT) {
      this.send(GATEWAY_OP_CODES.HEARTBEAT, 0);
    } else if (opCode === GATEWAY_OP_CODES.INVALID_SESSION) {
      this.handleInvalidSession(data);
    } else if (opCode === GATEWAY_OP_CODES.RECONNECT) {
      this.log('INFO', 'Gateway has requested the client reconnect.');

      this.ws.close(GATEWAY_CLOSE_CODES.CLEAN);
    } else {
      this.log('WARNING', `Unhandled packet. op: ${opCode} | data: ${data}`);
    }

    this.updateSequence(sequence);
  }

  /**
   * Handles "Ready" packet from Discord. https://discordapp.com/developers/docs/topics/gateway#ready
   * @private
   *
   * @param {Object} data From Discord.
   */
  handleReady(data) {
    this.log('INFO', `Received Ready. Session ID: ${data.session_id}.`);

    this.sessionId = data.session_id;
    this.sequence = 0;

    this.handleEvent('READY', data);
  }

  /**
   * Handles "Resumed" packet from Discord. https://discordapp.com/developers/docs/topics/gateway#resumed
   * @private
   */
  handleResumed() {
    this.log('INFO', 'Replay finished. Resuming events.');

    this.handleEvent('RESUMED', null);
  }

  /**
   * Handles "Hello" packet from Discord. Start heartbeats and identifies with gateway. https://discordapp.com/developers/docs/topics/gateway#connecting-to-the-gateway
   * @private
   *
   * @param {Object} data From Discord.
   */
  handleHello(data) {
    this.log('DEBUG', `Received Hello. ${JSON.stringify(data)}.`);
    this.startHeartbeat(data.heartbeat_interval);
    this.connect(this.resumable);

    this.handleEvent('HELLO', data);
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
      this.ws.close(GATEWAY_CLOSE_CODES.HEARTBEAT_TIMEOUT);
    } else {
      this.lastHeartbeatTimestamp = new Date().getTime();
      this.heartbeatAck = false;
      this.send(GATEWAY_OP_CODES.HEARTBEAT, 0);
    }
  }

  /**
   * Handles "Heartbeat ACK" packet from Discord. https://discordapp.com/developers/docs/topics/gateway#heartbeating
   * @private
   */
  handleHeartbeatAck() {
    this.heartbeatAck = true;
    this.handleEvent('HEARTBEAT_ACK', null);

    const message = `Heartbeat acknowledged. Latency: ${new Date().getTime()
      - this.lastHeartbeatTimestamp}ms`;
    this.log('DEBUG', message);
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
    this.log('INFO', message);

    const payload = {
      token: this.token,
      session_id: this.sessionId,
      seq: this.sequence,
    };

    this.handleEvent('GATEWAY_RESUME', payload);

    this.send(GATEWAY_OP_CODES.RESUME, payload);
  }

  /**
   * Sends an "Identify" payload.
   * @private
   */
  async identify() {
    this.sessionId = undefined;
    this.sequence = 0;

    const acquiredLocks = await this.acquireLocks();
    if (!acquiredLocks) {
      setTimeout(() => this.identify(), SECOND_IN_MILLISECONDS);
      return;
    }

    if (this.shard) {
      this.log(
        'INFO',
        `Identifying as shard: ${this.identity.shard[0]}/${this.identity.shard[1] - 1}`,
      );
    }

    this.handleEvent('GATEWAY_IDENTIFY', this.identity);

    this.send(GATEWAY_OP_CODES.IDENTIFY, this.identity);
  }

  /**
   * Attempts to acquire all the necessary locks to identify.
   * @private
   * @returns {boolean} `true` if acquired locks; `false` if not.
   */
  async acquireLocks() {
    if (this.identifyLocks !== undefined) {
      const acquiredLocks = await this.acquireIdentifyLocks();

      if (!acquiredLocks) {
        return false;
      }
    }

    if (this.mainIdentifyLock !== undefined) {
      const acquiredLock = await this.acquireIdentifyLock(this.mainIdentifyLock);
      if (!acquiredLock) {
        if (this.identifyLocks !== undefined) {
          this.identifyLocks.forEach((l) => Gateway.releaseIdentifyLock(l));
        }

        return false;
      }
    }

    return true;
  }

  /**
   * Attempts to acquire all the non-main identify locks in succession, releasing if one fails.
   * @private
   * @returns {boolean} `true` if acquired locks; `false` if not.
   */
  async acquireIdentifyLocks() {
    if (this.identifyLocks !== undefined) {
      /** @type {IdentifyLockService[]} */
      const acquiredLocks = [];

      for (let i = 0; i < this.identifyLocks.length; ++i) {
      /** @type {IdentifyLockService} */
        const lock = this.identifyLocks[i]; // for intellisense

        const acquiredLock = await this.acquireIdentifyLock(lock);
        if (acquiredLock) {
          acquiredLocks.push(lock);
        } else {
          acquiredLocks.forEach((l) => Gateway.releaseIdentifyLock(l));
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Attempts to acquire an identify lock.
   * @private
   *
   * @param {IdentifyLockService} lock Lock to acquire.
   * @returns {boolean} `true` if acquired lock (or fallback); `false` if not.
   */
  async acquireIdentifyLock(lock) {
    try {
      const { success, message: err } = await lock.acquire();

      if (!success) {
        this.log('DEBUG', `Was not able to acquire lock. Message: ${err}`);
        return false;
      }

      return true;
    } catch (err) {
      this.log('WARNING', `Was not able to connect to lock server to acquire lock: ${lock.target}. Fallback allowed: ${lock.allowFallback}`);

      if (err.code === 14 && lock.allowFallback) {
        if (err !== undefined) {
          return false;
        }
        return true;
      }

      throw err;
    }
  }

  /**
   * Releases all non-main identity locks.
   * @private
   */
  async releaseIdentifyLocks() {
    if (this.identifyLocks.length) {
      this.identifyLocks.forEach((l) => {
        if (l.token !== undefined) this.releaseIdentifyLock(l);
      });
    }
  }

  /**
   * Releases the identity lock.
   * @private
   *
   * @param {IdentifyLockService} lock Lock to release.
   */
  async releaseIdentifyLock(lock) {
    try {
      const { message: err } = await lock.release();
      lock.token = undefined;

      if (err !== undefined) {
        this.log('DEBUG', `Was not able to release lock. Message: ${err}`);
      }
    } catch (err) {
      this.log('WARNING', `Was not able to connect to lock server to release lock: ${lock.target}.}`);

      if (err.code !== 14) {
        throw err;
      }
    }
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
      this.canSendPacket(op)
      && this.ws !== undefined
      && this.ws.readyState === ws.OPEN
    ) {
      const message = 'Sending payload.';
      this.log('DEBUG', message, { payload: Utils.clone(data) });

      const packet = JSON.stringify({ op, d: data });
      this.ws.send(packet);

      this.updateWsRateLimit();

      return true;
    }

    const message = 'Failed to send payload.';
    this.log('DEBUG', message, { payload: Utils.clone(data) });

    return false;
  }

  /**
   * Returns whether or not the message to be sent will exceed the rate limit or not, taking into account padded buffers for high priority packets (e.g. heartbeats, resumes).
   * @private
   *
   * @param {number} op Op code of the message to be sent.
   * @returns {boolean} true if sending message won't exceed rate limit or padding; false if it will
   */
  canSendPacket(op) {
    const now = new Date().getTime();

    if (now >= this.wsRateLimitCache.resetTimestamp) {
      this.wsRateLimitCache.remainingRequests = GATEWAY_MAX_REQUESTS_PER_MINUTE;
      return true;
    } if (
      this.wsRateLimitCache.remainingRequests >= GATEWAY_REQUEST_BUFFER
    ) {
      return true;
    } if (
      this.wsRateLimitCache.remainingRequests <= GATEWAY_REQUEST_BUFFER
      && (op === GATEWAY_OP_CODES.HEARTBEAT || op === GATEWAY_OP_CODES.RECONNECT)
    ) {
      return true;
    }
    return false;
  }

  /**
   * Updates the rate limit cache upon sending a websocket message, resetting it if enough time has passed
   * @private
   */
  updateWsRateLimit() {
    if (
      this.wsRateLimitCache.remainingRequests === GATEWAY_MAX_REQUESTS_PER_MINUTE
    ) {
      this.wsRateLimitCache.resetTimestamp = new Date().getTime() + MINUTE_IN_MILLISECONDS;
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
      'INFO',
      `Received Invalid Session packet. Resumable: ${resumable}`,
    );

    this.handleEvent('INVALID_SESSION', resumable);
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
        'WARNING',
        `Non-consecutive sequence (${this.sequence} -> ${s})`,
      );
    }

    if (s > this.sequence) {
      this.sequence = s;
    }
  }
};
