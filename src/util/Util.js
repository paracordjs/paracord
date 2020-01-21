"use strict";
const { EPOCH, PERMISSIONS: P, DISCORDIMAGEBASEURL } = require("./constants");

module.exports = class Util {
  static timestampNSecondsInFuture(seconds) {
    return new Date().getTime() + Number(seconds) * 1000;
  }

  static timestampFromSnowflake(snowflake) {
    const bits = BigInt(snowflake)
      .toString(2)
      .padStart(64, "0");

    return parseInt(bits.substring(0, 42), 2) + EPOCH;
  }

  /**
   * This is a bot library. Non-compliant tokens are coerced to be bot-like.
   */
  static coerceTokenToBotLike(token) {
    if (!token.startsWith("Bot ")) return "Bot " + token;
    return token;
  }

  static coerceTokenFromBotLike(token) {
    if (token.startsWith("Bot ")) return token.replace("Bot ", "");
    return token;
  }

  static computeChannelPerms(member, guild, channel) {
    const guildPerms = this.computeGuildPerms(member, guild);
    if (guildPerms === P.ADMINISTRATOR) {
      return P.ADMINISTRATOR;
    }

    return this.computeChannelOverwrites(guildPerms, member, guild, channel);
  }

  static computeGuildPerms(member, guild) {
    // TODO(lando): member.user.id not always a thing
    if (guild.owner_id === member.user.id) {
      return P.ADMINISTRATOR;
    }

    const { roles } = guild;

    // start with @everyone perms
    let perms = roles.get(guild.id).permissions;

    for (const id of member.roles) {
      const role = roles.get(id);
      if (role !== undefined) {
        if ((role.permissions & P.ADMINISTRATOR) !== 0) {
          return P.ADMINISTRATOR;
        }

        perms |= role.permissions;
      }
    }

    return perms;
  }

  static computeChannelOverwrites(perms, member, guild, channel) {
    const { permission_overwrites: overwrites } = channel;

    perms = this._everyoneOverwrites(perms, overwrites, guild.id);
    perms = this._roleOverwrites(perms, overwrites, member.roles);
    perms = this._memberOverwrites(perms, overwrites, member.user.id);

    return perms;
  }

  static _everyoneOverwrites(perms, overwrites, guildID) {
    for (const o of overwrites) {
      if (o.type === "role" && o.id === guildID) {
        perms |= o.allow;
        perms &= ~o.deny;
        break;
      }
    }
    return perms;
  }

  static _roleOverwrites(perms, overwrites, roles) {
    for (const o of overwrites) {
      if (o.type === "role" && roles.includes(o.id)) {
        perms |= o.allow;
        perms &= ~o.deny;
      }
    }

    return perms;
  }

  static _memberOverwrites(perms, overwrites, memberID) {
    for (const o of overwrites) {
      if (o.type === "member" && o.id === memberID) {
        perms |= o.allow;
        perms &= ~o.deny;
        break;
      }
    }
    return perms;
  }

  static constructUserAvatarUrl(user) {
    if (user.avatar === null || user.avatar === undefined) {
      return `${DISCORDIMAGEBASEURL}embed/avatars/${Number(user.discriminator) %
        5}.png`;
    }

    if (user.avatar.startsWith("a_")) {
      return `${DISCORDIMAGEBASEURL}avatars/${user.id}/${user.avatar}.gif`;
    }

    return `${DISCORDIMAGEBASEURL}avatars/${user.id}/${user.avatar}.png`;
  }

  static constructUserTag(user) {
    return `${user.username}#${user.discriminator}`;
  }
};
