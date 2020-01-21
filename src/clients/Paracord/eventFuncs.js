"use strict";
const Guild = require("./structures/Guild");
const {
  PARACORDUPDATEUSERWAITMILLISECONDS,
  CHANNELTYPE
} = require("../../utils/constants");

/** The methods in ALL_CAPS correspond to a Discord gateway event (https://discordapp.com/developers/docs/topics/gateway#commands-and-events-gateway-events) and are called in the Pararcord `.eventHandler()` method. */

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.READY = function(data) {
  this.handleReady(data);

  return data;
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.PRESENCE_UPDATE = function(data) {
  this.handlePresence(this.guilds.get(data.guild_id), data);

  return data;
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.USER_UPDATE = function(data) {
  if (!this.veryRecentlyUpdatedUsers.has(data.id)) {
    this.upsertUser(data);

    this.veryRecentlyUpdatedUsers.set(
      data.id,
      new Date().getTime() + PARACORDUPDATEUSERWAITMILLISECONDS
    );
  }

  return data;
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.MESSAGE_CREATE = function(data) {
  if (data.member !== undefined) {
    data.member.user = data.author;
    return this.cacheMemberFromEvent(
      this.guilds.get(data.guild_id),
      data.member
    );
  }
};
/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.MESSAGE_EDIT = function(data) {
  if (data.member !== undefined) {
    data.member.user = data.author;
    return this.cacheMemberFromEvent(
      this.guilds.get(data.guild_id),
      data.member
    );
  }

  return data;
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.MESSAGE_DELETE = function(data) {
  if (data.member !== undefined) {
    data.member.user = data.author;
    return this.cacheMemberFromEvent(
      this.guilds.get(data.guild_id),
      data.member
    );
  }

  return data;
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.VOICE_STATE_UPDATE = function(data) {
  const guild = this.guilds.get(data.guild_id);

  if (data.channel_id !== null) {
    Guild.upsertVoiceState(guild.voiceStates, data, guild, this);
  } else {
    guild.voiceStates.delete(data.user_id);
  }

  return this.cacheMemberFromEvent(this.guilds.get(data.guild_id), data.member);
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.GUILD_MEMBER_ADD = function(data) {
  const guild = this.guilds.get(data.guild_id);
  guild.upsertMember(data, this);
  ++guild.member_count;

  return data;
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.GUILD_MEMBER_UPDATE = function(data) {
  const guild = this.guilds.get(data.guild_id);
  guild.upsertMember(data, this);

  return data;
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.GUILD_MEMBER_REMOVE = function(data) {
  const guild = this.guilds.get(data.guild_id);
  guild.members.delete(data.user.id);
  guild.presences.delete(data.user.id);
  --guild.member_count;

  return data;
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.GUILD_MEMBERS_CHUNK = function(data) {
  const guild = this.guilds.get(data.guild_id);
  if (data.presences !== undefined) {
    data.presences.forEach(p => this.handlePresence(guild, p));
  }
  data.members.forEach(m => this.cacheMemberFromEvent(guild, m));

  return data;
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.CHANNEL_CREATE = function(data) {
  if (data.type !== CHANNELTYPE.DM && data.type !== CHANNELTYPE.GROUP_DM) {
    const guild = this.guilds.get(data.guild_id);
    Guild.upsertChannel(guild.channels, data);
  }

  return data;
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.CHANNEL_UPDATE = function(data) {
  const guild = this.guilds.get(data.guild_id);
  Guild.upsertChannel(guild.channels, data);

  return data;
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.CHANNEL_DELETE = function(data) {
  const guild = this.guilds.get(data.guild_id);
  guild.channels.delete(data.id);

  return data;
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.GUILD_ROLE_CREATE = function(data) {
  const guild = this.guilds.get(data.guild_id);
  Guild.upsertRole(guild.roles, data.role);

  return data;
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.GUILD_ROLE_UPDATE = function(data) {
  const guild = this.guilds.get(data.guild_id);
  Guild.upsertRole(guild.roles, data.role);

  return data;
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.GUILD_ROLE_DELETE = function(data) {
  const guild = this.guilds.get(data.guild_id);
  guild.roles.delete(data.role_id);

  return data;
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.GUILD_CREATE = function(data) {
  return this.upsertGuild(data);
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.GUILD_UPDATE = function(data) {
  return this.upsertGuild(data);
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.GUILD_DELETE = function(data) {
  const guild = this.guilds.get(data.id);
  if (guild !== undefined) {
    if (!data.unavailable) {
      this.guilds.delete(data.id);
      return guild;
    } else {
      return guild;
    }
  } else if (data.unavailable) {
    return this.upsertGuild(data);
  } else {
    return data;
  }
};
