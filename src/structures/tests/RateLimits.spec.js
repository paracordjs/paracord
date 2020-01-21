"use strict";
const assert = require("assert");
const sinon = require("sinon");
const RateLimits = require("../RateLimits");
const RateLimit = require("../RateLimit");

describe("RateLimits", () => {
  let r;
  let clock;

  beforeEach(() => {
    r = new RateLimits();
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
  });

  it("...", () => {
    const fake_assignIfStricter = sinon.fake();
    const rateLimitKey = "test";
    r.set(rateLimitKey, { assignIfStricter: fake_assignIfStricter });
    const testObj = {};
    const request = { rateLimitKey };

    r.upsert(request, testObj);

    sinon.assert.calledOnce(fake_assignIfStricter);
    assert.strictEqual(fake_assignIfStricter.getCall(0).args[0], testObj);
  });
  it("...", () => {
    const fake_assignIfStricter = sinon.fake();
    const testObj = { remaining: 0, limit: 0, resetTimestamp: 0 };
    const rateLimitKey = "test";
    const request = { rateLimitKey };

    r.upsert(request, testObj);

    sinon.assert.notCalled(fake_assignIfStricter);
    assert.deepStrictEqual(r.get(rateLimitKey), new RateLimit(testObj));
  });
});
