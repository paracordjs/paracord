/* eslint-disable callback-return */
"use strict";
const { RequestMessage, ResponseMessage } = require("../../structures");

/**
 * Create callback functions for the request service.
 *
 * @param {Server} server
 */
module.exports = function(server) {
  async function request(call, callback) {
    try {
      const { method, url, options } = RequestMessage.fromProto(call.request);

      const res = await server.apiClient.request(method, url, options);

      callback(
        null,
        new ResponseMessage(res.status, res.statusText, res.data).proto
      );
    } catch (err) {
      if (err.response) {
        callback(err);
      } else {
        callback(err);
      }
    }
  }

  return { request };
};
