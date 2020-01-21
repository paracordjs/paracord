"use strict";
const RateLimit = require("./RateLimit");

module.exports = class RateLimits extends Map {
  constructor(props) {
    super(props);
  }

  upsert(request, rateLimitConstraints) {
    if (this.has(request.rateLimitKey)) {
      this.get(request.rateLimitKey).assignIfStricter(rateLimitConstraints);
    } else {
      this.set(request.rateLimitKey, new RateLimit(rateLimitConstraints));
    }
  }
};
