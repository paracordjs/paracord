'use strict';

const { EventEmitter } = require('events');
const Guild = require('./structures/Guild');
const Api = require('../Api');
const Gateway = require('../Gateway');
const Utils = require('../../utils');
const {
  SECOND_IN_MILLISECONDS,
  MINUTE_IN_MILLISECONDS,
  LOG_LEVELS,
  LOG_SOURCES,
  PARARCORDSWEEPINTERVAL,
} = require('../../utils/constants');

const { PARACORD_SHARDIDS } = process.env;

/* "Start up" refers to logging in to the gateway and waiting for all the guilds to be returned. By default, events will be surpressed during start up. */

/**
 * A client that provides caching and limited helper functions. Integrates the Api and Gateway clients into a seamless experience.
 *
 * @extends EventEmitter
 */
module.exports = class Paracord extends EventEmitter {
  /**
   * Creates a new Paracord client.
   *
   * @param {string} token Discord bot token. Will be coerced into a bot token.
   * @param {ParacordOptions} options Settings for this Paracord instance.
   */
  constructor(token, options = {}) {
    super();
    /** @type {string} Discord bot token. */
    this.token = token;
    /** @type {boolean} Whether or not the `init()` function has already been called. */
    this.initialized = false;

    /* Internal clients. */
    /** @type {Api} Client through which to make REST api calls to Discord. */
    this.api;
    /** @type {Gateway[]]} Client through which to interact with Discord's gateway. */
    this.gateways;
    /** @type {Gateway[]]} Gateways queue to log in. */
    this.gatewayLoginQueue;

    /* State that tracks the start up process. */
    /** @type {number} Timestamp of the last gateway identify. */
    this.safeGatewayIdentifyTimestamp;
    /** @type {number} Gateways left to login on start up before emitting `PARACORD_STARTUP_COMPLETE` event. */
    this.gatewayWaitCount;
    /** @type {number|void} Shard currently in the initial phases of the gateway connection in progress. */
    this.startingShard;
    /** @type {number} Guilds left to ingest on start up before emitting `PARACORD_STARTUP_COMPLETE` event. */
    this.guildWaitCount;
    /** @type {Object<string, any>} User details given by Discord in the "Ready" event form the gateway. https://discordapp.com/developers/docs/topics/gateway#ready-ready-event-fields */
    this.user;

    /* Client caches. */
    /** @type {Map<string, Guild>} Guild cache. */
    this.guilds;
    /** @type {Map} User cache. */
    this.users;
    /** @type {Map} Presence cache. */
    this.presences;

    /** @type {NodeJS.Timer} Interval that removes objects from the presence and user cachces. */
    this.sweepCachesInterval;
    /** @type {NodeJS.Timer} Interval that removes object from the redundant presence update cache. */
    this.sweepRecentPresenceUpdatesInterval;
    /** @type {Map<string, number>} A short-tern cache for presence updates used to avoid processing the same event multiple times. */
    this.veryRecentlyUpdatedPresences;
    /** @type {Map<string, number>} A short-tern cache for user updates used to avoid processing the same event multiple times. */
    this.veryRecentlyUpdatedUsers;

    this.processGatewayQueueInterval;

    /* User-defined event handling behavior. */
    /** @type {Object<string, string>} Key:Value mapping DISCORD_EVENT to user's preferred emitted name for use when connecting to the gateway. */
    this.events;
    /** @type {boolean} During startup, if events should be emitted before `PARACORD_STARTUP_COMPLETE` is emitted. `GUILD_CREATE` events will never be emitted during start up. */
    this.allowEventsDuringStartup;

    this.constructorDefaults(token, options);
  }

  /*
   ********************************
   ********* CONSTRUCTOR **********
   ********************************
   */

  /**
   * Assigns default values to this Paracord instance based on the options.
   * @private
   *
   * @param {string} token Discord token. Will be coerced into a bot token.
   * @param {ParacordOptions} options Optional parameters for this handler.
   */
  constructorDefaults(token, options) {
    Paracord.validateParams(token);

    const defaults = {
      guilds: new Map(),
      users: new Map(),
      presences: new Map(),
      veryRecentlyUpdatedPresences: new Map(),
      veryRecentlyUpdatedUsers: new Map(),
      safeGatewayIdentifyTimestamp: 0,
      gateways: [],
      gatewayLoginQueue: [],
      gatewayWaitCount: 0,
      startingShard: null,
      guildWaitCount: 0,
      allowEventsDuringStartup: false,
    };

    Object.assign(this, { ...options, ...defaults });

    if (options.autoInit === undefined || options.autoInit) {
      this.init();
    }
    this.bindTimerFunction();
    this.bindEventFunctions();
  }

  /**
   * Throws errors and warns if the parameters passed to the constructor aren't sufficient.
   * @private
   */
  static validateParams(token) {
    if (token === undefined) {
      throw Error("client requires a 'token'");
    }
  }

  /**
   * Binds `this` to the event functions defined in a separate file.
   * @private
   */
  bindEventFunctions() {
    Utils.bindFunctionsFromFile(this, require('./eventFuncs'));
  }

  /**
   * Binds `this` to functions that are used in timeouts and intervals.
   * @private
   */
  bindTimerFunction() {
    this.sweepCaches = this.sweepCaches.bind(this);
    this.sweepOldUpdates = this.sweepOldUpdates.bind(this);
    this.processGatewayQueue = this.processGatewayQueue.bind(this);
  }

  /*
   ********************************
   *********** INTERNAL ***********
   ********************************
   */

  /**
   * Processes a gateway event.
   *
   * @param {string} eventType The type of the event from the gateway. https://discordapp.com/developers/docs/topics/gateway#commands-and-events-gateway-events (Events tend to be emitted in all caps and underlines in place of spaces.)
   * @param {Object} data From Discord.
   * @param {number} shard Shard of the gateway that emitted this event.
   */
  eventHandler(eventType, data, shard) {
    /** @type {Function|void} Method defined in ParacordEvents.js */
    let emit = data;

    const paracordEvent = this[eventType];
    if (paracordEvent !== undefined) {
      emit = paracordEvent(data, shard);
    }

    if (this.startingShard !== null && this.startingShard === shard) {
      if (eventType === 'GUILD_CREATE') {
        this.checkIfDoneStarting();
        return undefined;
      }
      return this.allowEventsDuringStartup ? data : undefined;
    }

    return emit;
  }

  /**
   * Simple alias for logging events emitted by this client.
   * @private
   *
   * @param {string} level Key of the logging level of this message.
   * @param {string} message Content of the log.
   * @param {*} [data] Data pertinent to the event.
   */
  log(level, message, data) {
    this.emit('DEBUG', {
      source: LOG_SOURCES.API,
      level: LOG_LEVELS[level],
      message,
      data,
    });
  }

  /**
   * Proxy emitter. Renames type with a key in `this.events`.
   *
   * @param {string} type Name of the event.
   * @param  {...any} args Any arguments to send with the emitted event.
   */
  emit(type, ...args) {
    if (this.events === undefined || this.events[type] === undefined) {
      super.emit(type, ...args);
    } else {
      super.emit(this.events[type], ...args);
    }
  }

  /*
   ********************************
   ************ LOGIN *************
   ********************************
   */

  /**
   * Connects to Discord's gateway and begins receiving and emitting events.
   *
   * @param {ParacordLoginOptions} [options] Options used when logging in.
   */
  async login(options = {}) {
    if (!this.initialized) {
      this.init();
    }

    if (PARACORD_SHARDIDS !== undefined) {
      options.shards = PARACORD_SHARDIDS.split(',');
    }

    this.startGatewayLoginInterval();
    await this.enqueueGateways(options);

    this.allowEventsDuringStartup = options.allowEventsDuringStartup || false;

    this.startSweepIntervals();
  }

  /**
   * Begins the interval that kicks off gateway logins from the queue.
   * @private
   */
  startGatewayLoginInterval() {
    this.processGatewayQueueInterval = setInterval(
      this.processGatewayQueue, SECOND_IN_MILLISECONDS,
    );
  }

  /**
   * Takes a gateway off of the queue and logs it in.
   * @private
   */
  async processGatewayQueue() {
    if (this.gatewayLoginQueue.length) {
      if (this.gatewayLoginQueue[0].resumable) {
        const gateway = this.gatewayLoginQueue.shift();
        await gateway.login();
      } else if (
        this.startingShard === null
        && new Date().getTime() > this.safeGatewayIdentifyTimestamp
      ) {
        const gateway = this.gatewayLoginQueue.shift();
        this.safeGatewayIdentifyTimestamp = 10 * SECOND_IN_MILLISECONDS; // arbitrary buffer

        /* eslint-disable-next-line prefer-destructuring */
        this.startingShard = gateway.shard;
        try {
          await gateway.login();
        } catch (err) {
          this.log('FATAL', err.message, gateway);
          this.startingShard = null;
        }
      }
    }
  }

  /**
   * Decides shards to spawn and pushes a gateway onto the queue for each one.
   * @private
   *
   * @param {ParacordLoginOptions} [options] Options used when logging in.
   */
  async enqueueGateways(options) {
    let { shards, shardCount, identity } = options;
    if (shards && shardCount) {
      shards.forEach((s) => {
        if (s + 1 > shardCount) {
          throw Error(`shard id ${s} exceeds max shard id of ${shardCount - 1}`);
        }
      });
    }


    if (identity !== undefined && Object.prototype.hasOwnProperty.call(identity, 'shard')) {
      const identityCopy = Utils.clone(identity); // mirror above behavior
      this.addNewGateway(identityCopy);
    } else {
      ({ shards, shardCount } = await this.computeShards(shards, shardCount));

      shards.forEach((shard) => {
        const identityCopy = Utils.clone(identity || {});
        identityCopy.shard = [shard, shardCount];
        this.addNewGateway(identityCopy);
      });
    }
  }

  /**
 * Creates gateway and pushes it into cache and login queue.
 * @private
 *
 * @param {Object<string, any>} identity An object containing information for identifying with the gateway. https://discordapp.com/developers/docs/topics/gateway#identify-identify-structure
 */
  addNewGateway(identity) {
    const gatewayOptions = { identity, api: this.api, emitter: this };
    const gateway = this.setUpGateway(this.token, gatewayOptions);
    ++this.gatewayWaitCount;
    this.gateways.push(gateway);
    this.gatewayLoginQueue.push(gateway);
  }

  /** Sets up the internal handlers for this client. */
  init() {
    if (this.initialized) {
      throw Error('Client has already been initialized.');
    }
    this.api = this.setUpApi(this.token, this.apiOptions);
    this.selfAssignHandlerFunctions();
    this.initialized = true;
  }

  /**
   * Determines which shards will be spawned.
   * @private
   *
   * @param {number[]|void} shards Shard Ids to spawn.
   * @param {number|void} shardCount Total number of shards
   */
  async computeShards(shards, shardCount) {
    if (shards !== undefined && shardCount === undefined) {
      throw Error('shards defined with no shardcount.');
    }

    if (shardCount === undefined) {
      const { status, data: { shards: recommendedShards } } = await this.api.request(
        'get',
        'gateway/bot',
      );
      if (status === 200) {
        shardCount = recommendedShards;
      }
    }

    if (shards === undefined) {
      shards = [];
      for (let i = 0; i < shardCount; ++i) {
        shards.push(i);
      }
    }

    return { shards, shardCount };
  }

  /**
   * Begins the intervals that prune caches.
   * @private
   */
  startSweepIntervals() {
    this.sweepCachesInterval = setInterval(
      this.sweepCaches,
      60 * MINUTE_IN_MILLISECONDS,
    );

    this.sweepOldUpdatesInterval = setInterval(
      this.sweepOldUpdates,
      PARARCORDSWEEPINTERVAL,
    );
  }

  /*
   ********************************
   ************ SETUP *************
   ********************************
   */

  /**
   * Creates the handler used when handling REST calls to Discord.
   * @private
   *
   * @param {string} token Discord token. Will be coerced to bot token.
   * @param {ApiOptions} options
   */
  setUpApi(token, options) {
    const api = new Api(token, { ...options, emitter: this });
    if (api.rpcRequestService === undefined) {
      api.startQueue();
    }

    return api;
  }

  /**
   * Creates the handler used when connecting to Discord's gateway.
   * @private
   *
   * @param {string} token Discord token. Will be coerced to bot token.
   * @param {GatewayOptions} options
   */
  setUpGateway(token, options) {
    // if (process.env.PARACORD_SHARDCOUNT !== undefined) {
    //   options = this.paracordShardOverride(options);
    // }

    const gateway = new Gateway(token, {
      ...options,
      emitter: this,
      api: this.api,
    });

    return gateway;
  }

  // /**
  //  * Load in environment variables set by the Shard Launcher.
  //  * @private
  //  *
  //  * @returns {GatewayOptions}
  //  */
  // paracordShardOverride(oldOptions) {
  //   const shardId = Number(process.env.PARACORD_SHARDID);
  //   const shardCount = Number(process.env.PARACORD_SHARDCOUNT);

  //   const message = `Injecting shard settings from shard launcher. Shard ID: ${shardId}. Shard count: ${shardCount}`;
  //   this.log('INFO', message);

  //   const options = oldOptions;
  //   options.identity = options.identity ? { ...options.identity } : {};
  //   options.identity.shard = [shardId, shardCount];

  //   return options;
  // }

  /**
   * Assigns some public functions from handlers to this client for easier access.
   * @private
   */
  selfAssignHandlerFunctions() {
    this.request = this.api.request.bind(this.api);
    this.addRateLimitService = this.api.addRateLimitService.bind(this.api);
    this.addRequestService = this.api.addRequestService.bind(this.api);
  }

  /*
   ********************************
   ********** START UP ************
   ********************************
   */

  /**
   * Prepares the client for caching guilds on start up.
   * @private
   *
   * @param {Object<string, any>} data Number of unavailable guilds received from Discord.
   */
  handleReady(data) {
    const { user, guilds } = data;

    guilds.forEach((g) => this.guilds.set(g.id, new Guild(g, this)));

    user.tag = Utils.constructUserTag(user);
    this.user = user;
    this.log('INFO', `Logged in as ${user.tag}.`);


    const message = `Ready event received. Waiting on ${guilds.length} guilds.`;
    if (guilds.length === 0) {
      this.checkIfDoneStarting(true);
    } else {
      this.guildWaitCount = guilds.length;
    }

    this.log('INFO', message);
  }

  /**
   * Runs with every GUILD_CREATE on initial start up. Decrements counter and emits `PARACORD_STARTUP_COMPLETE` when 0.
   * @private
   *
   * @param {boolean} emptyShard Whether or not the shard started with no guilds.
   */
  checkIfDoneStarting(emptyShard = false) {
    if (!emptyShard) {
      --this.guildWaitCount;
    }

    let message = `Shard ${this.startingShard} - ${this.guildWaitCount} guilds left in start up.`;
    if (this.guildWaitCount === 0 && this.startingShard !== null) {
      message = `Shard ${this.startingShard} - received all start up guilds.`;
      this.startingShard = null;
      --this.gatewayWaitCount;

      if (this.gatewayWaitCount === 0) {
        this.completeStartup();
      }
    } else if (this.guildWaitCount < 0) {
      message = `Shard ${this.startingShard} - guildWaitCount is less than 0. This should not happen. guildWaitCount value: ${this.guildWaitCount}`;
      this.log('WARNING', message);
      return;
    }

    this.log('INFO', message);
  }

  /**
   * Cleans up Paracord's start up process and emits `PARACORD_STARTUP_COMPLETE`.
   * @private
   *
   * @param {string} [reason] Reason for the time out.
   */
  completeStartup(reason) {
    this.gatewayLoginQueue.shift();
    this.startingShard = null;

    // this.clearStartupTimers();

    let message = 'Paracord start up complete.';
    if (reason !== undefined) {
      message += ` ${reason}`;
    }

    this.log('INFO', message);
    this.emit('PARACORD_STARTUP_COMPLETE');
  }

  /*
   ********************************
   *********** CACHING ************
   ********************************
   */

  /**
   * Inserts/updates properties of a guild.
   * @private
   *
   * @param {Object<string, any>} data From Discord - https://discordapp.com/developers/docs/resources/guild#guild-object
   * @param {Paracord} client
   * @param {Function} Guild Ignore. For dependency injection.
   */
  upsertGuild(data, GuildConstructor = Guild) {
    const cachedGuild = this.guilds.get(data.id);
    if (cachedGuild !== undefined) {
      return cachedGuild.constructGuildFromData(data, this);
    }
    const guild = new GuildConstructor(data, this);
    this.guilds.set(data.id, guild);
    return guild;
  }

  /**
   * Inserts/updates user in this client's cache.
   * @private
   *
   * @param {Object<string, any>} user From Discord - https://discordapp.com/developers/docs/resources/user#user-object-user-structure
   * @param {Paracord} client
   */
  upsertUser(user) {
    let cachedUser = this.users.get(user.id) || {};
    cachedUser.tag = Utils.constructUserTag(user);

    cachedUser = Object.assign(cachedUser, user);

    this.users.set(cachedUser.id, cachedUser);

    Utils.assignCreatedOn(cachedUser);
    this.circularAssignCachedPresence(cachedUser);

    return cachedUser;
  }

  /**
   * Adjusts the client's presence cache, allowing ignoring events that may be redundant.
   * @private
   *
   * @param {Object<string, any>} presence From Discord - https://discordapp.com/developers/docs/topics/gateway#presence-update
   */
  updatePresences(presence) {
    let cachedPresence;

    if (!this.veryRecentlyUpdatedPresences.has(presence.user.id)) {
      if (presence.status !== 'offline') {
        cachedPresence = this.upsertPresence(presence);
      } else {
        this.deletePresence(presence.user.id);
      }
    } else {
      cachedPresence = this.presences.get(presence.user.id);
    }

    this.veryRecentlyUpdatedPresences.set(
      presence.user.id,
      new Date().getTime() + 500,
    );

    return cachedPresence;
  }

  /**
   * Inserts/updates presence in this client's cache.
   * @private
   *
   * @param {Object<string, any>} presence From Discord - https://discordapp.com/developers/docs/topics/gateway#presence-update
   */
  upsertPresence(presence) {
    const cachedPresence = this.presences.get(presence.user.id);
    if (cachedPresence !== undefined) {
      presence = Object.assign(cachedPresence, presence);
    } else {
      this.presences.set(presence.user.id, presence);
    }

    this.circluarAssignCachedUser(presence);

    return presence;
  }

  /**
   * Ensures that a user is assigned its presence from the cache and vice versa.
   * @private
   *
   * @param {Object<string, any>} user From Discord - https://discordapp.com/developers/docs/resources/user#user-object
   */
  circularAssignCachedPresence(user) {
    const cachedPresence = this.presences.get(user.id);
    if (cachedPresence !== undefined) {
      user.presence = cachedPresence;
      user.presence.user = user;
    }
  }

  /**
   * Ensures that a presence is assigned its user from the cache and vice versa.
   * @private
   *
   * @param {Object<string, any>} presence From Discord - https://discordapp.com/developers/docs/topics/gateway#presence-update
   */
  circluarAssignCachedUser(presence) {
    const cachedUser = this.users.get(presence.user.id);
    if (cachedUser !== undefined) {
      presence.user = cachedUser;
      presence.user.presence = presence;
    }
  }

  /**
   * Removes presence from cache.
   * @private
   *
   * @param {string} userId Id of ther presence's user.
   */
  deletePresence(userId) {
    this.presences.delete(userId);
    const user = this.users.get(userId);
    if (user !== undefined) {
      user.presence = undefined;
    }
  }

  /**
   * Processes presences (e.g. from PRESENCE_UPDATE, GUILD_MEMBERS_CHUNK, etc.)
   * @private
   *
   * @param {Guild} guild Paracord guild.
   * @param {Object} presence From Discord. More information on a particular payload can be found in the official docs. https://discordapp.com/developers/docs/topics/gateway#presence-update
   */
  handlePresence(guild, presence) {
    const cachedPresence = this.updatePresences(presence);

    if (cachedPresence !== undefined) {
      guild.setPresence(cachedPresence);
    } else {
      guild.deletePresence(presence.user.id);
    }
  }

  /**
   * Processes a member object (e.g. from MESSAGE_CREATE, VOICE_STATE_UPDATE, etc.)
   * @private
   *
   * @param {Guild} guild Paracord guild.
   * @param {Object} member From Discord. More information on a particular payload can be found in the official docs. https://discordapp.com/developers/docs/resources/guild#guild-member-object
   */
  cacheMemberFromEvent(guild, member) {
    if (member !== undefined) {
      const cachedMember = guild.members.get(member.user.id);
      if (cachedMember === undefined) {
        return guild.upsertMember(member, this);
      }
      return cachedMember;
    }

    return member;
  }

  /**
   * Removes from presence and user caches users who are no longer in a cached guild.
   * @private
   */
  sweepCaches() {
    const deleteIds = new Map([...this.presences, ...this.users]);

    Paracord.trimMembersFromDeleteList(deleteIds, this.guilds.values());

    let sweptCount = 0;
    for (const id of deleteIds.keys()) {
      this.clearUserFromCaches(id);
      ++sweptCount;
    }

    this.log('INFO', `Swept ${sweptCount} users from caches.`);
  }

  /**
   * Remove users referenced in a guild's members or presences from the delete list.
   * @private
   *
   * @param {Map<string, void>} deleteIds Unique set of user ids in a map.
   * @param {IterableIterator<Guild>} guilds An iterable of guilds.
   *  */
  static trimMembersFromDeleteList(deleteIds, guilds) {
    for (const { members, presences } of guilds) {
      for (const id of new Map([...members, ...presences]).keys()) {
        deleteIds.delete(id);
      }
    }
  }

  /**
   * Delete the user and its presence from this client's cache.
   * @private
   *
   * @param {string} id User id.
   */
  clearUserFromCaches(id) {
    this.presences.delete(id);
    this.users.delete(id);
  }

  /**
   * Removes outdated states from the redundancy caches.
   * @private
   */
  sweepOldUpdates() {
    const now = new Date().getTime();

    Paracord.sweepOldEntries(now, this.veryRecentlyUpdatedPresences);
    Paracord.sweepOldEntries(now, this.veryRecentlyUpdatedUsers);
  }

  /** Remove entries from a map whose timestamp is older than now. */
  static sweepOldEntries(now, map) {
    for (const [id, ts] of map.entries()) {
      if (ts < now) {
        map.delete(id);
      }
    }
  }

  /*
   ********************************
   ******* PUBLIC HELPERS *********
   ********************************
   */

  /**
   * Short-hand for sending a message to Discord.
   *
   * @param {string} channelId Discord snowflake of the channel to send the message.
   * @param {string|Object} message  When a string is passed for `message`, that string will populate the `content` field. https://discordapp.com/developers/docs/resources/channel#create-message-params
   */
  sendMessage(channelId, message) {
    return this.request('post', `channels/${channelId}/messages`, {
      data:
        typeof message === 'string' ? { content: message } : { embed: message },
    });
  }

  /**
   * Short-hand for editing a message to Discord.
   *
   * @param {Object} message Partial Discord message. https://discordapp.com/developers/docs/resources/channel#create-message-params
   * @param {string} message.id Discord snowflake of the message to edit.
   * @param {string} message.channel_id Discord snowflake of the channel the message is in.
   * @param {string|Object} message  When a string is passed for `message`, that string will populate the `content` field. https://discordapp.com/developers/docs/resources/channel#create-message-params
   */
  editMessage(message, newMessage) {
    return this.request({
      method: 'patch',
      url: `channels/${message.channel_id}/messages/${message.id}`,
      data:
        typeof newMessage === 'string'
          ? { content: newMessage }
          : { embed: newMessage },
    });
  }

  /**
   * Fetch a member using the Rest API
   *
   * @param {string|Guild} guild The guild object or id of the member.
   * @param {string} memberId User id of the member.
   */
  fetchMember(guild, memberId) {
    let guildID;

    if (typeof guild === 'string') {
      guildID = guild;
      guild = this.guilds.get(guildID);
    } else {
      ({ id: guildID } = guild);
    }
    const res = this.request('get', `/guilds/${guildID}/members/${memberId}`);

    if (res.status === 200) {
      guild.upsertMember(res.data, this);
    }

    return res;
  }
};
