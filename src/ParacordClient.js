"use strict";
const RipcordClient = require("./RipcordClient");
const Util = require("./util/Util");
const {
  SECONDINMILLISECONDS,
  MINUTEINMILLISECONDS
} = require("./util/constants");

const FORCEGUILDSTARTUPTIMEOUTDEFAULT = 60;

/* TODO(lando): verify that a newly inserted member object will always contain the relevant user 
and that no separate user objects are left in the user cache and vice versa. It's possible that 
a member or user update may desync the two leading to possible memory leaks*/

/**
 * A user client that provides customizable caching and helper functions.
 *
 * @extends RipcordClient
 */

module.exports = class ParacordClient extends RipcordClient {
  /**
   * Creates a new Paracord client.
   *
   * @param {string} token Discord bot token. Will be coerced into a bot token.
   * @param {Object} [options={}] Configurable settings for this Paracord instance.
   * @param {boolean} [options.cacheGuilds=true] If this client should handle caching of guilds. By default includes channels, roles, and non-offline guild members and their presences unless turned off with other options.
   * @param {boolean} [options.cacheGuildMembers=true] If this client should handle caching of non-offline guild members. Includes their presences unless `options.cachePresences` is `false`. Has no effect if `options.cacheGuilds` is `false`.
   * @param {boolean} [options.cachePresences=true] If this client should handle caching of presences. Has no effect if `options.cacheGuilds` is `false`. Will remove members from a guild's member cache if the status becomes "offline".
   * @param {boolean} [options.cacheGuildRoles=true] If this client should handle caching of guild roles. Has no effect if `options.cacheGuilds` is `false`.
   * @param {boolean} [options.cacheGuildChannels=true] If this client should handle caching of guild channels. Has no effect if `options.cacheGuilds` is `false`.
   * @param {boolean} [options.cacheUsers=true] If this client should additionally cache users separate from the associated member object in guilds.
   * @param {boolean} [options.allowLazyCache=true] If this client should lazy loading of certain cache resources.
   * @param {Function} [options.eventHandler=true] A function that will be executed after Paracord's internal processing and immediately before emitting an event. Should accept `(type, data)` and return a boolean on if the event should be emitted.
   */
  constructor(token, options = {}) {
    super(token);
    /* 
      State tracking the start up process.
    */
    /** @type {boolean} If the initial phases of the gateway connection are under way. */
    this.starting;
    /** @type {number} Guilds left to ingest on start up before emitting `PARACORD_STARTUP_COMPLETE` event. */
    this.guildWaitCount;

    /** @type {Map} */
    this.user;

    /* 
      Client's caches. 
    */
    /** @type {Map} Guild cache if `options.cacheGuilds` set to `true`. */
    this.guilds;
    /** @type {Map} User cache if `options.cacheUsers` set to `true`. */
    this.users;
    /** @type {Map} Presence cache if `options.cachePresences` set to `true`. */
    this.presences;

    /* 
      Caching behavior controls of this client. 
    */
    /** @type {boolean} If this client should handle caching of guilds. */
    this.cacheGuilds;
    /** @type {boolean} If this client should handle caching of guild members. */
    this.cacheGuildMembers;
    /** @type {boolean} If this client should handle caching of presences. */
    this.cachePresences;
    /** @type {boolean} If this client should handle caching of guild channels. */
    this.cacheGuildChannels;
    /** @type {boolean} If this client should handle caching of guild roles. */
    this.cacheGuildRoles;
    /** @type {boolean} If this client should additionally cache users separate from the associated member object in guilds. */
    this.cacheUsers;
    /** @type {boolean} If this client shcodeould lazy loading of certain cache resources. */
    this.allowLazyCache;
    /** @type {NodeJS.Timer}  */
    this.sweepCachesInterval;
    /** @type {NodeJS.Timer}  */
    this.sweepRecentPresenceUpdatesInterval;
    /** @type {Map} */
    this.veryRecentlyUpdatedPresences;
    this.veryRecentlyUpdatedUsers;

    /*
      Controls of behavior for when to emit "PARACORD_STARTUP_COMPLETE" before all the unavailable guilds are received from the gateway. 
    */
    /** @type {number} User-defined time in ms after which the "PARACORD_STARTUP_COMPLETE" event will be thrown regardless of other settings. */
    this.forceStartUpTimeout;
    /** @type {NodeJS.Timer} During start up, the maximum time in ms the client should wait for unavailable guilds after receiving the `READY` event from the gateway before throwing the `PARACORD_STARTUP_COMPLETE` event. */
    this.forceStartUpTimer;
    /** @type {number} During start up, the mximum number of guilds that are allowed to be unavailable. */
    this.forceGuildMaximumUnavailable;
    /** @type {number} During start up, time in seconds from the last guild event to wait. Only has an effect when `options.forceGuildMaximumUnavailable` > 0. */
    this.forceGuildStartUpTimeout;
    // /** @type {number} During start up, timestamp of when the most recent guild was seen.  */
    this.mostRecentGuildTimestamp;
    /** @type {NodeJS.Timer} Interval responsible for ending the start up process in regards to remaining unavailable guilds. */
    this.forceGuildStartUpInterval;

    /* 
      User-defined event handling behavior.
    */
    /** @type {Object} Key:Value mapping DISCORD_EVENT to user's preferred emitted name for use when connecting to the gateway. */
    this.events;
    /** @type {boolean} During startup, if events should be emitted before `PARACORD_STARTUP_COMPLETE` is emitted. `GUILD_CREATE` events will never be emitted during start up. */
    this.allowEventsDuringStartup;

    /** @type {Object} */
    this.defaults;

    this.paracordConstructorDefaults(options);
    this.assignDefaults();
    this.startProcessingRequestQueue();
    this.bindTimerFunction();
    this.bindEventFunctions();
  }

  /**
   * Assigns default values to this ParacordClient instance.
   * @private
   */
  paracordConstructorDefaults(options) {
    this.defaults = {
      guilds: new Map(),
      users: new Map(),
      presences: new Map(),
      veryRecentlyUpdatedPresences: new Map(),
      veryRecentlyUpdatedUsers: new Map(),
      starting: false,
      guildWaitCount: 0,
      allowLazyCache: true,
      allowEventsDuringStartup: false,
      ...options
    };
  }

  assignDefaults() {
    Object.assign(this, this.defaults);
  }

  bindEventFunctions() {
    // required in-line to avoid circular import
    const ParacordClientEvents = require("./util/ParacordClientEvents");

    for (const prop of Object.getOwnPropertyNames(ParacordClientEvents)) {
      if (typeof ParacordClientEvents[prop] === "function") {
        this[prop] = ParacordClientEvents[prop].bind(null, this);
      }
    }
  }

  bindTimerFunction() {
    this.forceStartUp = this.forceStartUp.bind(this);
    this.forceWithUnavailableGuild = this.forceWithUnavailableGuild.bind(this);
    this.sweepCaches = this.sweepCaches.bind(this);
    this.sweepOldUpdates = this.sweepOldUpdates.bind(this);
  }

  /**
   * Connects to Discord's gateway and begins receiving events. Must only be executed once in a bot token's lifetime and is not necessary to make REST calls afterward.
   *
   * @param {Object} config Configuration items for this handler.
   * @param {string} config.token Discord bot token. Will be coerced into a bot token.
   * @param {[number,number]} [config.shard=[env.process.SHARDID, env.process.SHARDCOUNT]] [ShardId, ShardCount] to identify with.
   * @param {string} [config.redisIdentityKey="Discord Bot"] Redis key used to mitigate overlapping shard identify's.
   * @param {Object<string,string>} [config.events] Key:Value mapping DISCORD_EVENT to user's preferred emitted name.
   * @param {forceStartUpTimeout} [config.forceStartUpTimeout] During start up, the maximum time in ms the client should wait for unavailable guilds after receiving the `READY` event from the gateway before throwing the `PARACORD_STARTUP_COMPLETE` event.
   * @param {forceGuildMaximumUnavailable} [config.forceGuildMaximumUnavailable] During start up, the number of guilds that are allowed to be unavailable.
   * @param {forceGuildStartUpTimeout} [config.forceGuildStartUpTimeout=60] During start up, time in seconds from the last guild event to wait. Only has an effect when `options.forceGuildMaximumUnavailable` > 0.
   * @param {bolean}[config.allowEventsDuringStartup=false] During startup, if events should be emitted before `PARACORD_STARTUP_COMPLETE` is emitted. `GUILD_CREATE` events will never be emitted during start up.
   */
  login(config = {}) {
    config.client = this;
    this.loginConfig = config;
    this.allowEventsDuringStartup = config.allowEventsDuringStartup || false;

    if (config.events === undefined) {
      config.events = this.events;
    }

    if (config.forceStartUpTimeout !== undefined) {
      this.forceStartUpTimer = setTimeout(
        this.forceStartUp,
        config.forceStartUpTimeout
      );
    }

    if (config.forceGuildMaximumUnavailable !== undefined) {
      const forceGuildStartUpTimeout =
        config.forceGuildStartUpTimeout || FORCEGUILDSTARTUPTIMEOUTDEFAULT;

      this.forceGuildMaximumUnavailable = config.forceGuildMaximumUnavailable;
      this.forceGuildStartUpTimeout =
        forceGuildStartUpTimeout * SECONDINMILLISECONDS;

      this.forceGuildStartUpInterval = setInterval(
        this.forceWithUnavailableGuild,
        SECONDINMILLISECONDS
      );
    }

    this.sweepCachesInterval = setInterval(
      this.sweepCaches,
      MINUTEINMILLISECONDS
    );

    this.sweepOldUpdatesInterval = setInterval(this.sweepOldUpdates, 500);

    return super.login(config);
  }

  /**
   * Processes gateway events.
   * @private
   *
   * @param {string} type The type of the event from the gateway. https://discordapp.com/developers/docs/topics/gateway#commands-and-events-gateway-events (Events tend to be emitted in all caps and underlines in place of spaces.)
   * @param {Object} data From Discord.
   */
  eventHandler(type, data) {
    /** @type {Function|void} Method defined in util/ParacordClientEvents. */
    let emit = data;

    const paracordClientEvent = this[type];
    if (paracordClientEvent !== undefined) {
      emit = paracordClientEvent(data);
    }

    if (this.starting === true) {
      if (type === "GUILD_CREATE") {
        this.checkIfDoneStarting();
        return undefined;
      } else {
        return this.allowEventsDuringStartup ? data : undefined;
      }
    } else {
      return emit;
    }
  }

  /**
   * Prepares the client for caching guilds on start up.
   * @private
   *
   * @param {number} guildCount Number of unavailable guilds received from Discord.
   */
  handleReady(data, testing = false) {
    this.assignDefaults();

    this.starting = true;

    const Guild = require("./structures/Guild");
    const { user, guilds } = data;

    guilds.forEach(g => this.guilds.set(g.id, new Guild(g, this, testing)));

    user.tag = Util.constructUserTag(user);
    this.user = user;

    this.guildWaitCount = guilds.length;

    let message = `Ready event received. Waiting on ${this.guildWaitCount} guilds.`;
    if (this.forceStartUpTimeout) {
      message += ` Will force start up completion in ${this.forceStartUpTimeout} milliseconds.`;
    }
    if (this.forceGuildMaximumUnavailable) {
      message += ` Will force start up completion if there are equal to or less than ${
        this.forceGuildMaximumUnavailable
      } guild(s) reimaining and ${this.forceGuildStartUpTimeout /
        1000} seconds have elapsed since the last unavailable guild was received.`;
    }

    this.gateway.emit("PARACORD_DEBUG", { message });
  }

  /**
   * Runs with every GUILD_CREATE on initial start up. Decrements counter and emits `PARACORD_STARTUP_COMPLETE` when 0.
   * @private
   */
  checkIfDoneStarting() {
    --this.guildWaitCount;

    if (this.guildWaitCount === 0) {
      this.completeStartup(false);
    } else if (this.guildWaitCount > 0) {
      const msSinceLastEvent =
        new Date().getTime() - this.mostRecentGuildTimestamp;

      let message = `${this.guildWaitCount} guilds left in start up.`;
      if (this.mostRecentGuildTimestamp !== undefined) {
        message += ` ${msSinceLastEvent}ms have elapsed since the last GUILD_CREATE event.`;
      }

      this.gateway.emit("PARACORD_DEBUG", { message, verbose: true });

      this.mostRecentGuildTimestamp = new Date().getTime();
    } else {
      throw Error(`guildWaitCount is less than 0, This should not happen. guildWaitCount value: ${this.guildWaitCount}`);
    }
  }

  /**
   * Cleans up Paracord's start up process and emits `PARACORD_STARTUP_COMPLETE`.
   * @private
   *
   * @param {boolean} timedOut Whether or not the reason of this method being called was a timeout.
   */
  completeStartup(timedOut) {
    this.starting = false;

    if (this.forceStartUpTimer !== undefined) {
      clearTimeout(this.forceStartUpTimer);
      this.forceStartUpTimer = undefined;
    }

    if (this.forceGuildStartUpInterval !== undefined) {
      clearInterval(this.forceGuildStartUpInterval);
      this.forceGuildStartUpInterval = undefined;
    }

    this.gateway.emit("PARACORD_DEBUG", {
      message: "Paracord start up complete."
    });
    this.gateway.emit("PARACORD_STARTUP_COMPLETE", { timedOut });
  }

  /** During start up, completes the start up process. Called when `forceStartUpTimeout` is exceeded during start up. */
  forceStartUp() {
    this.completeStartup(true);
  }

  /** During start up, checks if `forceGuildStartUpTimeout` between GUILD_CREATE events has been exceeded and if the `forceGuildMaximumUnavailable` condition has been met. Completes start up if these conditions are true. */
  forceWithUnavailableGuild() {
    if (this.mostRecentGuildTimestamp !== undefined) {
      const isBelowMaximumUnavailable =
        this.guildWaitCount <= this.forceGuildMaximumUnavailable;
      const hasMaximumTimeBeenExceed =
        this.mostRecentGuildTimestamp + this.forceGuildStartUpTimeout <
        new Date().getTime();

      if (isBelowMaximumUnavailable && hasMaximumTimeBeenExceed) {
        this.completeStartup(true);
      }
    }
  }

  /**
   * Assigns/overwrites guilds properties from a new guild.
   * @private
   *
   * @param {import("./structures/Guild")} guild
   */
  static upsertGuild(data, client, Guild = require("./structures/Guild")) {
    const cachedGuild = client.guilds.get(data.id);
    if (cachedGuild !== undefined) {
      return cachedGuild.constructGuild(data, client);
    } else {
      const guild = new Guild(data, client);
      client.guilds.set(data.id, guild);
      return guild;
    }
  }

  /**
   * Adds or updates user to/in client cache if it has a cached presence.
   * @private
   *
   * @param {Object} user From Discord. https://discordapp.com/developers/docs/resources/user#user-object-user-structure
   * @param {ParacordClient} client
   */
  static upsertUser(user, client) {
    let cachedUser = client.users.get(user.id) || {};

    if (user !== cachedUser) {
      const userHasCachedPresence = client.presences.has(user.id);

      if (userHasCachedPresence || user.bot) {
        cachedUser.tag = Util.constructUserTag(user);

        if (cachedUser.created_on === undefined) {
          cachedUser.created_on = Util.timestampFromSnowflake(user.id);
        }

        if (!userHasCachedPresence && user.bot) {
          ParacordClient.upsertPresence(
            client.presences,
            { user, status: "offline" },
            client
          );
        }

        cachedUser = Object.assign(cachedUser, user);
        client.users.set(user.id, cachedUser);
      } else {
        return undefined;
      }
    }

    return cachedUser;
  }

  /**
   * Add a presence to the presence map(s), deduping by reusing presences already cached in the client.
   * @private
   *
   * @param {Map} presences Map of presences keyed to their users' ids.
   * @param {Object} presence https://discordapp.com/developers/docs/topics/gateway#presence-update-presence-update-event-fields
   * @param {ParacordClient} client
   */
  static updateCachesOnPresence(presences, presence, client) {
    // if (!presence.user.bot && presence.status === "offline") {
    //   ParacordClient.clearUserFromCaches(presence.user.id, client);
    // } else {
    ParacordClient.upsertPresence(presences, presence, client);
    // }
  }

  static upsertPresence(presences, presence, client) {
    const cachedPresence = client.presences.get(presence.user.id) || {};

    if (client.users.has(presence.user.id)) {
      presence.user = client.users.get(presence.user.id);
    }

    const updatedPresence = Object.assign(cachedPresence, presence);
    presences.set(presence.user.id, updatedPresence);
    if (presences !== client.presences) {
      client.presences.set(presence.user.id, updatedPresence);
    }
  }

  static clearUserFromCaches(id, client) {
    if (!client.users.get(id) || !client.users.get(id).bot) {
      client.presences.delete(id);
      client.users.delete(id);
      for (const { members, presences } of client.guilds.values()) {
        presences.delete(id);
        members.delete(id);
      }
    }
  }

  /**
   * Short-hand for sending a message to Discord.
   *
   * @param {string} channelId Discord snowflake of the channel to send the message.
   * @param {string|Object} message  When a string is passed for `message`, that string will populate the `content` field. https://discordapp.com/developers/docs/resources/channel#create-message-params
   */
  send(channelId, message) {
    return this.request({
      method: "post",
      endpoint: `channels/${channelId}/messages`,
      data:
        typeof message === "string" ? { content: message } : { embed: message }
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
  edit(message, newMessage) {
    return this.request({
      method: "patch",
      endpoint: `channels/${message.channel_id}/messages/${message.id}`,
      data:
        typeof newMessage === "string"
          ? { content: newMessage }
          : { embed: newMessage }
    });
  }

  sweepCaches() {
    const allMembers = new Map();
    for (const { members } of this.guilds.values()) {
      for (const id of members.keys()) {
        allMembers.set(id, null);
      }
    }

    for (const id of this.presences.keys()) {
      if (allMembers.has(id)) {
        allMembers.delete(id);
      } else {
        ParacordClient.clearUserFromCaches(id, this);
      }
    }
  }

  sweepOldUpdates() {
    const now = new Date().getTime();

    ParacordClient.sweepOldEntries(now, this.veryRecentlyUpdatedPresences);
    ParacordClient.sweepOldEntries(now, this.veryRecentlyUpdatedUsers);
  }

  static sweepOldEntries(now, map) {
    for (const [id, ts] of map.entries()) {
      if (ts < now) {
        map.delete(id);
      }
    }
  }
};
