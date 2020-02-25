'use strict';

/**  A container of information for identifying with the gateway. https://discordapp.com/developers/docs/topics/gateway#identify-identify-structure */
module.exports = class Identity {
  /**
   * Creates a new Identity object for use wuth the gateway.
   *
   * @param {string} token Bot token.
   * @param {void|Object<string, any>} [identity] Properties to add to this identity.
   */
  constructor(token, identity = {}) {
    /** @type {Object<string, any>} Information about platform the client is connecting from. */
    this.properties = {
      os: process.platform,
      browser: 'Paracord',
      device: 'Paracord',
    };

    /** @type {Object<string, any>} Presence of the bot when identifying. */
    this.presence = {
      status: 'online',
      afk: false,
    };

    Object.assign(this, identity);

    this.shard = [Number(this.shard[0]), Number(this.shard[1])];

    /** @type {string} Bot token. */
    this.token = token;
  }
};
