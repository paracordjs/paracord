'use strict';

module.exports = {
  /* Identify Lock */
  Lock: require('./identityLock/Lock'),
  LockRequestMessage: require('./identityLock/LockRequestMessage'),
  /* Request */
  TokenMessage: require('./identityLock/TokenMessage'),
  StatusMessage: require('./identityLock/StatusMessage'),
  RequestMessage: require('./request/RequestMessage'),
  ResponseMessage: require('./request/ResponseMessage'),
  /* Rate Limit */
  RequestMetaMessage: require('./rateLimit/RequestMetaMessage'),
  AuthorizationMessage: require('./rateLimit/AuthorizationMessage'),
  RateLimitStateMessage: require('./rateLimit/RateLimitStateMessage'),
};
