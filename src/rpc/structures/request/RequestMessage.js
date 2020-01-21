"use strict";

/** A class for the ReequestMessage protobuf */
module.exports = class RequestMessage {
  /**
   * Create a new RequestMessage sent from client to server.
   *
   * @param {string} method HTTP method of the request.
   * @param {string} url Discord endpoint url. (e.g. channels/123)
   * @param {RequestOptions} options Optional parameters for this request.
   */
  constructor(method, url, options = {}) {
    /** @type {string} HTTP method of the request. */
    this.method = method;
    /** @type {string} Discord REST endpoint target of the request. (e.g. channels/123) */
    this.url = url;
    /** @type {*} Data to send in the body of the request. */
    this.data = options.data;
    /** @type {Object} Headers to send with the request. */
    this.headers = options.headers;
  }

  /** @type {RequestProto} The properties of this message formatted for sending over rpc. */
  get proto() {
    const proto = {
      method: this.method,
      url: this.url
    };

    if (this.data !== undefined) {
      proto.data = JSON.stringify(this.data);
    }

    if (this.headers !== undefined) {
      proto.headers = JSON.stringify(this.headers);
    }

    RequestMessage.validateOutgoing(proto);

    return proto;
  }

  /**
   * Verifies that the message being sent is valid.
   *
   * @param {RequestMessage} token
   */
  static validateOutgoing(request) {
    if (typeof request.method !== "string") {
      throw Error("'method' must be type 'string'");
    }
    if (typeof request.url !== "string") {
      throw Error("'url' must be type 'string'");
    }
    if (
      request.time_out !== undefined &&
      typeof request.time_out !== "number"
    ) {
      throw Error("'time_out' must be type 'number'");
    }
  }

  /**
   * Validates that the message being received is valid.
   *
   * @param {RequestProto} message
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
   * Validate incoming message and translate it into common state.
   *
   * @param {RequestProto} message
   * @returns {RequestMessage}
   */
  static fromProto(message) {
    RequestMessage.validateIncoming(message);

    const { method, url, ...options } = message;

    if (options.data) {
      options.data = JSON.parse(options.data);
    }
    if (options.headers) {
      options.headers = JSON.parse(options.headers);
    }

    return { method, url, options };
  }
};
