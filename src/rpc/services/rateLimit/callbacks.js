/* eslint-disable callback-return */
"use strict";
const {
  RequestMetaMessage,
  AuthorizationMessage,
  RateLimitStateMessage
} = require("../../structures");
const {
  BaseRequest,
  RateLimitHeaders
} = require("../../../clients/Api/structures");
const { LOGSOURCE, LOGLEVEL } = require("../../../utils/constants");

/**
 * Create callback functions for the rate limit service.
 *
 * @param {Server} server
 * @param {RateLimitCache} cache
 */
module.exports = function(server, cache) {
  function authorize(call, callback) {
    try {
      const { method, url } = RequestMetaMessage.fromProto(call.request);
      const request = new BaseRequest(method, url);
      const resetAfter = cache.authorizeRequestFromClient(request);

      if (resetAfter === 0) {
        const message = `Request approved. ${method} ${url}`;
        server.log("DEBUG", message);
      } else {
        const message = `Request denied. ${method} ${url}`;
        server.log("DEBUG", message);
      }

      const message = new AuthorizationMessage(resetAfter).proto;

      callback(null, message);
    } catch (err) {
      server.emit("DEBUG", {
        source: LOGSOURCE.RPC,
        level: LOGLEVEL.ERROR,
        message: err
      });
      callback(err);
    }
  }

  function update(call, callback) {
    try {
      const {
        requestMeta,
        global,
        bucket,
        limit,
        remaining,
        resetAfter
      } = RateLimitStateMessage.fromProto(call.request);

      const { method, url } = requestMeta;
      const request = new BaseRequest(method, url);

      if (bucket === undefined) {
        cache.update(request);
      } else {
        const rateLimitHeaders = new RateLimitHeaders(
          global,
          bucket,
          limit,
          remaining,
          resetAfter
        );
        cache.update(request, rateLimitHeaders);
      }

      const message = `Rate limit cache updated: ${method} ${url} | Remaining: ${remaining}`;
      server.log("DEBUG", message);

      callback(null);
    } catch (err) {
      server.emit("DEBUG", {
        source: LOGSOURCE.RPC,
        level: LOGLEVEL.ERROR,
        message: err.message
      });
      callback(err);
    }
  }

  return { authorize, update };
};
