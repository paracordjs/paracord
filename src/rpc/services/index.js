'use strict';

module.exports = {
  /* Identify Lock */
  identifyLockCallbacks: require('./identifyLock/callbacks'),
  IdentifyLockService: require('./identifyLock/IdentifyLockService'),
  /* Rate Limit */
  rateLimitCallbacks: require('./rateLimit/callbacks'),
  RateLimitService: require('./rateLimit/RateLimitService'),
  /* Request */
  requestCallbacks: require('./request/callbacks'),
  RequestService: require('./request/RequestService'),
};
