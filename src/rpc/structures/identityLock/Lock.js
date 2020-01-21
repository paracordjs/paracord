"use strict";
const StatusMessage = require("./StatusMessage");
const Utils = require("../../../utils");
const { LOGSOURCE, LOGLEVEL } = require("../../../utils/constants");

/**
 * A mutex primarily used by gateway clients to coordinate identifies.
 * Grants a token to clients that acquire the lock that will allow that
 * client to perform further operations on it (e,g. release the lock or
 * refresh the timeout).
 */
module.exports = class Lock {
  /**
   * Creates a new lock.
   *
   * @param {import("events").EventEmitter} emitter Emitter for log events.
   */
  constructor(emitter) {
    /**
     * @type {string|void} A unique ID given to the client who currently has the lock
     * `undefined` indicates that the lock is available.
     */
    this.token;
    /** @type {NodeJS.Timeout} The timeout that will unlock the lock after a time specified by the client. */
    this.lockTimeout;
    this.emitter = emitter;
  }

  /**
   * Attempts to acquire the lock.
   *
   * @param {number} timeOut How long in ms to wait before expiring the lock.
   * @param {string|void} token Unique ID given to the last client to acquire the lock.
   */
  acquire(timeOut, token) {
    let success = false;
    let message;

    if (this.token === undefined) {
      token = Utils.uuid();
      this.lock(timeOut, token);
      success = true;
    } else if (this.token === token) {
      this.lock(timeOut, token);
      success = true;
    } else {
      message = "Already locked by a different client.";
      token = undefined;
    }

    return new StatusMessage(success, message, token);
  }

  /**
   * Attempts to release the lock.
   *
   * @param {string} token Unique ID given to the last client to acquire the lock.
   */
  release(token) {
    let success = false;
    let message;

    if (this.token === undefined) {
      success = true;
    } else if (token === undefined) {
      message = "No token provided.";
    } else if (this.token === token) {
      this.unlock();
      success = true;
    } else {
      message = "Locked by a different client.";
    }

    return new StatusMessage(success, message);
  }

  /**
   * Sets lock and sets an expire timer.
   *
   * @param {number} timeOut How long in ms to wait before expiring the lock.
   * @param {string|void} token The token to set the lock under.
   */
  lock(timeOut, token) {
    let message;
    if (this.lockTimeout === undefined) {
      message = `Lock acquired. Timeout: ${timeOut}ms. Token: ${token}`;
    } else {
      message = `Lock refreshed. Token: ${token}`;
    }
    this.emitter.emit("DEBUG", {
      source: LOGSOURCE.RPC,
      level: LOGLEVEL.DEBUG,
      message
    });

    clearTimeout(this.lockTimeout);
    this.token = token;
    this.lockTimeout = setTimeout(() => {
      this.release(token);
      this.emitter.emit("DEBUG", {
        source: LOGSOURCE.RPC,
        level: LOGLEVEL.DEBUG,
        message: `Lock expired after ${timeOut}ms. Token: ${token}`
      });
    }, timeOut);
  }

  /** Makes the lock available and clears the expire timer. */
  unlock() {
    clearTimeout(this.lockTimeout);
    this.lockTimeout = undefined;
    this.token = undefined;
  }
};
