'use strict';

const { SECOND_IN_MILLISECONDS } = require('../../utils/constants');

const Guild = require('./structures/Guild');
const {
  PARACORD_UPDATE_USER_WAIT_MILLISECONDS,
  CHANNEL_TYPES,
} = require('../../utils/constants');

/** The methods in ALL_CAPS correspond to a Discord gateway event (https://discordapp.com/developers/docs/topics/gateway#commands-and-events-gateway-events) and are called in the Pararcord `.eventHandler()` method. */

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.READY = function READY(data) {
  this.handleReady(data);

  return data;
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.PRESENCE_UPDATE = function PRESENCE_UPDATE(data) {
  this.handlePresence(this.guilds.get(data.guild_id), data);

  return data;
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.USER_UPDATE = function USER_UPDATE(data) {
  if (!this.veryRecentlyUpdatedUsers.has(data.id)) {
    this.upsertUser(data);

    this.veryRecentlyUpdatedUsers.set(
      data.id,
      new Date().getTime() + PARACORD_UPDATE_USER_WAIT_MILLISECONDS,
    );
  }

  return data;
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.MESSAGE_CREATE = function MESSAGE_CREATE(data) {
  if (data.member !== undefined) {
    data.member.user = data.author;
    this.cacheMemberFromEvent(
      this.guilds.get(data.guild_id),
      data.member,
    );
  }

  return data;
};
/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.MESSAGE_EDIT = function MESSAGE_EDIT(data) {
  if (data.member !== undefined) {
    data.member.user = data.author;
    return this.cacheMemberFromEvent(
      this.guilds.get(data.guild_id),
      data.member,
    );
  }

  return data;
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.MESSAGE_DELETE = function MESSAGE_DELETE(data) {
  if (data.member !== undefined) {
    data.member.user = data.author;
    return this.cacheMemberFromEvent(
      this.guilds.get(data.guild_id),
      data.member,
    );
  }

  return data;
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.VOICE_STATE_UPDATE = function VOICE_STATE_UPDATE(data) {
  const guild = this.guilds.get(data.guild_id);

  if (guild) {
    if (data.channel_id !== null) {
      Guild.upsertVoiceState(guild.voiceStates, data, guild, this);
    } else {
      guild.voiceStates.delete(data.user_id);
    }
  }

  return this.cacheMemberFromEvent(this.guilds.get(data.guild_id), data.member);
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.GUILD_MEMBER_ADD = function GUILD_MEMBER_ADD(data) {
  const guild = this.guilds.get(data.guild_id);
  if (guild) {
    guild.upsertMember(data, this);
    ++guild.member_count;
  }

  return data;
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.GUILD_MEMBER_UPDATE = function GUILD_MEMBER_UPDATE(data) {
  const guild = this.guilds.get(data.guild_id);
  if (guild) {
    guild.upsertMember(data, this);
  }
  return data;
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.GUILD_MEMBER_REMOVE = function GUILD_MEMBER_REMOVE(data) {
  const guild = this.guilds.get(data.guild_id);
  if (guild) {
    guild.members.delete(data.user.id);
    guild.presences.delete(data.user.id);
    --guild.member_count;
  }

  return data;
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.GUILD_MEMBERS_CHUNK = function GUILD_MEMBERS_CHUNK(data) {
  const guild = this.guilds.get(data.guild_id);
  if (data.presences !== undefined) {
    data.presences.forEach((p) => this.handlePresence(guild, p));
  }
  data.members.forEach((m) => this.cacheMemberFromEvent(guild, m));

  return data;
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.CHANNEL_CREATE = function CHANNEL_CREATE(data) {
  if (data.type !== CHANNEL_TYPES.DM && data.type !== CHANNEL_TYPES.GROUP_DM) {
    const guild = this.guilds.get(data.guild_id);
    if (guild) {
      Guild.upsertChannel(guild.channels, data);
    }
  }

  return data;
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.CHANNEL_UPDATE = function CHANNEL_UPDATE(data) {
  const guild = this.guilds.get(data.guild_id);
  if (guild) {
    Guild.upsertChannel(guild.channels, data);
  }

  return data;
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.CHANNEL_DELETE = function CHANNEL_DELETE(data) {
  const guild = this.guilds.get(data.guild_id);
  guild.channels.delete(data.id);

  return data;
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.GUILD_ROLE_CREATE = function GUILD_ROLE_CREATE(data) {
  const guild = this.guilds.get(data.guild_id);
  Guild.upsertRole(guild.roles, data.role);

  return data;
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.GUILD_ROLE_UPDATE = function GUILD_ROLE_UPDATE(data) {
  const guild = this.guilds.get(data.guild_id);
  Guild.upsertRole(guild.roles, data.role);

  return data;
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.GUILD_ROLE_DELETE = function GUILD_ROLE_DELETE(data) {
  const guild = this.guilds.get(data.guild_id);
  guild.roles.delete(data.role_id);

  return data;
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.GUILD_CREATE = function GUILD_CREATE(data, shard) {
  data._shard = shard;
  return this.upsertGuild(data);
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.GUILD_UPDATE = function GUILD_UPDATE(data) {
  return this.upsertGuild(data);
};

/**
 * @private
 * @this {Paracord}
 * @param {Object<string, any>} data From Discord.
 */
exports.GUILD_DELETE = function GUILD_DELETE(data) {
  const guild = this.guilds.get(data.id);
  if (guild !== undefined) {
    if (!data.unavailable) {
      this.guilds.delete(data.id);
      return guild;
    }
    return guild;
  }

  if (data.unavailable) {
    return this.upsertGuild(data);
  }

  return data;
};

/**
 * @private
 * @this {Paracord}
 * @param {Identity} identity From a gateway client.
 */
exports.GATEWAY_IDENTIFY = function GATEWAY_IDENTIFY(identity) {
  this.safeGatewayIdentifyTimestamp = new Date().getTime() + (5 * SECOND_IN_MILLISECONDS);

  const { shard: { 0: shard } } = identity;
  for (const guild of this.guilds.values()) {
    if (guild.shard === shard) {
      this.guilds.delete(guild.id);
    }
  }
};

/**
 * @private
 * @this {Paracord}
 * @param {Identity} identity From a gateway client.
 */
exports.GATEWAY_CLOSE = function GATEWAY_CLOSE({ shouldReconnect, gateway }) {
  if (shouldReconnect) {
    this.gatewayLoginQueue.push(gateway);

    if (gateway.shard === this.startingShard) {
      this.startingShard = null;
    }
  }
};
