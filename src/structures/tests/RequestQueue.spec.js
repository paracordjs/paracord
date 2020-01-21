"use strict";
const assert = require("assert");
const sinon = require("sinon");
const RequestQueue = require("../RequestQueue");

describe("RequestQueue", async () => {
  let q;
  let clock;

  beforeEach(() => {
    q = new RequestQueue();
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
  });

  it("...", () => {
    assert.deepStrictEqual(q.requests, []);
    assert.strictEqual(q.length, 0);
  });
  it("...", () => {
    q.push(1);
    assert.deepStrictEqual(q.requests, [1]);
    assert.strictEqual(q.length, 1);
  });
  it("...", () => {
    q.push(1, "2", {});
    assert.deepStrictEqual(q.requests, [1, "2", {}]);
    assert.strictEqual(q.length, 3);
  });
  it("...", () => {
    q.push(1, "2", {}, []);
    q.spliceMany([]);
    assert.deepStrictEqual(q.requests, [1, "2", {}, []]);
    assert.strictEqual(q.length, 4);
  });
  it("...", () => {
    q.push(1, "2", {}, []);
    q.spliceMany([1, 2]);
    assert.deepStrictEqual(q.requests, [1, [], null, null]);
    assert.strictEqual(q.length, 2);

    const qt = new RequestQueue();
    q.push(qt);
    assert.deepStrictEqual(q.requests, [1, [], qt, null]);
    assert.strictEqual(q.length, 3);
  });
  it("...", () => {
    q.push(1, "2");
    q.spliceMany([1, 2]);
    assert.deepStrictEqual(q.requests, [1, null]);
    assert.strictEqual(q.length, 1);
  });
  it("...", () => {
    q.push(1, null);
    q.spliceMany([1, 2]);
    assert.deepStrictEqual(q.requests, [1, null]);
    assert.strictEqual(q.length, 1);
  });
  it("...", () => {
    q.push(1, null, null, null, null, null);
    q.stackLength = 1;
    q.spliceMany([0]);
    assert.deepStrictEqual(q.requests, [null, null, null, null, null, null]);
    assert.strictEqual(q.length, 0);
  });

  it("...", async () => {
    const fake_checkIfRateLimited = sinon.fake();
    const stub_spliceMany = sinon.stub(q, "spliceMany");

    q.rateLimits = { checkIfRateLimited: fake_checkIfRateLimited };

    q.process();

    sinon.assert.notCalled(fake_checkIfRateLimited);
    sinon.assert.notCalled(stub_spliceMany);
  });
  it("...", async () => {
    const fake_checkIfRateLimited = sinon.fake();
    const stub_spliceMany = sinon.stub(q, "spliceMany");

    q.stackLength = 1;
    q.rateLimits = { checkIfRateLimited: fake_checkIfRateLimited };
    q.processing = true;

    q.process();

    sinon.assert.notCalled(fake_checkIfRateLimited);
    sinon.assert.notCalled(stub_spliceMany);
  });
  it("...", async () => {
    const fake_checkIfRateLimited = sinon.fake();
    const stub_spliceMany = sinon.stub(q, "spliceMany");

    const req = {
      fire: () => true,
      response: null,
      timeout: 0
    };
    q.requests = [req];
    q.stackLength = 1;
    q.rateLimits = { checkIfRateLimited: fake_checkIfRateLimited };

    q.process();

    sinon.assert.notCalled(fake_checkIfRateLimited);
    sinon.assert.calledOnce(stub_spliceMany);
    assert.deepStrictEqual(stub_spliceMany.getCall(0).args[0], [0]);
    assert.strictEqual(req.response, null);
  });
  it("...", async () => {
    const fake_checkIfRateLimited = sinon.fake();
    const stub_spliceMany = sinon.stub(q, "spliceMany").returns(false);

    const req = {
      send: () => true,
      response: null,
      timeout: 1
    };
    q.requests = [req];
    q.stackLength = 1;
    q.rateCache = { checkIfRateLimited: fake_checkIfRateLimited };

    q.process();

    sinon.assert.calledOnce(fake_checkIfRateLimited);
    sinon.assert.calledOnce(stub_spliceMany);
    assert.deepStrictEqual(stub_spliceMany.getCall(0).args[0], [0]);
    assert.strictEqual(req.response, true);
  });
  it("...", async () => {
    const fake_checkIfRateLimited = sinon.fake();
    const stub_spliceMany = sinon.stub(q, "spliceMany").returns(false);

    const req1 = {
      send: () => true,
      response: null,
      timeout: 1
    };
    const req2 = {
      send: () => true,
      response: null,
      timeout: 1
    };
    const req3 = {
      send: () => true,
      response: null,
      timeout: 1
    };
    q.requests = [req1, req2, req3];
    q.stackLength = 3;
    q.rateCache = { checkIfRateLimited: fake_checkIfRateLimited };

    q.process();

    sinon.assert.calledThrice(fake_checkIfRateLimited);
    sinon.assert.calledOnce(stub_spliceMany);
    assert.deepStrictEqual(stub_spliceMany.getCall(0).args[0], [0, 1, 2]);
    assert.strictEqual(req1.response, true);
    assert.strictEqual(req2.response, true);
    assert.strictEqual(req3.response, true);
  });
  it("...", async () => {
    const fake_checkIfRateLimited = sinon.fake();
    const stub_spliceMany = sinon.stub(q, "spliceMany");

    const req1 = {
      send: () => true,
      response: null,
      timeout: 1
    };
    const req2 = {
      send: () => true,
      response: null,
      timeout: 1
    };
    const req3 = {
      send: () => true,
      response: null,
      timeout: 1
    };
    q.requests = [req1, req2, req3];
    q.stackLength = 3;
    q.rateCache = { checkIfRateLimited: () => {} };
    const stub_checkIfRateLimited = sinon.stub(q.rateCache, "checkIfRateLimited");
    stub_checkIfRateLimited.onCall(0).returns(false);
    stub_checkIfRateLimited.onCall(1).returns(true);
    stub_checkIfRateLimited.onCall(2).returns(false);

    q.process();

    sinon.assert.calledThrice(stub_checkIfRateLimited);
    sinon.assert.calledOnce(stub_spliceMany);
    assert.deepStrictEqual(stub_spliceMany.getCall(0).args[0], [0, 2, ,]);
    assert.strictEqual(req1.response, true);
    assert.strictEqual(req2.response, null);
    assert.strictEqual(req3.response, true);
  });
});
