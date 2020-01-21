"use strict";

/** A class for the TokenMessage protobuf. */
module.exports = class TokenMessage {
  /**
   * Create a new TokenMessage sent from the client to server.
   *
   * @param {string} value The unique ID given to the last client to acquire the lock.
   */
  constructor(value) {
    this.value = value;
  }

  /** @type {TokenProto} The properties of this message formatted for sending over rpc. */
  get proto() {
    TokenMessage.validateOutgoing(this);

    return { value: this.value };
  }

  /**
   * Verifies that the message being sent is valid.
   *
   * @param {TokenMessage} token
   */
  static validateOutgoing(token) {
    if (token.value === undefined) {
      throw Error("'value' must be a defined string");
    }
    if (typeof token.value !== "string") {
      throw Error("'value' must be type 'string'");
    }
  }

  /**
   * Validates that the message being received is valid.
   *
   * @param {TokenProto} message
   */
  static validateIncoming(message) {
    if (message.value === undefined) {
      throw Error("received invalid message. missing property 'value'");
    }
  }

  /**
   * Validate incoming message and translate it into common state.
   *
   * @param {TokenProto} message
   * @returns {TokenMessage}
   */
  static fromProto(message) {
    TokenMessage.validateIncoming(message);

    return new TokenMessage(message.value);
  }
};
