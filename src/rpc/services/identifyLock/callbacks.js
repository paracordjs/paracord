/* eslint-disable callback-return */

'use strict';

const { LockRequestMessage, TokenMessage } = require('../../structures');
const { LOG_SOURCES, LOG_LEVELS } = require('../../../utils/constants');

/**
 * Create callback functions for the identify lock service.
 *
 * @param {Server} server
 * @param {Lock} identifyLock
 */
module.exports = function (server, identifyLock) {
  function acquire(call, callback) {
    try {
      const { timeOut, token } = LockRequestMessage.fromProto(call.request);

      const message = identifyLock.acquire(timeOut, token);

      callback(null, message);
    } catch (err) {
      server.emit('DEBUG', {
        source: LOG_SOURCES.RPC,
        level: LOG_LEVELS.ERROR,
        message: err.message,
      });
      callback(err);
    }
  }

  function release(call, callback) {
    try {
      const { value: token } = TokenMessage.fromProto(call.request);

      const message = identifyLock.release(token);

      if (message.success !== undefined) {
        server.emit('DEBUG', {
          source: LOG_SOURCES.RPC,
          level: LOG_LEVELS.DEBUG,
          message: `Lock released by client. Token: ${token}`,
        });
      }

      callback(null, message);
    } catch (err) {
      server.emit('DEBUG', {
        source: LOG_SOURCES.RPC,
        level: LOG_LEVELS.ERROR,
        message: err.message,
      });
      callback(err);
    }
  }

  return { acquire, release };
};
