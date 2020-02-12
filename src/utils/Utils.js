"use strict";
const { DISCORDEPOCH, PERMISSIONS: P, DISCORDIMAGEBASEURL } = require("./constants");

/** A class of help functions used throughout the library. */
module.exports = class Util {
  /**
   * Returns a timestamp of some time in the future.
   *
   * @param {number} seconds Number of seconds from now to base the timestamp on.
   */
  static timestampNSecondsInFuture(seconds) {
    return new Date().getTime() + Number(seconds) * 1000;
  }

    /**
   * Returns a timestamp of some time in the future.
   *
   * @param {number} milliseconds Number of milliseconds from now to base the timestamp on.
   */
  static timestampNMillisecondsInFuture(milliseconds) {
    return new Date().getTime() + Number(milliseconds);
  }

  static millisecondsFromNow(timestamp) {
    return Number(timestamp) - new Date().getTime();
  }
  /**
   * Extract a timestamp from a Discord snowflake.
   *
   * @param {string} snowflake Discord snowflake.
   */
  static timestampFromSnowflake(snowflake) {
    // eslint-disable-next-line no-undef
    const bits = BigInt(snowflake)
      .toString(2)
      .padStart(64, "0");

    return parseInt(bits.substring(0, 42), 2) + DISCORDEPOCH;
  }

  /**
   * This is a bot library. Coerced non-compliant tokens to be bot-like.
   *
   * @param {string} token Discord token.
   */
  static coerceTokenToBotLike(token) {
    if (!token.startsWith("Bot ")) return "Bot " + token;
    return token;
  }

  /**
   * Compute a member's channel-level permissions.
   *
   * @param {Object<string, any>} member Member whose perms to check.
   * @param {Guild} guild Guild in which to check the member's permissions.
   * @param {Object<string, any>} channel Channel in which to check the member's permissions.
   * @param {boolean} [stopOnOwnerAdmin] Whether or not to stop and return the Administrator perm if the user qualifies.
   * @returns {number} THe Administrator perm or the new perms.
   */
  static computeChannelPerms(member, guild, channel, stopOnOwnerAdmin = false) {
    const guildPerms = this.computeGuildPerms(member, guild, stopOnOwnerAdmin);

    if (stopOnOwnerAdmin && guildPerms & P.ADMINISTRATOR) {
      return P.ADMINISTRATOR;
    }

    return this.computeChannelOverwrites(guildPerms, member, guild, channel);
  }

  /**
   * Compute a member's guild-level permissions.
   *
   * @param {Object<string, any>} member Member whose perms to check.
   * @param {Guild} guild Guild in which to check the member's permissions.
   * @param {boolean} [stopOnOwnerAdmin] Whether or not to stop and return the Administrator perm if the user qualifies.
   * @returns {number} THe Administrator perm or the new perms.
   */
  static computeGuildPerms(member, guild, stopOnOwnerAdmin = false) {
    if (stopOnOwnerAdmin && guild.owner_id === member.user.id) {
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

  /**
   * Compute the channel's overriding permissions against the member's channel-level permissions.
   *
   * @param {number} perms Member's channel-level permissions.
   * @param {Object<string, any>} member Member whose perms to check.
   * @param {Guild} guild Guild in which to check the member's permissions.
   * @param {Object<string, any>} channel Channel in which to check the member's permissions.
   * @returns {number} The new perms.
   */
  static computeChannelOverwrites(perms, member, guild, channel) {
    const { permission_overwrites: overwrites } = channel;

    perms = this._everyoneOverwrites(perms, overwrites, guild.id);
    perms = this._roleOverwrites(perms, overwrites, member.roles);
    perms = this._memberOverwrites(perms, overwrites, member.user.id);

    return perms;
  }

  /**
   * When computing channel overwrites, applies the "@everyone" overwrite.
   * @private
   *
   * @param {number} perms Member's channel-level permissions.
   * @param {[Object<string, string|number>]} overwrites Channel's overwrites.
   * @param {string} guildId ID of the guild in which the permissions are being checked.
   * @returns {number} The new perms.
   */
  static _everyoneOverwrites(perms, overwrites, guildId) {
    for (const o of overwrites) {
      if (o.type === "role" && o.id === guildId) {
        perms |= o.allow;
        perms &= ~o.deny;
        break;
      }
    }
    return perms;
  }

  /**
   * When computing channel overwrites, applies the role overwrites.
   * @private
   *
   * @param {number} perms Member's channel-level permissions.
   * @param {[Object<string, string|number>]} overwrites Channel's overwrites.
   * @param {Map<string, any>} roles Roles in the guild in which the permissions are being checked.
   * @returns {number} The new perms.
   */
  static _roleOverwrites(perms, overwrites, roles) {
    for (const o of overwrites) {
      if (o.type === "role" && roles.includes(o.id)) {
        perms |= o.allow;
        perms &= ~o.deny;
      }
    }

    return perms;
  }

  /**
   * When computing channel overwrites, applies the member overwrites.
   * @private
   *
   * @param {number} perms Member's channel-level permissions.
   * @param {[Object<string, string|number>]} overwrites Channel's overwrites.
   * @param {string} memberId ID of the member whose permissions are being checked.
   * @returns {number} The new perms.
   */
  static _memberOverwrites(perms, overwrites, memberId) {
    for (const o of overwrites) {
      if (o.type === "member" && o.id === memberId) {
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

  /**
   * Appends a user's username to their descriminator in a common format.
   *
   * @param {Object<string, any>} user
   */
  static constructUserTag(user) {
    return `${user.username}#${user.discriminator}`;
  }

  /**
   * Assigns functions to an object and binds that object to their `this`.
   *
   * @param {Object<string, any>} obj Object to bind to functions and assign functions those functions as properties.
   * @param {Object<string, Function>} funcs Functions to assign to object.
   */
  static bindFunctionsFromFile(obj, funcs) {
    for (const prop of Object.getOwnPropertyNames(funcs)) {
      if (typeof funcs[prop] === "function") {
        obj[prop] = funcs[prop].bind(obj);
      }
    }
  }

  /**
   * Generates a unique Id.
   *
   * https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
   * @returns {string}
   */
  static uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0,
        v = c == "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Assigns to a Discord object's the timestamp of when it was created.
   *
   * @param {Object<string, any>} obj Discord object with a snowflake ID.
   */
  static assignCreatedOn(obj) {
    if (obj.created_on === undefined) {
      obj.created_on = this.timestampFromSnowflake(obj.id);
    }
  }
};
