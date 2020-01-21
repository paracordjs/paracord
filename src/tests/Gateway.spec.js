"use strict";
const assert = require("assert");
const sinon = require("sinon");
const ws = require("ws");
const Gateway = require("../Gateway");
const Client = require("../RipcordClient");
const Identity = require("../structures/Identity");
const { OPCODES, SECONDINMILLISECONDS, GATEWAYURLPARAMS } = require("../util/constants");

describe("Gateway", () => {
  const token = "Bot tok";
  let h;
  let clock;
  let stub_emit;

  beforeEach(() => {
    const c = new Client(token);
    h = new Gateway(c, { token });
    h.initRedisialized = true;
    stub_emit = sinon.stub(h, "emit");

    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    sinon.restore();
    clock.restore();
  });

  describe("assignIdentity", () => {
    it(".", () => {
      const config = {};

      h.assignIdentity(config);

      const exp = new Identity("Bot tok");

      assert.deepStrictEqual(h.identity, exp);
    });
    it("..", () => {
      const token = "Bot other tok";
      const config = { identity: { token } };

      h.assignIdentity(config);

      const exp = new Identity(token);

      assert.deepStrictEqual(h.identity, exp);
    });
  });

  describe("login", () => {
    let stub_initRedis;
    let stub_checkRedisLock;
    let stub_getWebsocketURL;
    let got;
    let fakeWebsocket;

    beforeEach(() => {
      stub_initRedis = sinon.stub(h, "initRedis");
      stub_checkRedisLock = sinon.stub(h, "obtainRedisLock");
      stub_getWebsocketURL = sinon.stub(h, "getWebsocketURL");

      got = { url: null };
      fakeWebsocket = class {
        constructor(url) {
          got.url = url;
        }
      };
    });

    it(".", async () => {
      const fakeUrl = "ws://fake.url";

      stub_checkRedisLock.returns(true);
      stub_getWebsocketURL.returns(fakeUrl);
      h.redisInitialized = false;

      await h.login(fakeWebsocket);

      const exp = { url: fakeUrl };

      sinon.assert.calledOnce(stub_initRedis);
      sinon.assert.calledOnce(stub_checkRedisLock);
      sinon.assert.calledOnce(stub_getWebsocketURL);
      assert.deepEqual(got, exp);
    });
    it(".", async () => {
      const fakeUrl = "ws://fake.url";

      stub_checkRedisLock.returns(true);
      stub_getWebsocketURL.returns(fakeUrl);
      h.redisInitialized = true;

      await h.login(fakeWebsocket);

      const exp = { url: fakeUrl };

      sinon.assert.notCalled(stub_initRedis);
      sinon.assert.calledOnce(stub_checkRedisLock);
      sinon.assert.calledOnce(stub_getWebsocketURL);
      assert.deepEqual(got, exp);
    });
    it("...", async () => {
      stub_checkRedisLock.returns(false);
      h.redisInitialized = true;

      await h.login();
      sinon.assert.notCalled(stub_initRedis);
      sinon.assert.notCalled(stub_getWebsocketURL);
      sinon.assert.calledOnce(stub_checkRedisLock);
    });
    it("...", async () => {
      stub_checkRedisLock.returns(false);
      h.redisInitialized = true;

      await h.login();
      sinon.assert.notCalled(stub_initRedis);
      sinon.assert.notCalled(stub_getWebsocketURL);
      sinon.assert.calledOnce(stub_checkRedisLock);
    });
  });

  describe("obtainRedisLock", () => {
    let stub_login;

    beforeEach(() => {
      stub_login = sinon.stub(h, "login");
    });

    it(".", async () => {
      const fake_localRedis_set = sinon.fake(async () => {
        return "NOT OK";
      });
      const fake_localRedis_del = sinon.fake(async () => {});
      const fake_remoteRedis_set = sinon.fake(async () => {
        return "NOT OK";
      });
      const mock_localRedis = {
        set: fake_localRedis_set,
        del: fake_localRedis_del
      };
      const mock_remoteRedis = {
        set: fake_remoteRedis_set
      };

      h.localRedis = mock_localRedis;
      h.remoteRedis = mock_remoteRedis;
      h.appName = "test";

      const got = await h.obtainRedisLock();

      sinon.assert.calledOnce(fake_localRedis_set);
      sinon.assert.notCalled(fake_remoteRedis_set);
      sinon.assert.notCalled(fake_localRedis_del);
      sinon.assert.notCalled(stub_login);
      clock.tick(SECONDINMILLISECONDS);
      sinon.assert.calledOnce(stub_login);
      assert.strictEqual(got, false);
    });
    it("..", async () => {
      const fake_localRedis_set = sinon.fake(async () => {
        return "OK";
      });
      const fake_localRedis_del = sinon.fake(async () => {});
      const fake_remoteRedis_set = sinon.fake(async () => {
        return "NOT OK";
      });
      const mock_localRedis = {
        set: fake_localRedis_set,
        del: fake_localRedis_del
      };
      const mock_remoteRedis = {
        set: fake_remoteRedis_set
      };

      h.localRedis = mock_localRedis;
      h.remoteRedis = mock_remoteRedis;
      h.appName = "test";
      h.remoteLoginWait = 1;

      const got = await h.obtainRedisLock();

      sinon.assert.calledOnce(fake_localRedis_set);
      sinon.assert.calledOnce(fake_remoteRedis_set);
      sinon.assert.calledOnce(fake_localRedis_del);
      sinon.assert.notCalled(stub_login);
      clock.tick(SECONDINMILLISECONDS - 1);
      sinon.assert.notCalled(stub_login);
      clock.tick(1);
      sinon.assert.calledOnce(stub_login);
      assert.strictEqual(got, false);
    });
    it("...", async () => {
      const fake_localRedis_set = sinon.fake(async () => {
        return "OK";
      });
      const fake_localRedis_del = sinon.fake(async () => {});
      const fake_remoteRedis_set = sinon.fake(async () => {
        return "OK";
      });
      const mock_localRedis = {
        set: fake_localRedis_set,
        del: fake_localRedis_del
      };
      const mock_remoteRedis = {
        set: fake_remoteRedis_set
      };

      h.localRedis = mock_localRedis;
      h.remoteRedis = mock_remoteRedis;
      h.appName = "test";
      h.remoteLoginWait = SECONDINMILLISECONDS;

      const got = await h.obtainRedisLock();

      sinon.assert.calledOnce(fake_localRedis_set);
      sinon.assert.calledOnce(fake_remoteRedis_set);
      sinon.assert.notCalled(fake_localRedis_del);
      sinon.assert.notCalled(stub_login);
      clock.tick(SECONDINMILLISECONDS - 1);
      sinon.assert.notCalled(stub_login);
      clock.tick(1);
      sinon.assert.notCalled(stub_login);
      assert.strictEqual(got, true);
    });
  });

  describe("getWebsocketURL", () => {
    let stub_http_get;
    let stub_login;
    let stub_process_exit;

    beforeEach(() => {
      stub_http_get = sinon.stub(h.http, "get");
      stub_login = sinon.stub(h, "login");
      stub_process_exit = sinon.stub(process, "exit");
    });

    it(".", async () => {
      const fakeUrl = "ws://fake.url";
      stub_http_get.resolves({
        status: 200,
        data: { session_start_limit: 0, remaining: 0, url: fakeUrl }
      });

      const got = await h.getWebsocketURL();

      sinon.assert.calledOnce(stub_http_get);
      sinon.assert.calledOnce(stub_emit);
      sinon.assert.notCalled(stub_login);
      sinon.assert.notCalled(stub_process_exit);
      assert.strictEqual(got, `ws://fake.url${GATEWAYURLPARAMS}`);
    });
    it("..", async () => {
      stub_http_get.resolves({
        status: 500,
        data: { message: "Internal server error.", code: 0 }
      });
      h.websocketRetryWaitTimeout = 1;

      const got = await h.getWebsocketURL();

      sinon.assert.calledOnce(stub_http_get);
      sinon.assert.calledOnce(stub_emit);
      sinon.assert.notCalled(stub_process_exit);
      sinon.assert.notCalled(stub_login);
      clock.tick(1);
      sinon.assert.called(stub_login);
      assert.strictEqual(got, undefined);
    });
    it("...", async () => {
      stub_http_get.resolves({
        status: 401,
        data: { message: "401: Unauthorized", code: 0 }
      });
      h.websocketRetryWaitTimeout = 1;

      const got = await h.getWebsocketURL();

      sinon.assert.calledOnce(stub_http_get);
      sinon.assert.calledOnce(stub_emit);
      sinon.assert.notCalled(stub_login);
      sinon.assert.calledOnce(stub_process_exit);
      assert.strictEqual(got, undefined);
    });
  });

  it("_onopen", () => {
    h.initRedisialized = true;

    h._onopen();

    sinon.assert.calledTwice(stub_emit);
  });

  describe("_onmessage", () => {
    it(".", () => {
      h.initRedisialized = true;

      const data = { passed: true };
      const m = { data: JSON.stringify(data) };

      const stub_handleMessage = sinon.stub(h, "handleMessage");
      h._onmessage(m);

      sinon.assert.calledOnce(stub_handleMessage);
      assert.deepStrictEqual(stub_handleMessage.getCall(0).args[0], data);
    });
  });

  it("_onerror", () => {
    h.initRedisialized = true;

    const err = { message: "error" };
    h._onerror(err);

    sinon.assert.calledOnce(stub_emit);
  });

  describe("_onclose", () => {
    it(".", () => {
      const stub_clearHeartbeat = sinon.stub(h, "clearHeartbeat");
      const stub_login = sinon.stub(h, "login");

      const event = { code: 0, reason: "Some reason." };

      h._onclose(event);

      sinon.assert.calledOnce(stub_clearHeartbeat);
      sinon.assert.calledTwice(stub_emit);
      sinon.assert.notCalled(stub_login);
      clock.tick(1);
      sinon.assert.calledOnce(stub_login);

    });
    it("..", () => {
      const stub_clearHeartbeat = sinon.stub(h, "clearHeartbeat");
      const stub_login = sinon.stub(h, "login");

      const event = { code: 0, reason: "Some reason." };

      h._onclose(event);

      sinon.assert.calledOnce(stub_clearHeartbeat);
      sinon.assert.calledTwice(stub_emit);
      sinon.assert.notCalled(stub_login);
      clock.tick(1);
      sinon.assert.calledOnce(stub_login);
    });
  });

  describe("handleMessage", () => {
    const defaultPacket = { t: null, s: null, op: null, d: null };
    let stub_handleHello,
      stub_handleReady,
      stub_handleEvent,
      stub_handleHeartbeatAck,
      stub_handleInvalidSession,
      stub_updateSequence;

    beforeEach(() => {
      stub_handleHello = sinon.stub(h, "handleHello");
      stub_handleReady = sinon.stub(h, "handleReady");
      stub_handleEvent = sinon.stub(h, "handleEvent");
      stub_handleHeartbeatAck = sinon.stub(h, "handleHeartbeatAck");
      stub_handleInvalidSession = sinon.stub(h, "handleInvalidSession");
      stub_updateSequence = sinon.stub(h, "updateSequence");
    });

    it(".", () => {
      const packet = {
        ...defaultPacket,
        op: OPCODES.HELLO
      };
      h.handleMessage(packet);
      sinon.assert.calledOnce(stub_handleHello);
      sinon.assert.notCalled(stub_handleReady);
      sinon.assert.notCalled(stub_handleEvent);
      sinon.assert.notCalled(stub_handleHeartbeatAck);
      sinon.assert.notCalled(stub_handleInvalidSession);
      sinon.assert.calledOnce(stub_updateSequence);
    });
    it("..", () => {
      const packet = {
        ...defaultPacket,
        t: "READY",
        op: OPCODES.DISPATCH
      };
      h.handleMessage(packet);
      sinon.assert.notCalled(stub_handleHello);
      sinon.assert.calledOnce(stub_handleReady);
      sinon.assert.notCalled(stub_handleEvent);
      sinon.assert.notCalled(stub_handleHeartbeatAck);
      sinon.assert.notCalled(stub_handleInvalidSession);
      sinon.assert.calledOnce(stub_updateSequence);
    });
    it("...", () => {
      const packet = {
        ...defaultPacket,
        op: OPCODES.DISPATCH
      };
      h.handleMessage(packet);
      sinon.assert.notCalled(stub_handleHello);
      sinon.assert.notCalled(stub_handleReady);
      sinon.assert.notCalled(stub_handleEvent);
      sinon.assert.notCalled(stub_handleHeartbeatAck);
      sinon.assert.notCalled(stub_handleInvalidSession);
      sinon.assert.calledOnce(stub_updateSequence);
      clock.tick(1);
      sinon.assert.calledOnce(stub_handleEvent);
      assert.deepStrictEqual(stub_handleEvent.getCall(0).args, [
        packet.t,
        packet.d
      ]);
    });
    it("....", () => {
      const packet = {
        ...defaultPacket,
        op: OPCODES.HEARTBEAT_ACK
      };
      h.handleMessage(packet);
      sinon.assert.notCalled(stub_handleHello);
      sinon.assert.notCalled(stub_handleReady);
      sinon.assert.notCalled(stub_handleEvent);
      sinon.assert.calledOnce(stub_handleHeartbeatAck);
      sinon.assert.notCalled(stub_handleInvalidSession);
      sinon.assert.calledOnce(stub_updateSequence);
    });
    it(".....", () => {
      const packet = {
        ...defaultPacket,
        op: OPCODES.INVALID_SESSION
      };
      h.handleMessage(packet);
      sinon.assert.notCalled(stub_handleHello);
      sinon.assert.notCalled(stub_handleReady);
      sinon.assert.notCalled(stub_handleEvent);
      sinon.assert.notCalled(stub_handleHeartbeatAck);
      sinon.assert.calledOnce(stub_handleInvalidSession);
      sinon.assert.calledOnce(stub_updateSequence);
    });
    it("......", () => {
      const packet = {
        ...defaultPacket,
        s: true
      };
      h.handleMessage(packet);
      sinon.assert.notCalled(stub_handleHello);
      sinon.assert.notCalled(stub_handleReady);
      sinon.assert.notCalled(stub_handleEvent);
      sinon.assert.notCalled(stub_handleHeartbeatAck);
      sinon.assert.notCalled(stub_handleInvalidSession);
      sinon.assert.calledOnce(stub_updateSequence);
    });
  });

  describe("handleHello", () => {
    it(".", () => {
      const data = { heartbeat_interval: 1 };

      const stub_heartbeat = sinon.stub(h, "heartbeat");
      const stub_connect = sinon.stub(h, "connect");
      h.heartbeat = stub_heartbeat;

      h.handleHello(data);

      sinon.assert.notCalled(stub_heartbeat);
      clock.tick(1);

      assert.strictEqual(h.heartbeatAck, true);
      sinon.assert.calledOnce(stub_heartbeat);
      sinon.assert.calledOnce(stub_connect);
      clearInterval(h.heartbeatInterval);
    });
  });

  describe("heartbeat", () => {
    it(".", () => {
      h.heartbeatAck = false;

      let got;
      const fake_ws_close = sinon.fake(args => (got = args));
      h.ws = { close: fake_ws_close };

      h.heartbeat();

      sinon.assert.calledOnce(fake_ws_close);
      assert.deepStrictEqual(got, 4000);
    });

    it("..", () => {
      h.heartbeatAck = true;

      let got;
      const fake_send = sinon.fake((...args) => (got = args));
      sinon.replace(h, "send", fake_send);

      h.heartbeat();

      sinon.assert.calledOnce(fake_send);
      assert.strictEqual(h.lastHeartbeatTimestamp, 0);
      assert.deepStrictEqual(got, [OPCODES.HEARTBEAT, 0]);
    });
  });

  describe("connect", () => {
    it(".", () => {
      const stub_resume = sinon.stub(h, "resume");
      const stub_identify = sinon.stub(h, "identify");

      h.connect(true);

      sinon.assert.calledOnce(stub_resume);
      sinon.assert.notCalled(stub_identify);
    });
    it("..", () => {
      const stub_resume = sinon.stub(h, "resume");
      const stub_identify = sinon.stub(h, "identify");

      h.connect(false);

      sinon.assert.notCalled(stub_resume);
      sinon.assert.calledOnce(stub_identify);
    });
  });

  describe("handleReady", () => {
    it(".", () => {
      const stub_handleEvent = sinon.stub(h, "handleEvent");
      const data = { session_id: "123" };

      h.handleReady(data);

      sinon.assert.calledOnce(stub_handleEvent);
      assert.strictEqual(h.sessionId, "123");
    });
  });

  describe("handleEvent", () => {
    it(".", async () => {
      const fake_emitter_eventHandler = sinon.fake(() => {
        return undefined;
      });

      const type = "";
      const data = {};

      h.emitter = { eventHandler: fake_emitter_eventHandler };

      await h.handleEvent(type, data);

      sinon.assert.calledOnce(fake_emitter_eventHandler);
      sinon.assert.notCalled(stub_emit);
    });
    it("..", async () => {
      const fake_emitter_eventHandler = sinon.fake(() => {
        return {};
      });

      const type = "";
      const data = {};

      h.emitter = { eventHandler: fake_emitter_eventHandler };

      await h.handleEvent(type, data);

      sinon.assert.calledOnce(fake_emitter_eventHandler);
      sinon.assert.calledOnce(stub_emit);
    });
  });

  describe("emit", () => {
    beforeEach(() => {
      sinon.restore();
    });

    it(".", () => {
      const fakeemit = sinon.fake();

      const type = "EVENT";
      const data = {};
      h.emitter = { emit: fakeemit };
      h.events = undefined;

      h.emit(type, data);

      sinon.assert.calledOnce(fakeemit);
      assert.deepStrictEqual(fakeemit.getCall(0).args, [type, data]);
    });
    it("..", () => {
      const fakeemit = sinon.fake();

      const type = "EVENT";
      const data = {};
      h.emitter = { emit: fakeemit };
      h.events = { EVENT: "event" };

      h.emit(type, data);

      sinon.assert.calledOnce(fakeemit);
      assert.deepStrictEqual(fakeemit.getCall(0).args, ["event", data]);
    });
    it("...", () => {
      const fakeemit = sinon.fake();

      const type = "EVENT";
      const data = {};
      h.emitter = { emit: fakeemit };
      h.events = {};

      h.emit(type, data);

      sinon.assert.notCalled(fakeemit);
    });
  });

  describe("handleHeartbeatAck", () => {
    it(".", () => {
      h.heartbeatAck = false;
      h.handleHeartbeatAck();
      assert.strictEqual(h.heartbeatAck, true);
    });
  });

  describe("handleInvalidSession", () => {
    it(".", () => {
      const stub_connect = sinon.stub(h, "connect");

      h.sessionId = "id1";

      h.handleInvalidSession(true);

      sinon.assert.calledOnce(stub_connect);
      assert.strictEqual(stub_connect.getCall(0).args[0], true);
    });
    it("..", () => {
      const stub_connect = sinon.stub(h, "connect");

      h.sessionId = undefined;

      h.handleInvalidSession(true);

      sinon.assert.calledOnce(stub_connect);
      assert.strictEqual(stub_connect.getCall(0).args[0], false);
    });
    it("...", () => {
      const stub_connect = sinon.stub(h, "connect");

      h.sessionId = "id1";

      h.handleInvalidSession(false);

      sinon.assert.calledOnce(stub_connect);
      assert.strictEqual(stub_connect.getCall(0).args[0], false);
    });
  });

  describe("send", () => {
    it(".", () => {
      const fake_send = sinon.fake();

      h.ws = undefined;
      h.send();

      sinon.assert.notCalled(fake_send);
    });
    it("..", () => {
      const fake_send = sinon.fake();
      sinon.replace(ws, "OPEN", 0);

      h.ws = { readyState: -1 };
      h.send();

      sinon.assert.notCalled(fake_send);
    });
    it("...", () => {
      const fake_send = sinon.fake();
      sinon.replace(ws, "OPEN", 0);

      h.ws = { readyState: 0, send: fake_send };

      const op = 1;
      const _data = { something: "arbitrary" };

      h.send(op, _data);

      sinon.assert.called(fake_send);
      assert.strictEqual(
        fake_send.getCall(0).args[0],
        JSON.stringify({ op, d: _data })
      );
    });
  });

  describe("updateSequence", () => {
    it(".", () => {
      const sequence = 5;

      h.sequence = 0;
      h.updateSequence(sequence);

      assert.strictEqual(h.sequence, sequence);
    });
  });

  describe("identify", () => {
    it(".", () => {
      const stub_send = sinon.stub(h, "send");

      const obj = {};
      h.identity = obj;
      h.identify();

      sinon.assert.calledOnce(stub_send);
      assert.strictEqual(stub_send.getCall(0).args[0], OPCODES.IDENTIFY);
      assert.strictEqual(stub_send.getCall(0).args[1], obj);
    });
  });

  describe("resume", () => {
    it(".", () => {
      let got;
      const fake_send = sinon.fake((...args) => (got = args));

      h.token = "tok";
      h.sessionId = "id";
      h.sequence = 1;
      h.send = fake_send;

      h.resume();
      const exp = [OPCODES.RESUME, { token: "tok", session_id: "id", seq: 1 }];

      sinon.assert.calledOnce(fake_send);
      assert.deepStrictEqual(got, exp);
    });
  });

  describe("clearHeartbeat", () => {
    it(".", () => {
      h.heartbeatInterval = 1;
      const interval = setInterval(() => {}, 1e9999);
      h.heartbeatInterval = interval;
      h.heartbeatAck = true;
      h.clearHeartbeat();

      assert.strictEqual(h.heartbeatInterval, undefined);
      assert.strictEqual(h.heartbeatAck, undefined);
    });
    it("..", () => {
      h.heartbeatInterval = undefined;
      h.heartbeatAck = true;

      h.clearHeartbeat();

      assert.strictEqual(h.heartbeatInterval, undefined);
      assert.strictEqual(h.heartbeatAck, true);
    });
  });
});
