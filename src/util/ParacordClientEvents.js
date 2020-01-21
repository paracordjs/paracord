"use strict";
const ParacordClient = require("../ParacordClient");
const Guild = require("../structures/Guild");

/** The methods in this file correspond to a Discord gateway event and are called in the client.eventHandler() method. */

/**  @param {Object} data From Discord. More information on a particular payload can be found in the official dovs. https://discordapp.com/developers/docs/topics/gateway#commands-and-events */

/** @private @param {ParacordClient} client */
exports.READY = (client, data) => {
  client.handleReady(data);
};

/** @private @param {ParacordClient} client */
exports.PRESENCE_UPDATE = (client, data) => {
  if (!client.veryRecentlyUpdatedPresences.has(data.user.id)) {
    const guild = client.guilds.get(data.guild_id);
    if (guild !== undefined) {
      return ParacordClient.updateCachesOnPresence(
        guild.presences,
        data,
        client
      );
    }
  } else {
    client.veryRecentlyUpdatedPresences.set(
      data.user.id,
      new Date().getTime() + 500
    );

    const cachedPresence = client.presences.get(data.user.id);
    if (cachedPresence !== undefined) {
      return cachedPresence;
    } else {
      return data;
    }
  }
};

/** @private @param {ParacordClient} client */
exports.USER_UPDATE = (client, data) => {
  if (!client.veryRecentlyUpdatedUsers.has(data.id)) {
    return ParacordClient.upsertUser(data, client);
  } else {
    client.veryRecentlyUpdatedUsers.set(data.id, new Date().getTime() + 500);

    const cachedUser = client.users.get(data.id);
    if (cachedUser !== undefined) {
      return cachedUser;
    } else {
      return data;
    }
  }
};

/** @private @param {ParacordClient} client */
exports.MESSAGE_CREATE = (client, data) => exports.cacheMemberFromMessage(client, data);
/** @private @param {ParacordClient} client */
exports.MESSAGE_EDIT = (client, data) => exports.cacheMemberFromMessage(client, data);
/** @private @param {ParacordClient} client */
exports.MESSAGE_DELETE = (client, data) => exports.cacheMemberFromMessage(client, data);

exports.cacheMemberFromMessage = (client, data) => {
  if (data.member !== undefined) {
    data.member.user = data.author;

    const guild = client.guilds.get(data.guild_id);
    if (
      guild !== undefined &&
      !guild.members.has(data.member.user.id) &&
      client.presences.has(data.member.user.id)
    ) {
      Guild.upsertMember(guild.members, data.member, guild, client);
    }
  }

  return data;
};

/** @private @param {ParacordClient} client */
exports.GUILD_MEMBER_ADD = (client, data) => {
  const guild = client.guilds.get(data.guild_id);
  if (guild !== undefined) {
    Guild.upsertMember(guild.members, data, guild, client);
    ++guild.member_count;
  }

  return data;
};
/** @private @param {ParacordClient} client */
exports.GUILD_MEMBER_UPDATE = (client, data) => {
  const guild = client.guilds.get(data.guild_id);
  if (guild !== undefined) {
    Guild.upsertMember(guild.members, data, guild, client);
  }

  return data;
};
/** @private @param {ParacordClient} client */
exports.GUILD_MEMBER_REMOVE = (client, data) => {
  const guild = client.guilds.get(data.guild_id);
  if (guild !== undefined) {
    if (data.user.id !== guild.owner_id && data.user.id !== client.user.id) {
      guild.members.delete(data.user.id);
    }
    --guild.member_count;
  }

  return data;
};

/** @private @param {ParacordClient} client */
exports.CHANNEL_CREATE = (client, data) => {
  const guild = client.guilds.get(data.guild_id);
  if (guild !== undefined) {
    Guild.upsertChannel(guild.channels, data);
  }

  return data;
};
/** @private @param {ParacordClient} client */
exports.CHANNEL_UPDATE = (client, data) => {
  const guild = client.guilds.get(data.guild_id);
  if (guild !== undefined) {
    Guild.upsertChannel(guild.channels, data);
  }

  return data;
};
/** @private @param {ParacordClient} client */
exports.CHANNEL_DELETE = (client, data) => {
  const guild = client.guilds.get(data.guild_id);
  if (guild !== undefined) {
    guild.channels.delete(data.id);
  }

  return data;
};

/** @private @param {ParacordClient} client */
exports.GUILD_ROLE_CREATE = (client, data) => {
  const guild = client.guilds.get(data.guild_id);
  if (guild !== undefined) {
    Guild.upsertRole(guild.roles, data.role);
  }

  return data;
};
/** @private @param {ParacordClient} client */
exports.GUILD_ROLE_UPDATE = (client, data) => {
  const guild = client.guilds.get(data.guild_id);
  if (guild !== undefined) {
    Guild.upsertRole(guild.roles, data.role);
  }

  return data;
};
/** @private @param {ParacordClient} client */
exports.GUILD_ROLE_DELETE = (client, data) => {
  const guild = client.guilds.get(data.guild_id);
  if (guild !== undefined) {
    guild.roles.delete(data.role_id);
  }

  return data;
};

/** @private @param {ParacordClient} client */
exports.GUILD_CREATE = (client, data) => {
  return ParacordClient.upsertGuild(data, client);
};
/** @private @param {ParacordClient} client */
exports.GUILD_UPDATE = (client, data) => {
  return ParacordClient.upsertGuild(data, client);
};
/** @private @param {ParacordClient} client */
exports.GUILD_DELETE = (client, data) => {
  const guild = client.guilds.get(data.id);
  if (guild !== undefined) {
    if (!data.unavailable) {
      client.guilds.delete(data.id);
      return guild;
    } else {
      return guild;
    }
  } else if (data.unavailable) {
    return ParacordClient.upsertGuild(data, client);
  } else {
    return data;
  }
};
