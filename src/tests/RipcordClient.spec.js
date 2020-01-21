"use strict";
const assert = require("assert");
const sinon = require("sinon");
const axios = require("axios");
const Gateway = require("../Gateway");
const RipcordClient = require("../RipcordClient");
const Util = require("../util/Util");

describe("RipcordClient", () => {
  let c;
  let clock;

  beforeEach(() => {
    const token = "Bot tok";
    c = new RipcordClient(token);
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    sinon.restore();
    clock.restore();
  });

  //   describe("mergeEnv", () => {
  //     it("...", () => {
  //       const env = { RIPCORD_MANAGED: false };
  //       sinon.replace(process, "env", env);
  //       const stub_coerceTokenToBotLike = sinon.stub(Util, "coerceTokenToBotLike");

  //       c.mergeEnv();

  //       sinon.assert.notCalled(stub_coerceTokenToBotLike);
  //     });
  //     it("...", () => {
  //       const token = "tok";
  //       const env = { RIPCORD_MANAGED: true, TOKEN: token };
  //       sinon.replace(process, "env", env);
  //       const stub_coerceTokenToBotLike = sinon.stub(Util, "coerceTokenToBotLike").returns("Bot tok");

  //       c.mergeEnv();

  //       sinon.assert.calledOnce(stub_coerceTokenToBotLike);
  //       assert.strictEqual(c.token, "Bot tok");
  //       assert.strictEqual(stub_coerceTokenToBotLike.getCall(0).args[0], token);
  //     });
  //   });

  //   describe("login", () => {
  //     it("...", () => {
  //       const fake_constructor = sinon.fake();
  //       const fake_login = sinon.fake();

  //       const mock_Gateway = class {
  //         constructor(emitter, conf) {
  //           fake_constructor(conf);
  //         }

  //         login() {
  //           fake_login();
  //         }
  //       };

  //       c.token = "tok";
  //       const config = { token: "en" };

  //       c.login(config, mock_Gateway);

  //       sinon.assert.calledOnce(fake_constructor);
  //       sinon.assert.calledOnce(fake_login);
  //       assert.strictEqual(c.token, "tok");
  //       assert.deepStrictEqual(fake_constructor.getCall(0).args[0], { token: "en" });
  //     });
  //     it("...", () => {
  //       const fake_constructor = sinon.fake();
  //       const fake_login = sinon.fake();

  //       const mock_Gateway = class {
  //         constructor(emitter, conf) {
  //           fake_constructor(conf);
  //         }

  //         login() {
  //           fake_login();
  //         }
  //       };
  //       c.token = "tok";
  //       const config = {};

  //       c.login(config, mock_Gateway);

  //       sinon.assert.calledOnce(fake_constructor);
  //       sinon.assert.calledOnce(fake_login);
  //       assert.strictEqual(c.token, "tok");
  //       assert.deepStrictEqual(fake_constructor.getCall(0).args[0], { token: "tok" });
  //     });
  //   });

  //   describe("_makeRequest", () => {
  //     it("...", async () => {
  //       const fake_checkIfRateLimited = sinon.fake(() => false);
  //       const fake_update = sinon.fake();
  //       const stub_enqueueRequest = sinon.stub(c, "enqueueRequest");

  //       const rateCache = {
  //         checkIfRateLimited: fake_checkIfRateLimited,
  //         update: fake_update
  //       };
  //       const request = {
  //         send: () => {
  //           return { status: 200 };
  //         }
  //       };

  //       c.rateCache = rateCache;

  //       const got = await c._makeRequest(request);
  //       const exp = { status: 200 };

  //       sinon.assert.calledOnce(fake_checkIfRateLimited);
  //       sinon.assert.calledOnce(fake_update);
  //       sinon.assert.notCalled(stub_enqueueRequest);
  //       assert.deepStrictEqual(got, exp);
  //     });
  //     it("...", async () => {
  //       const fake_checkIfRateLimited = sinon.fake(() => true);
  //       const fake_update = sinon.fake();
  //       const stub_enqueueRequest = sinon.stub(c, "enqueueRequest").resolves({ status: 200 });

  //       const rateCache = {
  //         checkIfRateLimited: fake_checkIfRateLimited,
  //         update: fake_update
  //       };
  //       const request = {
  //         send: () => {
  //           return { status: 200 };
  //         }
  //       };

  //       c.rateCache = rateCache;

  //       const got = await c._makeRequest(request);
  //       const exp = { status: 200 };

  //       sinon.assert.calledOnce(fake_checkIfRateLimited);
  //       sinon.assert.calledOnce(fake_update);
  //       sinon.assert.calledOnce(stub_enqueueRequest);
  //       assert.deepStrictEqual(got, exp);
  //     });
  //     it("...", async () => {
  //       const fake_checkIfRateLimited = sinon.fake(() => true);
  //       const fake_update = sinon.fake();
  //       const stub_enqueueRequest = sinon.stub(c, "enqueueRequest");
  //       stub_enqueueRequest.onCall(0).resolves({ status: 429 });
  //       stub_enqueueRequest.onCall(1).resolves({ status: 200 });

  //       const rateCache = {
  //         checkIfRateLimited: fake_checkIfRateLimited,
  //         update: fake_update
  //       };
  //       const request = {
  //         send: () => {
  //           return { status: 200 };
  //         }
  //       };

  //       c.rateCache = rateCache;

  //       const got = await c._makeRequest(request);
  //       const exp = { status: 200 };

  //       sinon.assert.calledOnce(fake_checkIfRateLimited);
  //       sinon.assert.calledTwice(fake_update);
  //       sinon.assert.calledTwice(stub_enqueueRequest);
  //       assert.deepStrictEqual(got, exp);
  //     });
  //   });

  //   describe("enqueueRequest", () => {
  //     it("...", async () => {
  //       const request = { response: undefined };
  //       const gotPromise = c.enqueueRequest(request);

  //       request.response = { passed: true };
  //       clock.tick(1); // cycle the event loop
  //       const got = await gotPromise;

  //       const exp = { passed: true };
  //       assert.deepStrictEqual(got, exp);
  //     });
  //     it("...", async () => {
  //       const request = {};

  //       const gotPromise = c.enqueueRequest(request, 0);

  //       clock.tick(1); // cycle the event loop

  //       await assert.rejects(gotPromise);
  //     });
  //     it("...", async () => {
  //       const request = { response: undefined };

  //       const gotPromise = c.enqueueRequest(request);
  //       clock.tick(1); // cycle the event loop

  //       request.response = { passed: true };
  //       clock.tick(1); // cycle the event loop
  //       const got = await gotPromise;

  //       const exp = { passed: true };
  //       assert.deepStrictEqual(got, exp);
  //     });
  //     it("...", async () => {
  //       const request = { response: {} };

  //       const gotPromise = c.enqueueRequest(request);
  //       clock.tick(1); // cycle the event loop

  //       request.response = { passed: true };
  //       clock.tick(1); // cycle the event loop
  //       const got = await gotPromise;

  //       const exp = { passed: true };
  //       assert.deepStrictEqual(got, exp);
  //     });
  //   });
});
