"use strict";
const ws = require("ws");
const axios = require("axios");
const Redis = require("ioredis");
const Util = require("./util/Util");
const Identity = require("./structures/Identity");
const {
  GATEWAYURLPARAMS,
  DISCORDURI,
  OPCODES,
  WEBSOCKETURIFAILRETRY,
  MINIMUMIDENTIFYWAIT,
  GIGABYTEINBYTES,
  SECONDINMILLISECONDS
} = require("./util/constants");

/** A client to handle all gateway communication and connection maintenence. */
module.exports = class Gateway {
  /**
   * Creates a new Discord gateway handler.
   *
   * @param {import("events").EventEmitter} emitter Emitter through which Ripcord and Discord gateway events are sent.
   * @param {Object} config Configuration items for this handler.
   * @param {string} config.token Discord bot token. Will be coerced into a bot token.
   * @param {Object<string,string>} [config.events] Key:Value mapping DISCORD_EVENT to user's preferred emitted name.
   * @param {[number,number]} [config.shard] [ShardId, ShardCount] to identify with.
   * @param {string} [config.redisIdentityKey="Discord Bot"] Redis key used to mitigate overlapping shard identify's.
   * @param {import("./structures/Identity")} [config.identity] Details to use when identifying with Discord's gateway.
   * @param {Object} [config.remoteRedisConfig] Configuration settings passed to remote Redis constructor.
   * @param {Object} [config.localRedisConfig] Configuration settings passed to local Redis constructor.
   */
  constructor(emitter, config) {
    /** @type {boolean} If the one-time setup has been completed. */
    this.redisInitialized;
    /** @type {import("axios").AxiosInstance)} Isolated axios instance. */
    this.http;

    /** @type {ws} Websocket used to connect to gateway. */
    this.ws;
    /** @type {string} From Discord - Websocket URL instructed to connect to. */
    this.wsUrl;
    this.websocketRetryWaitTimeout;

    /** @type {number} From Discord - Most recent event sequence id received. https://discordapp.com/developers/docs/topics/gateway#payloads */
    this.sequence;
    /** @type {string)} From Discord - ID of this gateway connection. https://discordapp.com/developers/docs/topics/gateway#ready-ready-event-fields */
    this.sessionId;
    /** @type {boolean} If the last heartbeat packet sent to Discord received an ACK. */
    this.heartbeatAck;
    /** @type {number} Time when last heartbeat packet was sent in ms. */
    this.lastHeartbeatTimestamp;

    /** @type {import("events").EventEmitter} for gateway and Ripcord events. */
    this.emitter;
    /** @type {<string,string>} Key:Value mapping DISCORD_EVENT to user's preferred emitted value. */
    this.events;

    // TODO(lando): token cannot be prepended with `Bot `
    /** @type {string} Discord bot token. Will be coerced into a bot token. */
    this.token;
    /** @type {[number,number]} [ShardID, ShardCount] to identify with. https://discordapp.com/developers/docs/topics/gateway#identify-identify-structure */
    this.shard;
    /** @type {Identity} Gateway identification. */
    this.identity;
    /** @type {number} Minimum time to wait between gateway identifies in ms. */
    this.retryWait;

    /** @type {Redis} Redis cache responsible for remote shard communication. */
    this.remoteRedis;
    /** @type {Object} Configuration settings passed to remote Redis constructor. */
    this.remoteRedisConfig;
    /** @type {Redis} Redis cache responsible for local shard communication. */
    this.localRedis;
    /** @type {Object} Configuration settings pass to local Redis constructor. */
    this.localRedisConfig;
    /** @type {string} Redis key used to mitigate overlapping shard identify's. */
    this.redisIdentityKey;
    /** @type {number} Time that the shard's identify mutex will be locked for in ms. */
    this.remoteLoginWait;

    // TODO(lando): better error
    if (config === undefined) {
      throw Error("No config passed to Gateway.");
    }

    this.constructorDefaults(emitter, config);
    this.assignIdentity(config);
    this.ripcordOverride();
    this.createRequestInstance();
    this.bindWebsocketFunctions();
  }

  /**
   * Assigns default values to this Gateway instance.
   * @private
   *
   * @param {import("events").EventEmitter} emitter Emitter through which Ripcord and Discord gateway events are sent.
   * @param {Object} config Configuration items for this handler.
   */
  constructorDefaults(emitter, config) {
    const defaults = {
      emitter,
      redisInitialized: false,
      sequence: 0,
      websocketRetryWaitTimeout: WEBSOCKETURIFAILRETRY,
      retryWait: MINIMUMIDENTIFYWAIT,
      remoteLoginWait: MINIMUMIDENTIFYWAIT,
      localLoginWait: MINIMUMIDENTIFYWAIT,
      redisIdentityKey: "lock:discord-bot",
      ...config
    };

    Object.assign(this, defaults);
  }

  /**
   * Creates an isolated axios instance for use by this gateway Handler.
   * @private
   */
  createRequestInstance() {
    this.http = axios.create({
      baseURL: DISCORDURI,
      headers: {
        Authorization: Util.coerceTokenToBotLike(this.token),
        "Content-Type": "application/json",
        "X-RateLimit-Precision": "millisecond"
      }
    });
  }

  /**
   * Creates Identity object used to identify with Discord's gateway.
   * @private
   *
   * @param {Object} config An object containing a details for gateway identification. https://discordapp.com/developers/docs/topics/gateway#identify
   */
  assignIdentity(config) {
    this.identity = new Identity(this.token, this.shard);
    if (config.identity !== undefined)
      Object.assign(this.identity, config.identity);
  }

  /** Load in environment variables set by Ripcord's Sharding Manager then delete them. */
  ripcordOverride() {
    if (process.env.RIPCORD_MANAGED === "true") {
      this.token = process.env.TOKEN;
      this.identity.token = Util.coerceTokenFromBotLike(process.env.TOKEN);
      this.identity.shard = [
        Number(process.env.SHARDID),
        Number(process.env.SHARDCOUNT)
      ];
      this.redisIdentityKey = process.env.REDISIDENTITYKEY;

      delete process.env.TOKEN;
      delete process.env.SHARDID;
      delete process.env.SHARDCOUNT;
      delete process.env.REDISIDENTITYKEY;
    }
  }

  /**
   * Binds `this` to important class methods so that they are able to be called in `setInterval()` and `setTimeout()`.
   * @private
   */
  bindWebsocketFunctions() {
    this.login = this.login.bind(this);
    this.heartbeat = this.heartbeat.bind(this);
  }

  /**
   * One-time setup items before connecting to Discord's gateway.
   * * Instantiates and connects to Redis using default settings.
   * @private
   */
  initRedis() {
    this.remoteRedis = new Redis(this.remoteRedisConfig);
    this.localRedis = new Redis(this.localRedisConfig);
    this.redisInitialized = true;
  }

  /**
   * Connects to Discord's event gateway.
   *
   * @param {ws} [_Websocket] For unittest dependency injection only.
   */
  async login(_Websocket = ws) {
    try {
      if (!this.redisInitialized) {
        this.initRedis();
      }
      if (!(await this.obtainRedisLock())) return;

      this.wsUrl = await this.getWebsocketURL();

      if (this.wsUrl === undefined) {
        return;
      }

      this.emit("GATEWAY_DEBUG", {
        message: `Connecting to url: ${this.wsUrl}`
      });

      this.ws = new _Websocket(this.wsUrl, { maxPayload: GIGABYTEINBYTES });
      this.assignWebsocketFunctions();
    } catch (err) {
      if (err.response) console.error(err.response.data.message);
      else console.error(err);
    }
  }

  assignWebsocketFunctions() {
    this.ws.onopen = this._onopen.bind(this);
    this.ws.onmessage = this._onmessage.bind(this);
    this.ws.onerror = this._onerror.bind(this);
    this.ws.onclose = this._onclose.bind(this);
  }

  /**
   * Attempts to obtain the shared shard lock for this application when logging in. Will attempt to login again after some time if unable to obtain lock.
   * @private
   *
   * @returns {boolean} true if able to set lock; or false if unable (it's already set).
   */
  async obtainRedisLock() {
    // TODO(lando): make redis delegation optional
    const localLock = await this.localRedis.set(
      this.redisIdentityKey + "-local",
      1,
      "NX",
      "PX",
      this.localLoginWait
    );
    if (localLock !== "OK") {
      setTimeout(this.login, SECONDINMILLISECONDS);
      return false;
    }

    if (this.remoteLoginWait) {
      const remoteLock = await this.remoteRedis.set(
        this.redisIdentityKey + "-remote",
        1,
        "NX",
        "PX",
        this.remoteLoginWait
      );
      if (remoteLock !== "OK") {
        await this.localRedis.del(this.redisIdentityKey + "-local");
        setTimeout(this.login, SECONDINMILLISECONDS);
        return false;
      }

      return true;
    }
  }

  /**
   * Obtains the websocket url from Discord. Will attempt to logic again after some time if the return status !== 200.
   * @private
   *
   * @returns {(string|void)} The url if status === 200; or undefined if status !== 200.
   */
  async getWebsocketURL() {
    const { status, data } = await this.http.get(`gateway/bot`, {
      validateStatus: null
    });

    if (status === 200) {
      const { total, remaining, reset_after } = data.session_start_limit;
      const message = `Login limit: ${total}. Remaining: ${remaining}. Reset after ${reset_after}ms (${new Date(new Date().getTime() + reset_after)})`;
      this.emit("GATEWAY_DEBUG", { message });
      return data.url + GATEWAYURLPARAMS;
    }

    let message = `Failed to get websocket information from API. Status ${status}. Message: ${data.message}. Code: ${data.code}.`;

    if (status !== 401) {
      message += " Trying again in 10 seconds.";
      this.emit("GATEWAY_DEBUG", { message });

      setTimeout(this.login, this.websocketRetryWaitTimeout);
    } else {
      message += " Please check your token. Exiting...";
      this.emit("GATEWAY_DEBUG", { message });

      process.exit(1);
    }
  }

  /**
   * Handles websocket opening.
   * @private
   */
  _onopen() {
    this.emit("GATEWAY_DEBUG", { message: "Websocket open." });
    this.emit("GATEWAY_OPEN");
  }

  /**
   * Handles websocket message.
   * @private
   */
  _onmessage(m) {
    this.handleMessage(JSON.parse(m.data));
  }

  /**
   * Handles websocket error.
   * @private
   */
  _onerror(err) {
    this.emit("GATEWAY_DEBUG", {
      message: `Websocket error. Message: ${err.message}`
    });
  }

  /**
   * Handles websocket closure. Cleans up and attempts to re-connect with a fresh connection after waiting some time. Emits "GATEWAY_CLOSED" if an emitter is defined.
   * @private
   */
  _onclose(event) {
    this.clearHeartbeat();

    this.emit("GATEWAY_DEBUG", {
      message: `Websocket closed. Code: ${event.code}. Reason: ${event.reason}`
    });

    if (event.code === 4006 || event.code === 4007 || event.code === 4009) {
      this.sessionId = undefined;
      this.sequence = 0;
    }

    this.emit("GATEWAY_CLOSE");

    setTimeout(this.login, 0);
  }

  /**
   * Unsets heartbeat values and clears the heartbeat setInterval.
   * @private
   */
  clearHeartbeat() {
    if (this.heartbeatInterval !== undefined) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
      this.heartbeatAck = undefined;
    }
  }

  /**
   * Processes incoming messages from Discord's gateway.
   * @private
   *
   * @param {Object} p Packet from Discord. https://discordapp.com/developers/docs/topics/gateway#payloads-gateway-payload-structure
   */
  handleMessage(p) {
    const { t: type, s: sequence, op: opCode, d: data } = p;

    if (opCode === OPCODES.DISPATCH) {
      if (type === "READY") {
        this.handleReady(data);
      } else if (type === "RESUMED") {
        this.handleResumed();
      } else if (type === "RECONNECT") {
        this.ws.close(1000);
      } else {
        setImmediate(() => this.handleEvent(type, data));
      }
    } else if (opCode === OPCODES.HELLO) {
      this.handleHello(data);
    } else if (opCode === OPCODES.HEARTBEAT_ACK) {
      this.handleHeartbeatAck();
    } else if (opCode === OPCODES.HEARTBEAT) {
      this.send(OPCODES.HEARTBEAT, 0);
    } else if (opCode === OPCODES.INVALID_SESSION) {
      this.handleInvalidSession(data);
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
    this.start = true;

    this.emit("GATEWAY_DEBUG", {
      message: `Received Ready. session_id: ${JSON.stringify(data.session_id)}.`
    });

    this.sessionId = data.session_id;

    this.handleEvent("READY", data);
  }

  handleResumed() {
    this.emit("GATEWAY_DEBUG", {
      message: "Replay finished. Resuming events."
    });

    this.handleEvent("RESUME", null);
  }

  /**
   * Handles "Hello" packet from Discord. Start heartbeats and identifies with gateway. https://discordapp.com/developers/docs/topics/gateway#connecting-to-the-gateway
   * @private
   *
   * @param {Object} data From Discord.
   */
  handleHello(data) {
    this.emit("GATEWAY_DEBUG", {
      message: `Received Hello. ${JSON.stringify(data)}.`
    });
    this.startHeartbeat(data.heartbeat_interval);
    this.connect(this.sessionId !== undefined && this.sequence !== 0);

    this.handleEvent("HELLO", data);
  }

  startHeartbeat(heartbeatInterval) {
    this.heartbeatAck = true;
    this.heartbeatInterval = setInterval(this.heartbeat, heartbeatInterval);
  }

  /**
   * Continuously checks if heartbeat ack was received. If not, reconnects to Discord's gateway. If so, send a heartbeat.
   * @private
   */
  heartbeat() {
    if (this.heartbeatAck === false) {
      this.emit("GATEWAY_DEBUG", { message: "Missed heartbeat." });

      this.ws.close(4000);
    } else {
      this.lastHeartbeatTimestamp = new Date().getTime();
      this.heartbeatAck = false;
      this.send(OPCODES.HEARTBEAT, 0);
    }
  }

  /**
   * Handles "Heartbeat ACK" packet from Discord.
   * @private
   */
  handleHeartbeatAck() {
    const message = `Heartbeat acknowledged. Latency:${new Date().getTime() -
      this.lastHeartbeatTimestamp}ms`;
    this.emit("GATEWAY_DEBUG", { message, verbose: true });

    this.heartbeatAck = true;
    this.handleEvent("HEARTBEAT_ACK", null);
  }

  /**
   * Connects to gateway. Will attempt to resume a connection if there is already a sessionId and sequence. Otherwise, will send a new identify payload.
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
    this.emit("GATEWAY_DEBUG", {
      message: `Attempting to resume connection. session_id: ${this.sessionId}. sequence: ${this.sequence}`
    });

    const resume = {
      token: Util.coerceTokenFromBotLike(this.token),
      session_id: this.sessionId,
      seq: this.sequence
    };

    this.emit("GATEWAY_RESUME", resume);

    this.send(OPCODES.RESUME, resume);
  }

  /**
   * Sends an "Identify" payload to Discord's gateway.
   * @private
   */
  identify() {
    this.sessionId = undefined;
    this.sequence = 0;

    if (this.shard) {
      this.emit("GATEWAY_DEBUG", {
        message: `Identifying as shard: ${this.shard[0]}/${this.shard[1] - 1}`
      });
    }

    this.emit("GATEWAY_IDENTIFY", this.identity);

    this.send(OPCODES.IDENTIFY, this.identity);
  }

  /**
   * Handles "Invalid Session" packet from Discord. Will attempt to resume a connection if Discord allows it and there is already a sessionId and sequence. Otherwise, will send a new identify payload.
   * @private
   *
   * @param {boolean} resumable Whether or not Discord has said that the connection as able to be resumed.
   */
  handleInvalidSession(resumable) {
    this.emit("GATEWAY_DEBUG", {
      message: `Received Invalid Session packet. Resumable: ${resumable}`
    });

    this.handleEvent("INVALID_SESSION", resumable);
    this.connect(resumable && this.sessionId !== undefined);
  }

  /**
   * Handles "Dispatch" packet from Discord. Will first pass through `eventHandler` function if the emitter has one defined.
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
   * Emits various events, both Discord and Ripcord. Will emit all if no `this.events` is undefined; otherwise will only emit those defined as keys in the `this.events` object.
   * @private
   *
   * @param {string} type Type of event. (e.g. "GATEWAY_CLOSED" or "CHANNEL_CREATE")
   * @param {Object} data Data to send with the event.
   */
  emit(type, data) {
    if (this.events === undefined) {
      this.emitter.emit(type, data);
    } else if (this.events[type] !== undefined) {
      this.emitter.emit(this.events[type], data);
    }
  }

  /**
   * Sends a websocket message to Discord.
   * @private
   *
   * @param {number} op Gateway Opcode https://discordapp.com/developers/docs/topics/opcodes-and-status-codes#gateway-gateway-opcodes
   * @param {Object} data Data of the message.
   */
  send(op, data) {
    if (this.ws !== undefined && this.ws.readyState === ws.OPEN) {
      const safeop = { ...data };
      if (safeop.token !== undefined) {
        safeop.token = "<truncated>";
      }

      const message = `Sending payload: op: ${op}, data: ${JSON.stringify(safeop)}`;

      this.emit("GATEWAY_DEBUG", {
        message,
        verbose: op === OPCODES.HEARTBEAT
      });

      const packet = JSON.stringify({ op, d: data });

      this.ws.send(packet);
    }
  }

  /**
   * Updates the sequence value of Discord's gateway if it's larger than the current.
   * @private
   *
   * @param {number} s Sequence value from Discord.
   */
  updateSequence(s) {
    if (s > this.sequence + 1) {
      // Fired to warn of something weird but non-breaking happening
      this.emit("GATEWAY_DEBUG", {
        message: `Non-consecutive sequence (${this.sequence} -> ${s})`
      });
      // const start = s + 1;
      // const end = sequence - 1;
    }

    if (s > this.sequence) {
      this.sequence = s;
    }
  }

  requestGuildMembers(
    guildId,
    limit = 0,
    query = "",
    presences = false,
    user_ids = []
  ) {
    this.send(OPCODES.REQUEST_GUILD_MEMBERS, {
      guild_id: guildId,
      limit,
      query,
      presences,
      user_ids
    });
  }
};
