"use strict";
const assert = require("assert");
const sinon = require("sinon");
const RateCache = require("../RateCache");
const RateLimit = require("../RateLimit");

describe("RateCache", () => {
  let r;
  let clock;

  beforeEach(() => {
    r = new RateCache();
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    sinon.restore();
    clock.restore();
  });

  describe("wrapRequest", () => {
    it(".", () => {
      const fake_buckets_get = sinon.fake(() => undefined);
      const fake_rateLimits_get = sinon.fake(() => null);

      const buckets = { get: fake_buckets_get };
      const rateLimits = { get: fake_rateLimits_get };
      const func = args => args;
      const obj = {};

      r.buckets = buckets;
      r.rateLimits = rateLimits;

      const got = r.wrapRequest(func)(null, null, obj);

      sinon.assert.calledOnce(fake_buckets_get);
      sinon.assert.notCalled(fake_rateLimits_get);
      assert.strictEqual(got, obj);
    });
    it("..", () => {
      const fake_buckets_get = sinon.fake(() => null);
      const fake_rateLimits_get = sinon.fake(() => null);

      const buckets = { get: fake_buckets_get };
      const rateLimits = { get: fake_rateLimits_get };
      const func = args => args;
      const obj = {};

      r.buckets = buckets;
      r.rateLimits = rateLimits;

      const got = r.wrapRequest(func)(null, null, obj);

      sinon.assert.calledOnce(fake_buckets_get);
      sinon.assert.notCalled(fake_rateLimits_get);
      assert.strictEqual(got, obj);
    });
    it("...", () => {
      const fake_buckets_get = sinon.fake(() => true);
      const fake_rateLimits_get = sinon.fake(() => null);

      const buckets = { get: fake_buckets_get };
      const rateLimits = { get: fake_rateLimits_get };
      const func = args => args;
      const obj = {};

      r.buckets = buckets;
      r.rateLimits = rateLimits;

      const got = r.wrapRequest(func)(null, null, obj);

      sinon.assert.calledOnce(fake_buckets_get);
      sinon.assert.calledOnce(fake_rateLimits_get);
      assert.strictEqual(got, obj);
    });
    it("....", () => {
      const fake_buckets_get = sinon.fake(() => true);
      const fake_decrementRemaining = sinon.fake();
      const rateLimit = { decrementRemaining: fake_decrementRemaining };
      const fake_rateLimits_get = sinon.fake(() => rateLimit);

      const buckets = { get: fake_buckets_get };
      const rateLimits = { get: fake_rateLimits_get };
      const func = args => args;
      const obj = {};

      r.buckets = buckets;
      r.rateLimits = rateLimits;

      const got = r.wrapRequest(func)(null, null, obj);

      sinon.assert.calledOnce(fake_buckets_get);
      sinon.assert.calledOnce(fake_rateLimits_get);
      sinon.assert.calledOnce(fake_decrementRemaining);
      assert.strictEqual(got, obj);
    });
  });

  describe("checkIfRateLimited", () => {
    it(".", () => {
      const fake_buckets_get = sinon.fake(() => null);
      const stub_getRateLimit = sinon.stub(r, "getRateLimit").returns(undefined);

      const buckets = { get: fake_buckets_get };

      r.buckets = buckets;

      const got = r.checkIfRateLimited({});

      sinon.assert.calledOnce(fake_buckets_get);
      sinon.assert.notCalled(stub_getRateLimit);
      assert.strictEqual(got, false);
    });
    it("..", () => {
      const fake_buckets_get = sinon.fake(() => undefined);
      const stub_getRateLimit = sinon.stub(r, "getRateLimit").returns(undefined);

      const buckets = { get: fake_buckets_get };

      r.buckets = buckets;

      const got = r.checkIfRateLimited({});

      sinon.assert.calledOnce(fake_buckets_get);
      sinon.assert.notCalled(stub_getRateLimit);
      assert.strictEqual(got, false);
    });
    it("...", () => {
      const fake_buckets_get = sinon.fake(() => true);
      const stub_getRateLimit = sinon.stub(r, "getRateLimit").returns(undefined);

      const buckets = { get: fake_buckets_get };

      r.buckets = buckets;

      const got = r.checkIfRateLimited({});

      sinon.assert.calledOnce(fake_buckets_get);
      sinon.assert.calledOnce(stub_getRateLimit);
      assert.strictEqual(got, false);
    });
    it("....", () => {
      const fake_buckets_get = sinon.fake(() => true);
      const fake_reset = sinon.fake();
      const rateLimit = { resetTimestamp: 0, remaining: 0, limit: 5, reset: fake_reset };
      const stub_getRateLimit = sinon.stub(r, "getRateLimit").returns(rateLimit);

      const buckets = { get: fake_buckets_get };

      r.buckets = buckets;

      const got = r.checkIfRateLimited({});

      sinon.assert.calledOnce(fake_buckets_get);
      sinon.assert.calledOnce(stub_getRateLimit);
      sinon.assert.calledOnce(fake_reset);
      assert.strictEqual(got, false);
    });
    it(".....", () => {
      const fake_buckets_get = sinon.fake(() => true);
      const fake_reset = sinon.fake();
      const rateLimit = { resetTimestamp: 0, remaining: 1, limit: 5, reset: fake_reset };
      const stub_getRateLimit = sinon.stub(r, "getRateLimit").returns(rateLimit);

      const buckets = { get: fake_buckets_get };

      r.buckets = buckets;

      const got = r.checkIfRateLimited({});

      sinon.assert.calledOnce(fake_buckets_get);
      sinon.assert.calledOnce(stub_getRateLimit);
      sinon.assert.calledOnce(fake_reset);
      assert.strictEqual(got, false);
    });
    it("......", () => {
      const fake_buckets_get = sinon.fake(() => true);
      const fake_reset = sinon.fake();
      const rateLimit = { resetTimestamp: 1, remaining: 0, limit: 5, reset: fake_reset };
      const stub_getRateLimit = sinon.stub(r, "getRateLimit").returns(rateLimit);

      const buckets = { get: fake_buckets_get };

      r.buckets = buckets;

      const got = r.checkIfRateLimited({});

      sinon.assert.calledOnce(fake_buckets_get);
      sinon.assert.calledOnce(stub_getRateLimit);
      sinon.assert.notCalled(fake_reset);
      assert.strictEqual(got, true);
    });
    it(".......", () => {
      const fake_buckets_get = sinon.fake(() => true);
      const fake_reset = sinon.fake();
      const rateLimit = { resetTimestamp: 1, remaining: 1, limit: 5, reset: fake_reset };
      const stub_getRateLimit = sinon.stub(r, "getRateLimit").returns(rateLimit);

      const buckets = { get: fake_buckets_get };

      r.buckets = buckets;

      const got = r.checkIfRateLimited({});

      sinon.assert.calledOnce(fake_buckets_get);
      sinon.assert.calledOnce(stub_getRateLimit);
      sinon.assert.notCalled(fake_reset);
      assert.strictEqual(got, false);
    });
  });

  describe("getRateLimit", () => {
    it(".", () => {
      const stub_rateLimits_get = sinon.stub(r.rateLimits, "get").returns(true);
      const stub_setRateLimitFromTemplate = sinon.stub(r, "setRateLimitFromTemplate");

      r.rateLimits = { get: stub_rateLimits_get };

      const exp = {};
      const got = r.getRateLimit({ rateLimitKey: exp });

      sinon.assert.calledOnce(stub_rateLimits_get);
      sinon.assert.notCalled(stub_setRateLimitFromTemplate);
      assert.strictEqual(got, true);
      assert.strictEqual(stub_rateLimits_get.getCall(0).args[0], exp);
    });
    it("..", () => {
      const stub_rateLimits_get = sinon.stub(r.rateLimits, "get").returns(undefined);
      const stub_setRateLimitFromTemplate = sinon.stub(r, "setRateLimitFromTemplate").returns(true);

      r.rateLimits = { get: stub_rateLimits_get };

      const request = { rateLimitKey: "key" };
      const got = r.getRateLimit(request);

      sinon.assert.calledOnce(stub_rateLimits_get);
      sinon.assert.calledOnce(stub_setRateLimitFromTemplate);
      assert.strictEqual(got, true);
      assert.strictEqual(stub_rateLimits_get.getCall(0).args[0], "key");
      assert.strictEqual(stub_setRateLimitFromTemplate.getCall(0).args[0], request);
    });
  });

  describe("setRateLimitFromTemplate", () => {
    it(".", () => {
      const stub_buckets_get = sinon.stub(r.buckets, "get").returns(true);
      const stub_templates_get = sinon.stub(r.templates, "get").returns(undefined);

      const exp = {};
      const got = r.setRateLimitFromTemplate({ rateLimitBucketKey: exp });

      sinon.assert.calledOnce(stub_buckets_get);
      sinon.assert.calledOnce(stub_templates_get);
      assert.strictEqual(got, undefined);
      assert.strictEqual(stub_buckets_get.getCall(0).args[0], exp);
      assert.strictEqual(stub_templates_get.getCall(0).args[0], true);
    });
    it("..", () => {
      const rateLimitTemplate = new RateLimit({ remaining: 1, limit: 2, resetTimestamp: 3 });
      const stub_buckets_get = sinon.stub(r.buckets, "get").returns(true);
      const stub_templates_get = sinon.stub(r.templates, "get").returns(rateLimitTemplate);

      const key = "someKey";
      const exp = {};
      const request = { rateLimitBucketKey: exp, rateLimitKey: key };
      const got = r.setRateLimitFromTemplate(request);

      sinon.assert.calledOnce(stub_buckets_get);
      sinon.assert.calledOnce(stub_templates_get);
      assert.deepStrictEqual(got, rateLimitTemplate);
      assert.deepStrictEqual(r.rateLimits.get(key), rateLimitTemplate);
      assert.strictEqual(stub_buckets_get.getCall(0).args[0], exp);
      assert.strictEqual(stub_templates_get.getCall(0).args[0], true);
    });
  });

  describe("update", () => {
    it(".", () => {
      const rateLimitBucketKey = "someKey";
      const request = { rateLimitBucketKey };

      const stub_extractRateLimitFromHeaders = sinon.stub(RateCache, "extractRateLimitFromHeaders").returns(undefined);
      const stub_setTemplateIfNotSet = sinon.stub(r, "setTemplateIfNotSet");

      r.update({}, request);

      sinon.assert.calledOnce(stub_extractRateLimitFromHeaders);
      sinon.assert.calledOnce(stub_setTemplateIfNotSet);
      assert.strictEqual(r.buckets.get(rateLimitBucketKey), null);
      assert.strictEqual(stub_setTemplateIfNotSet.getCall(0).args[1], null);
    });
    it("..", () => {
      const exp = {};
      const stub_extractRateLimitFromHeaders = sinon.stub(RateCache, "extractRateLimitFromHeaders").returns(exp);
      const stub_setTemplateIfNotSet = sinon.stub(r, "setTemplateIfNotSet");
      const stub__buckets_set = sinon.stub(r.buckets, "set");
      const stub_rateLimits_upsert = sinon.stub(r.rateLimits, "upsert");

      const rateLimitBucketKey = "someKey";
      const request = { rateLimitBucketKey };

      r.update({}, request);

      sinon.assert.calledOnce(stub_extractRateLimitFromHeaders);
      sinon.assert.calledOnce(stub_setTemplateIfNotSet);
      sinon.assert.calledOnce(stub__buckets_set);
      sinon.assert.calledOnce(stub_rateLimits_upsert);
      assert.strictEqual(stub_rateLimits_upsert.getCall(0).args[1], exp);
      assert.strictEqual(stub_setTemplateIfNotSet.getCall(0).args[1], exp);
    });
  });

  describe("setTemplateIfNotSet", () => {
    it(".", () => {
      const stub_templates_has = sinon.stub(r.templates, "has").returns(true);
      const stub_templates_set = sinon.stub(r.templates, "set");

      const exp = {};
      const request = { rateLimitBucketKey: exp };

      r.setTemplateIfNotSet(request);

      sinon.assert.calledOnce(stub_templates_has);
      sinon.assert.notCalled(stub_templates_set);
      assert.strictEqual(stub_templates_has.getCall(0).args[0], exp);
    });
    it("..", () => {
      const stub_templates_has = sinon.stub(r.templates, "has").returns(false);
      const stub_templates_set = sinon.stub(r.templates, "set");

      const exp = {};
      const request = { rateLimitBucketKey: exp };
      const rateLimitConstraints = null;

      r.setTemplateIfNotSet(request, rateLimitConstraints);

      sinon.assert.calledOnce(stub_templates_has);
      sinon.assert.calledOnce(stub_templates_set);
      assert.strictEqual(stub_templates_has.getCall(0).args[0], exp);
      assert.strictEqual(stub_templates_set.getCall(0).args[1], null);
    });
    it("...", () => {
      const stub_templates_has = sinon.stub(r.templates, "has").returns(false);
      const stub_templates_set = sinon.stub(r.templates, "set");

      const exp = {};
      const request = { rateLimitBucketKey: exp };
      const rateLimitConstraints = { limit: 5 };

      r.setTemplateIfNotSet(request, rateLimitConstraints);

      const expRateLimit = new RateLimit({ remaining: 5, limit: 5, resetTimestamp: null });

      sinon.assert.calledOnce(stub_templates_has);
      sinon.assert.calledOnce(stub_templates_set);
      assert.strictEqual(stub_templates_has.getCall(0).args[0], exp);
      assert.deepStrictEqual(stub_templates_set.getCall(0).args[1], expRateLimit);
    });
  });

  describe("extractRateLimitFromHeaders", () => {
    it(".", () => {
      const headers = {};
      const got = RateCache.extractRateLimitFromHeaders(headers);
      assert.strictEqual(got, undefined);
    });
    it("..", () => {
      const headers = {
        "x-ratelimit-bucket": "somehash",
        "x-ratelimit-limit": "1",
        "x-ratelimit-remaining": "2",
        "x-ratelimit-reset-after": "3"
      };

      clock.tick(1);

      const got = RateCache.extractRateLimitFromHeaders(headers);
      const exp = {
        bucket: "somehash",
        limit: 1,
        remaining: 2,
        resetTimestamp: 3001
      };

      assert.deepStrictEqual(got, exp);
    });
  });
});
