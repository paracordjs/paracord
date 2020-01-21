"use strict";

/** A class for the ResponseMessage protobuf */
module.exports = class ResponseMessage {
  /**
   * Creates a new ResponseMessage send from server to client.
   *
   * @param {number} status The HTTP status code of the response.
   * @param {string} statuxText Status mssage returned by the server. (e.g. "OK" with a 200 status)
   * @param {*} data The data returned by Discord.
   */
  constructor(status, statusText, data) {
    this.status = status;
    this.statusText = statusText;
    this.data = data;
  }

  /** @type {ResponseProto} The properties of this message formatted for sending over rpc. */
  get proto() {
    return {
      status_code: this.status,
      status_text: this.statusText,
      data: this.data
    };
  }

  /**
   * Validates that the message being received is valid.
   *
   * @param {ResponseProto} message
   */
  static validateIncoming(response) {
    if (response.status_code === undefined) {
      throw Error("received invalid message. missing property 'status_code'");
    }
  }

  /**
   * Validate incoming message and translate it into common state.
   *
   * @param {ResponseProto} message
   * @returns {ApiResponse}
   */
  static fromProto(message) {
    ResponseMessage.validateIncoming(message);

    const { status_code: status, status_text: statusText, data } = message;

    return {
      status,
      statusText,
      data: data.startsWith("{") ? JSON.parse(data) : data
    };
  }
};
