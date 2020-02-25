'use strict';

// const TokenMessage = require("./TokenMessage");

/** A class for the StatusMessage protobuf. */
module.exports = class StatusMessage {
  /**
   * Creates a new StatusMessage sent from server to client.
   *
   * @param {boolean} didSucceed Whether or not the operation was successful.
   * @param {string|void} message Reason why the operation failed.
   * @param {string|void} token Unique ID given to the last client to acquire the lock.
   */
  constructor(didSucceed, message, token) {
    this.success = didSucceed;
    this.message = message;
    this.token = token;
    // if (token !== undefined) {
    //   this.token = new TokenMessage(token);
    // }
  }

  /** @type {StatusProto} The properties of this message formatted for sending over rpc. */
  get proto() {
    StatusMessage.validateOutgoing(this);

    return {
      success: this.success,
      message: this.message,
      token: this.token,
    };
  }

  /**
   * Verifies that the message being sent is valid.
   *
   * @param {StatusMessage} status
   */
  static validateOutgoing(status) {
    if (typeof status.success !== 'boolean') {
      throw Error("'success' must be type 'boolean'");
    }
    if (status.success === false && !status.message) {
      throw Error("a message must be provided when 'success' is false");
    }
  }

  /**
   * Validates that the message being received is valid.
   *
   * @param {StatusProto} message
   */
  static validateIncoming(message) {
    if (message.success === undefined) {
      throw Error("received invalid message. missing property 'success'");
    }
  }

  /**
   * Validate incoming message and translate it into common state.
   *
   * @param {StatusProto} message
   * @returns {StatusMessage}
   */
  static fromProto(message) {
    this.validateIncoming(message);

    return new StatusMessage(
      message.success,
      message.message,
      message.token,
      // message.token ? TokenMessage.fromProto(message.token).value : undefined
    );
  }
};
