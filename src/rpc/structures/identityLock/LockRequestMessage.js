'use strict';

/** A class for the LockRequestMessage protobuf. */
module.exports = class LockRequestMessage {
  /**
   * Creates a new LockRequestMessage sent from client to server.
   *
   * @param {number} timeOut How long in ms the server should wait before expiring the lock.
   * @param {string|void} token Unique ID given to the last client to acquire the lock.
   */
  constructor(timeOut, token) {
    /** @type {number} How long in ms the server should wait before expiring the lock. */
    this.timeOut = timeOut;
    /** @type {string|void} Unique ID given to the last client that acquired the lock. */
    this.token = token;
  }

  /** @type {LockRequestProto} The properties of this message formatted for sending over rpc. */
  get proto() {
    LockRequestMessage.validateOutgoing(this);

    return { time_out: this.timeOut, token: this.token };
  }

  /**
   * Verifies that the message being sent is valid.
   *
   * @param {LockRequestMessage} lockRequest
   */
  static validateOutgoing(lockRequest) {
    if (lockRequest.timeOut === undefined) {
      throw Error("'timeOut' must be a defined number");
    }
    if (typeof lockRequest.timeOut !== 'number') {
      throw Error("'timeOut' must be type 'number'");
    }
    if (lockRequest.token !== undefined && typeof lockRequest.token !== 'string') {
      throw Error("'token' must be type 'string'");
    }
  }

  /**
   * Validates that the message being received is valid.
   *
   * @param {LockRequestProto} message
   */
  static validateIncoming(message) {
    if (message.time_out === undefined) {
      throw Error("received invalid message. missing property 'time_out'");
    }
  }

  /**
   * Translates the rpc message into an instance of this class.
   *
   * @param {LockRequestProto} message
   * @return {LockRequestMessage}
   */
  static fromProto(message) {
    LockRequestMessage.validateIncoming(message);

    return new LockRequestMessage(message.time_out, message.token);
  }
};
