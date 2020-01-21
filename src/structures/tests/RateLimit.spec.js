"use strict";
const assert = require("assert");
const sinon = require("sinon");
const RateLimit = require("../RateLimit");

describe("RateLimit", () => {
  let clock;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
  });

  it("assignIfStricter", () => {
    const remaining = 1;
    const resetTimestamp = 2;
    const limit = 3;
    {
      const r = new RateLimit({ remaining, resetTimestamp, limit });

      r.assignIfStricter({ remaining: 2, resetTimestamp: 3, limit: 4 });

      const exp = new RateLimit({ remaining, resetTimestamp: 3, limit });
      assert.deepStrictEqual(r, exp);
    }
    {
      const r = new RateLimit({ remaining, resetTimestamp, limit });

      r.assignIfStricter({ remaining: 0, resetTimestamp: 1, limit: 2 });

      const exp = new RateLimit({ remaining: 0, resetTimestamp, limit: 2 });
      assert.deepStrictEqual(r, exp);
    }
  });
  it("reset", () => {
    const remaining = 1;
    const resetTimestamp = 0;
    const limit = 3;
    const r = new RateLimit({ remaining, resetTimestamp, limit });

    r.reset();

    const exp = new RateLimit({ remaining: 3, resetTimestamp: 1000, limit });
    assert.deepStrictEqual(r, exp);
  });
  it("decrementRemaining", () => {
    const remaining = 1;
    const resetTimestamp = 2;
    const limit = 3;
    const r = new RateLimit({ remaining, resetTimestamp, limit });

    r.decrementRemaining();

    const exp = new RateLimit({ remaining: 0, resetTimestamp, limit });
    assert.deepStrictEqual(r, exp);
  });
});
