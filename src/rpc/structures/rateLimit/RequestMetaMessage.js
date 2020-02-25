'use strict';

/** A class for the RequestMetaMessage protobuf. */
module.exports = class RequestMetaMessage {
  /**
   * Creates a new RequestMetaMessage sent from client to server.
   *
   * @param {string} method HTTP method of the request.
   * @param {string|void} url Discord endpoint url. (e.g. channels/123)
   */
  constructor(method, url) {
    /** @type {string} HTTP method of the request. */
    this.method = method;
    /** @type {string} Discord endpoint url. (e.g. channels/123) */
    this.url = url;
  }

  /** @type {RequestMetaProto} The properties of this message formatted for sending over rpc. */
  get proto() {
    RequestMetaMessage.validateOutgoing(this);

    return { method: this.method, url: this.url };
  }

  /**
   * Verifies that the message being sent is valid.
   *
   * @param {RequestMetaMessage} requestMeta
   */
  static validateOutgoing(requestMeta) {
    if (requestMeta.method === undefined) {
      throw Error("'method' must be a defined string");
    }
    if (requestMeta.url === undefined) {
      throw Error("'url' must be a defined string");
    }
  }

  /**
   * Validates that the message being received is valid.
   *
   * @param {RequestMetaProto} message
   */
  static validateIncoming(message) {
    if (message.method === undefined) {
      throw Error("received invalid message. missing property 'method'");
    }
    if (message.url === undefined) {
      throw Error("received invalid message. missing property 'url'");
    }
  }

  /**
   * Translates the rpc message into an instance of this class.
   *
   * @param {RequestMetaProto} message
   * @return {RequestMetaMessage}
   */
  static fromProto(message) {
    RequestMetaMessage.validateIncoming(message);

    return new RequestMetaMessage(message.method, message.url);
  }
};
