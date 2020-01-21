"use strict";
const assert = require("assert");
const sinon = require("sinon");
const ParacordClient = require("../ParacordClient");
const RipcordClient = require("../RipcordClient");
const Util = require("../util/Util");
const { MINUTEINMILLISECONDS } = require("../util/constants");

describe("ParacordClient", () => {
  let c;
  let clock;
  let fake_gateway_emit;
  const token = "Bot tok";

  beforeEach(() => {
    c = new ParacordClient(token);
    fake_gateway_emit = sinon.fake(() => {});
    c.gateway = { emit: fake_gateway_emit };

    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    sinon.restore();
    clock.restore();
  });

  describe("bindEventFunctions", () => {
    it(".", () => {
      assert(typeof c.READY === "function");
    });
  });

  describe("login", () => {
    let stub_login;
    let stub_sweepCaches;
    let stub_sweepOldUpdates;

    beforeEach(() => {
      stub_login = sinon.stub(RipcordClient.prototype, "login");
      stub_sweepCaches = sinon.stub(c, "sweepCaches");
      stub_sweepOldUpdates = sinon.stub(c, "sweepOldUpdates");
    });

    it(".", () => {
      const config = {};

      c.login(config);

      sinon.assert.calledOnce(stub_login);
      sinon.assert.notCalled(stub_sweepCaches);
      sinon.assert.notCalled(stub_sweepOldUpdates);
      assert.strictEqual(c.allowEventsDuringStartup, false);
      assert.strictEqual(stub_login.getCall(0).args[0], config);
      assert.strictEqual(stub_login.getCall(0).args[0].client, c);
      assert.strictEqual(stub_login.getCall(0).args[0].events, undefined);
      assert.strictEqual(c.forceStartUpTimeout, undefined);
      assert.strictEqual(c.forceGuildMaximumUnavailable, undefined);
      clock.tick(500);
      sinon.assert.calledOnce(stub_sweepOldUpdates);
      clock.tick(MINUTEINMILLISECONDS - 500);
      sinon.assert.calledOnce(stub_sweepCaches);
    });
    it("..", () => {
      const events = {};
      c.events = events;
      const config = { allowEventsDuringStartup: true };

      c.login(config);

      sinon.assert.calledOnce(stub_login);
      assert.strictEqual(c.allowEventsDuringStartup, true);
      assert.strictEqual(stub_login.getCall(0).args[0].events, events);
    });
    it("...", () => {
      const stub_forceStartUp = sinon.stub(c, "forceStartUp");

      const forceStartUpTimeout = 1;
      const config = { forceStartUpTimeout };

      c.login(config);

      sinon.assert.notCalled(stub_forceStartUp);
      assert(c.forceStartUpTimer !== undefined);
      clock.tick(1);

      sinon.assert.calledOnce(stub_login);
      sinon.assert.calledOnce(stub_forceStartUp);
    });
    it("....", () => {
      const stub_forceWithUnavailableGuild = sinon.stub(
        c,
        "forceWithUnavailableGuild"
      );

      const forceGuildMaximumUnavailable = 1;
      const config = { forceGuildMaximumUnavailable };

      c.login(config);

      sinon.assert.notCalled(stub_forceWithUnavailableGuild);
      assert(c.forceGuildStartUpInterval !== undefined);
      clock.tick(1e3);

      sinon.assert.calledOnce(stub_login);
      sinon.assert.calledOnce(stub_forceWithUnavailableGuild);
      assert.strictEqual(
        c.forceGuildMaximumUnavailable,
        config.forceGuildMaximumUnavailable
      );
      assert.strictEqual(c.forceGuildStartUpTimeout, 60e3);
    });
    it(".....", () => {
      const stub_forceWithUnavailableGuild = sinon.stub(
        c,
        "forceWithUnavailableGuild"
      );

      const forceGuildMaximumUnavailable = 1;
      const forceGuildStartUpTimeout = 5;
      const config = { forceGuildMaximumUnavailable, forceGuildStartUpTimeout };

      c.login(config);

      sinon.assert.notCalled(stub_forceWithUnavailableGuild);
      assert(c.forceGuildStartUpInterval !== undefined);
      clock.tick(1e3);

      sinon.assert.calledOnce(stub_login);
      sinon.assert.calledOnce(stub_forceWithUnavailableGuild);
      assert.strictEqual(
        c.forceGuildMaximumUnavailable,
        config.forceGuildMaximumUnavailable
      );
      assert.strictEqual(c.forceGuildStartUpTimeout, 5e3);
    });
  });

  describe("eventHandler", () => {
    let stub_checkIfDoneStarting;
    let stub_GUILD_CREATE;

    beforeEach(() => {
      stub_checkIfDoneStarting = sinon.stub(c, "checkIfDoneStarting");
      stub_GUILD_CREATE = sinon.stub(c, "GUILD_CREATE");
    });

    it(".", () => {
      const returnData = {};
      c.SOME_EVENT = sinon.fake(() => {
        return returnData;
      });
      const type = "SOME_EVENT";
      const data = {};

      const got = c.eventHandler(type, data);

      sinon.assert.calledOnce(c.SOME_EVENT);
      sinon.assert.notCalled(stub_checkIfDoneStarting);
      sinon.assert.notCalled(stub_GUILD_CREATE);
      assert.strictEqual(got, returnData);
      assert.strictEqual(c.SOME_EVENT.getCall(0).args[0], data);
    });
    it("..", () => {
      const returnData = {};
      c.SOME_EVENT = sinon.fake(() => {
        return returnData;
      });
      const type = "GATEWAY_IDENTIFY";
      const data = {};

      const got = c.eventHandler(type, data);

      sinon.assert.notCalled(c.SOME_EVENT);
      sinon.assert.notCalled(stub_checkIfDoneStarting);
      sinon.assert.notCalled(stub_GUILD_CREATE);
      assert.strictEqual(got, data);
    });
    it("...", () => {
      const type = "GUILD_CREATE";
      const data = {};
      c.starting = true;

      const got = c.eventHandler(type, data);

      sinon.assert.calledOnce(stub_checkIfDoneStarting);
      sinon.assert.calledOnce(stub_GUILD_CREATE);
      assert.strictEqual(got, undefined);
    });
    it("....", () => {
      const type = "SOME_EVENT";
      const data = {};
      c.starting = true;
      c.allowEventsDuringStartup = true;

      const got = c.eventHandler(type, data);

      sinon.assert.notCalled(stub_checkIfDoneStarting);
      sinon.assert.notCalled(stub_GUILD_CREATE);
      assert.strictEqual(got, data);
    });
    it(".....", () => {
      const type = "SOME_EVENT";
      const data = {};
      c.starting = true;
      c.allowEventsDuringStartup = false;

      const got = c.eventHandler(type, data);

      sinon.assert.notCalled(stub_checkIfDoneStarting);
      sinon.assert.notCalled(stub_GUILD_CREATE);
      assert.strictEqual(got, undefined);
    });
    it("......", () => {
      const type = "SOME_EVENT";
      const data = {};
      c.starting = false;

      const got = c.eventHandler(type, data);

      sinon.assert.notCalled(stub_checkIfDoneStarting);
      sinon.assert.notCalled(stub_GUILD_CREATE);
      assert.strictEqual(got, data);
    });
  });

  describe("handleReady", () => {
    it(".", () => {
      const stub_assignDefaults = sinon.stub(c, "assignDefaults");
      const stub_util_constructUserTag = sinon.stub(Util, "constructUserTag");
      const user = {};
      const guilds = [{}];
      const data = { guilds, user };

      c.handleReady(data, true);

      sinon.assert.calledOnce(stub_assignDefaults);
      sinon.assert.calledOnce(stub_util_constructUserTag);
      sinon.assert.calledOnce(fake_gateway_emit);
      assert.strictEqual(
        fake_gateway_emit.getCall(0).args[0],
        "PARACORD_DEBUG"
      );
      assert.strictEqual(c.guildWaitCount, 1);
      assert.strictEqual(c.user, user);
      assert(fake_gateway_emit.getCall(0).args[1].message !== undefined);
    });
  });

  describe("checkIfDoneStarting", () => {
    let stub_completeStartup;

    beforeEach(() => {
      stub_completeStartup = sinon.stub(c, "completeStartup");
    });

    it(".", () => {
      c.guildWaitCount = 1;

      c.checkIfDoneStarting();

      sinon.assert.calledOnce(stub_completeStartup);
      assert.strictEqual(stub_completeStartup.getCall(0).args[0], false);
    });
    it("..", () => {
      c.guildWaitCount = 2;

      c.checkIfDoneStarting();

      sinon.assert.notCalled(stub_completeStartup);
      sinon.assert.calledOnce(fake_gateway_emit);
    });
    it("...", () => {
      c.guildWaitCount = 2;
      c.mostRecentGuildTimestamp = 0;

      clock.tick(1);

      c.checkIfDoneStarting();

      sinon.assert.notCalled(stub_completeStartup);
      assert.strictEqual(
        fake_gateway_emit.getCall(0).args[0],
        "PARACORD_DEBUG"
      );
      assert(fake_gateway_emit.getCall(0).args[1].message !== undefined);
      assert.strictEqual(c.mostRecentGuildTimestamp, 1);
    });
    it("....", () => {
      c.guildWaitCount = 0;

      assert.throws(c.checkIfDoneStarting.bind(c), Error);
      assert.strictEqual(c.guildWaitCount, -1);
    });
  });

  describe("completeStartup", () => {
    it(".", () => {
      c.starting = true;

      c.completeStartup();

      sinon.assert.calledTwice(fake_gateway_emit);
    });
    it("..", () => {
      const fake_timer = sinon.fake();

      c.starting = true;
      c.forceStartUpTimer = setTimeout(fake_timer, 1);
      c.forceGuildStartUpInterval = setInterval(fake_timer, 1);

      c.completeStartup();

      sinon.assert.calledTwice(fake_gateway_emit);
      sinon.assert.notCalled(fake_timer);
      clock.tick(2);
      sinon.assert.notCalled(fake_timer);
      assert.strictEqual(c.forceStartUpTimer, undefined);
      assert.strictEqual(c.forceGuildStartUpInterval, undefined);
    });
  });

  describe("forceStartUp", () => {
    it(".", () => {
      const stub_completeStartup = sinon.stub(c, "completeStartup");

      c.forceStartUp();

      sinon.assert.calledOnce(stub_completeStartup);
      assert.strictEqual(stub_completeStartup.getCall(0).args[0], true);
    });
  });

  describe("forceWithUnavailableGuild", () => {
    it(".", () => {
      const stub_completeStartup = sinon.stub(c, "completeStartup");

      c.guildWaitCount = 0;
      c.forceGuildMaximumUnavailable = 0;
      c.mostRecentGuildTimestamp = undefined;
      c.forceGuildStartUpTimeout = 0;

      c.forceWithUnavailableGuild();

      sinon.assert.notCalled(stub_completeStartup);
    });
    it("..", () => {
      const stub_completeStartup = sinon.stub(c, "completeStartup");

      c.guildWaitCount = 0;
      c.forceGuildMaximumUnavailable = 0;

      c.mostRecentGuildTimestamp = 0;
      c.forceGuildStartUpTimeout = 0;

      c.forceWithUnavailableGuild();
      sinon.assert.notCalled(stub_completeStartup);

      clock.tick(1);
      c.forceWithUnavailableGuild();

      sinon.assert.calledOnce(stub_completeStartup);
      assert.strictEqual(stub_completeStartup.getCall(0).args[0], true);
    });
    it("...", () => {
      const stub_completeStartup = sinon.stub(c, "completeStartup");

      c.guildWaitCount = 1;
      c.forceGuildMaximumUnavailable = 0;

      c.mostRecentGuildTimestamp = 0;
      c.forceGuildStartUpTimeout = 0;

      c.forceWithUnavailableGuild();

      sinon.assert.notCalled(stub_completeStartup);
    });
  });

  describe("upsertGuild", () => {
    let stub_guild_constructor;
    let fake_guild_constructGuild;
    let stub_guild_constructor_called = 0;

    function mockGuildClass() {
      ++stub_guild_constructor_called;
    }
    mockGuildClass.prototype.constructor = mockGuildClass;
    const guild = { id: "123" };

    beforeEach(() => {
      stub_guild_constructor_called = 0;
      fake_guild_constructGuild = sinon.fake(() => guild);
    });

    it(".", () => {
      const cachedGuild = {
        someVar: "abc",
        constructGuild: fake_guild_constructGuild
      };
      c.guilds.set(guild.id, cachedGuild, stub_guild_constructor);

      const got = ParacordClient.upsertGuild(guild, c, mockGuildClass);

      sinon.assert.calledOnce(fake_guild_constructGuild);
      assert.strictEqual(stub_guild_constructor_called, 0);
      assert.strictEqual(got, guild);
    });
    it("..", () => {
      const got = ParacordClient.upsertGuild(guild, c, mockGuildClass);

      sinon.assert.notCalled(fake_guild_constructGuild);
      assert.strictEqual(stub_guild_constructor_called, 1);
      assert.strictEqual(got instanceof mockGuildClass, true);
    });
  });

  describe("upsertUser", () => {
    let stub_util_constructUserTag;
    let stub_util_timestampFromSnowflake;
    let stub_upsertPresence;

    beforeEach(() => {
      stub_util_constructUserTag = sinon.stub(Util, "constructUserTag");
      stub_util_timestampFromSnowflake = sinon.stub(
        Util,
        "timestampFromSnowflake"
      );
      stub_upsertPresence = sinon.stub(ParacordClient, "upsertPresence");
    });

    it(".", () => {
      stub_util_constructUserTag.returns("tag#0000");
      stub_util_timestampFromSnowflake.returns(123);

      const user = { id: "abc" };
      const cachedUser = { prop: true };
      c.users.set(user.id, cachedUser);
      c.presences.set(user.id, null);

      const got = ParacordClient.upsertUser(user, c);

      const exp = { id: "abc", prop: true, tag: "tag#0000", created_on: 123 };

      sinon.assert.calledOnce(stub_util_constructUserTag);
      sinon.assert.calledOnce(stub_util_timestampFromSnowflake);
      sinon.assert.notCalled(stub_upsertPresence);
      assert.strictEqual(got, cachedUser);
      assert.deepStrictEqual(got, exp);
      assert.deepStrictEqual(c.users, new Map().set(cachedUser.id, cachedUser));
    });
    it("..", () => {
      stub_util_constructUserTag.returns("tag#0000");
      stub_util_timestampFromSnowflake.returns(123);

      const user = { id: "abc" };
      c.presences.set(user.id, null);

      const got = ParacordClient.upsertUser(user, c);

      const exp = { id: "abc", tag: "tag#0000", created_on: 123 };

      sinon.assert.calledOnce(stub_util_constructUserTag);
      sinon.assert.calledOnce(stub_util_timestampFromSnowflake);
      sinon.assert.notCalled(stub_upsertPresence);
      assert.deepStrictEqual(got, exp);
      assert.strictEqual(c.users.get(user.id), got);
    });
    it("...", () => {
      stub_util_constructUserTag.returns("tag#0000");
      stub_util_timestampFromSnowflake.returns(123);

      const user = { id: "abc", bot: true };

      const got = ParacordClient.upsertUser(user, c);

      const exp = {
        id: "abc",
        tag: "tag#0000",
        created_on: 123,
        bot: true
      };

      sinon.assert.calledOnce(stub_util_constructUserTag);
      sinon.assert.calledOnce(stub_util_timestampFromSnowflake);
      sinon.assert.calledOnce(stub_upsertPresence);
      assert.deepStrictEqual(got, exp);
    });
    it("....", () => {
      stub_util_constructUserTag.returns("tag#0000");
      stub_util_timestampFromSnowflake.returns(123);

      const user = { id: "abc" };

      const got = ParacordClient.upsertUser(user, c);

      sinon.assert.notCalled(stub_util_constructUserTag);
      sinon.assert.notCalled(stub_util_timestampFromSnowflake);
      sinon.assert.notCalled(stub_upsertPresence);
      assert.deepStrictEqual(got, undefined);
    });
    it(".....", () => {
      stub_util_constructUserTag.returns("tag#0000");
      stub_util_timestampFromSnowflake.returns(123);

      const cachedUser = { id: "abc", prop: true };
      c.users.set(cachedUser.id, cachedUser);

      const got = ParacordClient.upsertUser(cachedUser, c);

      sinon.assert.notCalled(stub_util_constructUserTag);
      sinon.assert.notCalled(stub_util_timestampFromSnowflake);
      sinon.assert.notCalled(stub_upsertPresence);
      assert.strictEqual(got, cachedUser);
    });
  });

  describe("updateCachesOnPresence", () => {
    let stub_upsertPresence;
    let stub_clearUserFromCaches;

    beforeEach(() => {
      stub_upsertPresence = sinon.stub(ParacordClient, "upsertPresence");
      stub_clearUserFromCaches = sinon.stub(
        ParacordClient,
        "clearUserFromCaches"
      );
    });

    it(".", () => {
      const presences = new Map();
      const presence = { user: { id: "123" } };

      ParacordClient.updateCachesOnPresence(presences, presence, c);

      sinon.assert.calledOnce(stub_upsertPresence);
      sinon.assert.notCalled(stub_clearUserFromCaches);
    });
    it("..", () => {
      const presences = new Map();
      const presence = { user: { id: "123" }, status: "offline" };

      ParacordClient.updateCachesOnPresence(presences, presence, c);

      sinon.assert.notCalled(stub_upsertPresence);
      sinon.assert.calledOnce(stub_clearUserFromCaches);
    });
  });

  describe("upsertPresence", () => {
    it(".", () => {
      const presences = new Map();
      const presence = { user: { id: "123" }, status: "online" };

      ParacordClient.upsertPresence(presences, presence, c);

      assert.deepStrictEqual(presences.get("123"), presence);
      assert.deepStrictEqual(c.presences.get("123"), presence);
      assert.deepStrictEqual(c.users, new Map());
    });
    it("..", () => {
      const presences = new Map();
      const presence = { user: { id: "123" }, status: "online" };
      const cachedPresence = {};
      c.presences.set("123", cachedPresence);

      ParacordClient.upsertPresence(presences, presence, c);

      assert.strictEqual(presences.get("123"), cachedPresence);
      assert.strictEqual(c.presences.get("123"), cachedPresence);
      assert.deepStrictEqual(presences.get("123"), presence);
      assert.deepStrictEqual(c.presences.get("123"), presence);
      assert.deepStrictEqual(c.users, new Map());
    });
    it("...", () => {
      const presences = new Map();
      const presence = { user: { id: "123" }, status: "online" };
      const cachedPresence = {};
      const cachedUser = { id: "123" };
      c.presences.set("123", cachedPresence);
      c.users.set("123", cachedUser);

      ParacordClient.upsertPresence(presences, presence, c);

      assert.strictEqual(presences.get("123"), cachedPresence);
      assert.strictEqual(c.presences.get("123"), cachedPresence);
      assert.strictEqual(c.users.get("123"), cachedUser);
      assert.strictEqual(cachedPresence.user, cachedUser);
      assert.deepStrictEqual(presences.get("123"), presence);
      assert.deepStrictEqual(c.presences.get("123"), presence);
    });
  });

  describe("clearUserFromCaches", () => {
    it(".", () => {
      const id = "123";
      c.presences.set("123", null);
      c.users.set("123", null);
      const guild = {
        presences: new Map().set("123", null),
        members: new Map().set("123", null)
      };
      c.guilds.set("abc", guild);

      ParacordClient.clearUserFromCaches(id, c);

      assert.deepStrictEqual(c.presences, new Map());
      assert.deepStrictEqual(c.users, new Map());
      assert.deepStrictEqual(guild.presences, new Map());
      assert.deepStrictEqual(guild.members, new Map());
    });
    it("..", () => {
      const id = "123";
      c.presences.set("123", null);
      c.users.set("123", { bot: true });
      const guild = {
        presences: new Map().set("123", null),
        members: new Map().set("123", null)
      };
      c.guilds.set("abc", guild);

      ParacordClient.clearUserFromCaches(id, c);

      assert.deepStrictEqual(c.presences, new Map().set("123", null));
      assert.deepStrictEqual(c.users, new Map().set("123", { bot: true }));
      assert.deepStrictEqual(guild.presences, new Map().set("123", null));
      assert.deepStrictEqual(guild.members, new Map().set("123", null));
    });
    it("...", () => {
      const id = "123";
      c.presences.set("123", null);
      c.users.set("123", { bot: false });
      const guild = {
        presences: new Map().set("123", null),
        members: new Map().set("123", null)
      };
      c.guilds.set("abc", guild);

      ParacordClient.clearUserFromCaches(id, c);

      assert.deepStrictEqual(c.presences, new Map());
      assert.deepStrictEqual(c.users, new Map());
      assert.deepStrictEqual(guild.presences, new Map());
      assert.deepStrictEqual(guild.members, new Map());
    });
  });

  describe("sweepCaches", () => {
    let stub_clearUserFromCaches;

    beforeEach(() => {
      stub_clearUserFromCaches = sinon.stub(
        ParacordClient,
        "clearUserFromCaches"
      );
    });

    it(".", () => {
      const members = new Map().set("123", {});
      const guild = { members };
      c.guilds.set(null, guild);
      c.presences.set("123");

      c.sweepCaches();

      sinon.assert.notCalled(stub_clearUserFromCaches);
    });
    it("..", () => {
      const members = new Map();
      const guild = { members };
      c.guilds.set(null, guild);
      c.presences.set("123");

      c.sweepCaches();

      sinon.assert.calledOnce(stub_clearUserFromCaches);
    });
  });

  describe("sweepOldEntries", () => {
    it(".", () => {
      const map = new Map();
      ParacordClient.sweepOldEntries(0, map);
    });
    it("..", () => {
      const map = new Map().set("123", 1);
      const exp = new Map([...map]);
      
      ParacordClient.sweepOldEntries(0, map);

      assert.deepStrictEqual(map, exp);
    });
    it("...", () => {
      const map = new Map().set("123", 1);
      const exp = new Map();
      
      ParacordClient.sweepOldEntries(2, map);

      assert.deepStrictEqual(map, exp);
    });
  });
});
