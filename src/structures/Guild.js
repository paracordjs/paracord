"use strict";
const Util = require("../util/Util");
const ParacordClient = require("../ParacordClient");

module.exports = class Guild {
  constructor(guildData, client, testing = false) {
    this.members;
    this.channels;
    this.presences;
    this.roles;
    this.unavailable;
    this.owner;
    this.me;
    this.created_on;

    Guild.constructorDefaults(this);

    if (!testing) {
      this.constructGuild(guildData, client);
    }

    return this;
  }

  static constructorDefaults(guild) {
    const defaults = {
      members: new Map(),
      channels: new Map(),
      presences: new Map(),
      roles: new Map(),
      unavailable: false
    };

    Object.assign(guild, defaults);
  }

  /**
   * Add guild to client cache along with any channels. roles, members, and their presences if applicable.
   * @private
   *
   * @param {Object} guild https://discordapp.com/developers/docs/resources/guild#guild-object
   */
  constructGuild(guildData, client) {
    if (!guildData.unavailable) {
      this.unavailable = false;

      this.owner_id = guildData.owner_id;

      if (this.created_on === undefined) {
        this.created_on = Util.timestampFromSnowflake(guildData.id);
      }

      if (guildData.channels !== undefined) {
        this.channels = Guild.mapChannels(guildData.channels);
        delete guildData.channels;
      }

      if (guildData.roles !== undefined) {
        this.roles = Guild.mapRoles(guildData.roles);
        delete guildData.roles;
      }

      if (guildData.presences !== undefined) {
        this.presences = Guild.mapPresences(guildData.presences, client);
        delete guildData.presences;
      }

      if (guildData.members !== undefined) {
        this.members = Guild.mapMembers(guildData.members, this, client);
        delete guildData.members;
      }

      if (this.owner === undefined || this.owner_id !== guildData.owner_id) {
        this.owner = this.members.get(guildData.owner_id);
        // if (this.owner === undefined) {
        //   // Guild.lazyLoadGuildOwner(this, client);
        // }
      }

      if (this.me === undefined) {
        this.me = this.members.get(client.user.id);
        if (this.me === undefined) {
          Guild.lazyLoadGuildMe(this, client);
        }
      }
    } else {
      guildData.unavailable = true;
    }

    Object.assign(this, guildData);
  }

  /**
   * Cache channels and create a map of them keyed to their ids.
   * @private
   *
   * @param {Array} channels https://discordapp.com/developers/docs/resources/channel#channel-object-channel-structure
   */
  static mapChannels(channels) {
    const channelMap = new Map();
    channels.forEach(c => Guild.upsertChannel(channelMap, c));
    return channelMap;
  }

  /**
   * Add a channel with some additional information to a map of channels.
   * @private
   *
   * @param {Map} channels Map of channels keyed to their ids.
   * @param {Object} channel https://discordapp.com/developers/docs/resources/channel#channel-object-channel-structure
   */
  static upsertChannel(channels, channel) {
    channel.created_on = Util.timestampFromSnowflake(channel.id);
    channels.set(
      channel.id,
      Object.assign(channels.get(channel.id) || {}, channel)
    );
  }

  /**
   * Cache roles and create a map of them keyed to their ids.
   * @private
   *
   * @param {Array} roles https://discordapp.com/developers/docs/topics/permissions#role-object-role-structure
   */
  static mapRoles(roles) {
    const roleMap = new Map();
    roles.forEach(r => Guild.upsertRole(roleMap, r));
    return roleMap;
  }

  /**
   * Add a role with some additional information to a roles map.
   * @private
   *
   * @param {Map} roles Map of roles keyed to their ids.
   * @param {Object} role https://discordapp.com/developers/docs/topics/permissions#role-object-role-structure
   */
  static upsertRole(roles, role) {
    role.created_on = Util.timestampFromSnowflake(role.id);
    roles.set(role.id, Object.assign(roles.get(role.id) || {}, role));
  }

  /**
   * Cache presences and create a map of them keyed to their respective user ids.
   * @private
   *
   * @param {Array} presences https://discordapp.com/developers/docs/topics/gateway#presence-update-presence-update-event-fields
   */
  static mapPresences(presences, client) {
    const presenceMap = new Map();
    presences.forEach(p => ParacordClient.upsertPresence(presenceMap, p, client));
    return presenceMap;
  }

  /**
   * Cache members and create a map of them keyed to their user ids.
   * @private
   *
   * @param {Array} members https://discordapp.com/developers/docs/resources/guild#guild-member-object
   */
  static mapMembers(members, guild, client) {
    const memberMap = new Map();
    members.forEach(m => Guild.upsertMember(memberMap, m, guild, client));
    return memberMap;
  }

  /**
   * Add a member with some additional information to a map of members.
   * @private
   *
   * @param {Map} members Map of members keyed to their user ids.
   * @param {Object} member https://discordapp.com/developers/docs/resources/guild#guild-member-object
   */
  static upsertMember(members, member, guild, client) {
    if (guild.presences.has(member.user.id)) {
      const cachedUser = ParacordClient.upsertUser(member.user, client);
      if (cachedUser !== undefined) {
        member.user = cachedUser;
        members.set(
          member.user.id,
          Object.assign(members.get(member.user.id) || {}, member)
        );
      }
    }
  }

  /**
   * Asynchronously gets the guild's owner member object from Discord and stores it in the guild.
   * @private
   *
   * @param {Object} guild https://discordapp.com/developers/docs/resources/guild#guild-object
   * @returns {Object} guild.owner <- https://discordapp.com/developers/docs/resources/guild#guild-member-object-guild-member-structure
   */
  static async lazyLoadGuildOwner(guild, client) {
    // TODO(lando): be a bit safer about this
    const res = await client.request({
      method: "get",
      endpoint: `guilds/${guild.id}/members/${guild.owner_id}`
    });

    if (res.status === 200) {
      // eslint-disable-next-line require-atomic-updates
      guild.owner = res.data;

      Guild.upsertMember(guild.members, res.data, guild, client);

      return guild.owner;
    } else {
      console.error(`Unable to get guild owner for ${guild.name} (ID: ${guild.id}). Owner ID: ${guild.owner_id}`);
    }
  }

  /**
   * Asynchronously gets the the bot's member object from Discord and stores it in the guild.
   * @private
   *
   * @param {Object} guild https://discordapp.com/developers/docs/resources/guild#guild-object
   * @returns {Object} guild.me <- https://discordapp.com/developers/docs/resources/guild#guild-member-object-guild-member-structure
   */
  static async lazyLoadGuildMe(guild, client) {
    // TODO(lando): be a bit safer about this

    const res = await client.request({
      method: "get",
      endpoint: `guilds/${guild.id}/members/${client.user.id}`
    });

    if (res.status === 200) {
      // eslint-disable-next-line require-atomic-updates
      guild.me = res.data;

      Guild.upsertMember(guild.members, guild.me, guild, client);

      return guild.me;
    } else {
      console.error(`Unable to get me for ${guild.name} (ID: ${guild.id}).`);
    }
  }
};
