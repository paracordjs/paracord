"use strict";
const assert = require("assert");
const sinon = require("sinon");
const Guild = require("../Guild");
const ParacordClient = require("../../ParacordClient");
const Util = require("../../util/Util");

describe("Guild", () => {
  let g;
  let c;
  let clock;
  const token = "Bot tok";

  beforeEach(() => {
    g = new Guild({}, undefined, true);
    c = new ParacordClient(token);
    c.user = {};

    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    sinon.restore();
    clock.restore();
  });

  describe("constructGuild", () => {
    let stub_mapChannels;
    let stub_mapRoles;
    let stub_mapPresences;
    let stub_mapMembers;
    let stub_lazyLoadGuildOwner;
    let stub_lazyLoadguileMe;
    let stub_timestampFromSnowflake;

    beforeEach(() => {
      stub_mapChannels = sinon.stub(Guild, "mapChannels");
      stub_mapRoles = sinon.stub(Guild, "mapRoles");
      stub_mapPresences = sinon.stub(Guild, "mapPresences");
      stub_mapMembers = sinon.stub(Guild, "mapMembers");
      stub_lazyLoadGuildOwner = sinon.stub(Guild, "lazyLoadGuildOwner");
      stub_lazyLoadguileMe = sinon.stub(Guild, "lazyLoadGuildMe");
      stub_timestampFromSnowflake = sinon.stub(Util, "timestampFromSnowflake");
    });

    it(".", () => {
      const guildData = {};
      stub_timestampFromSnowflake.returns(1);

      g.constructGuild(guildData, c);

      sinon.assert.calledOnce(stub_timestampFromSnowflake);
      sinon.assert.notCalled(stub_mapChannels);
      sinon.assert.notCalled(stub_mapRoles);
      sinon.assert.notCalled(stub_mapPresences);
      sinon.assert.notCalled(stub_mapMembers);
      sinon.assert.calledOnce(stub_lazyLoadGuildOwner);
      sinon.assert.calledOnce(stub_lazyLoadguileMe);
      assert.strictEqual(g.created_on, 1);
      assert.deepStrictEqual(g.channels, new Map());
      assert.deepStrictEqual(g.roles, new Map());
      assert.deepStrictEqual(g.presences, new Map());
      assert.deepStrictEqual(g.members, new Map());
    });
    it("..", () => {
      const guildData = { channels: [], roles: [], presences: [], members: [] };
      const mapChannels_returns = new Map();
      const mapRoles_returns = new Map();
      const mapPresences_returns = new Map();
      const mapMembers_returns = new Map();
      stub_mapChannels.returns(mapChannels_returns);
      stub_mapRoles.returns(mapRoles_returns);
      stub_mapPresences.returns(mapPresences_returns);
      stub_mapMembers.returns(mapMembers_returns);
      g.created_on = 1;

      g.constructGuild(guildData, c);

      sinon.assert.notCalled(stub_timestampFromSnowflake);
      sinon.assert.calledOnce(stub_mapChannels);
      sinon.assert.calledOnce(stub_mapRoles);
      sinon.assert.calledOnce(stub_mapPresences);
      sinon.assert.calledOnce(stub_mapMembers);
      sinon.assert.calledOnce(stub_lazyLoadGuildOwner);
      sinon.assert.calledOnce(stub_lazyLoadguileMe);
      assert.strictEqual(g.channels, mapChannels_returns);
      assert.strictEqual(g.roles, mapRoles_returns);
      assert.strictEqual(g.presences, mapPresences_returns);
      assert.strictEqual(g.members, mapMembers_returns);
    });
    it("...", () => {
      const guildData = { members: [] };
      stub_timestampFromSnowflake.returns(1);
      const owner = { user: { id: "abc" } };
      const me = { id: "def" };
      const mapMembers_returns = new Map().set("abc", owner)
.set("def", me);
      stub_mapMembers.returns(mapMembers_returns);
      guildData.owner_id = "abc";
      c.user = me;

      g.constructGuild(guildData, c);

      sinon.assert.calledOnce(stub_timestampFromSnowflake);
      sinon.assert.calledOnce(stub_mapMembers);
      sinon.assert.notCalled(stub_lazyLoadGuildOwner);
      sinon.assert.notCalled(stub_lazyLoadguileMe);
      assert.strictEqual(g.owner, owner);
      assert.strictEqual(g.me, me);
    });
    it("....", () => {
      const guildData = { unavailable: null };

      g.constructGuild(guildData, c);

      sinon.assert.notCalled(stub_timestampFromSnowflake);
      sinon.assert.notCalled(stub_mapChannels);
      sinon.assert.notCalled(stub_mapRoles);
      sinon.assert.notCalled(stub_mapPresences);
      sinon.assert.notCalled(stub_mapMembers);
      sinon.assert.notCalled(stub_lazyLoadGuildOwner);
      sinon.assert.notCalled(stub_lazyLoadguileMe);
      assert.strictEqual(g.unavailable, true);
    });
  });

  describe("upsertChannel", () => {
    it(".", () => {
      const stub_timestampFromSnowflake = sinon
        .stub(Util, "timestampFromSnowflake")
        .returns(0);
      const channels = new Map();
      const channel = { id: "1234567890987654231" };

      Guild.upsertChannel(channels, channel);

      sinon.assert.calledOnce(stub_timestampFromSnowflake);
      assert.strictEqual(channels.size, 1);
      assert.deepStrictEqual(channels.get("1234567890987654231"), channel);
      assert.strictEqual(channels.get("1234567890987654231").created_on, 0);
    });
  });

  describe("mapChannels", () => {
    let sub_upsertChannel;

    beforeEach(() => {
      sub_upsertChannel = sinon.stub(Guild, "upsertChannel");
    });

    it(".", () => {
      const got = Guild.mapChannels([]);

      const exp = new Map();

      sinon.assert.notCalled(sub_upsertChannel);
      assert.deepStrictEqual(got, exp);
    });
    it("..", () => {
      const channel = {};

      const got = Guild.mapChannels([channel]);
      const exp = new Map();

      sinon.assert.calledOnce(sub_upsertChannel);
      assert.deepStrictEqual(got, exp);
      assert.strictEqual(sub_upsertChannel.getCall(0).args[1], channel);
    });
    it("...", () => {
      const channel1 = {};
      const channel2 = {};

      const got = Guild.mapChannels([channel1, channel2]);
      const exp = new Map();

      sinon.assert.calledTwice(sub_upsertChannel);
      assert.deepStrictEqual(got, exp);
      assert.strictEqual(sub_upsertChannel.getCall(0).args[1], channel1);
      assert.strictEqual(sub_upsertChannel.getCall(1).args[1], channel2);
    });
  });

  describe("upsertRole", () => {
    it(".", () => {
      const stub_timestampFromSnowflake = sinon
        .stub(Util, "timestampFromSnowflake")
        .returns(0);
      const roles = new Map();
      const role = { id: "1234567890987654231" };

      Guild.upsertRole(roles, role);

      sinon.assert.calledOnce(stub_timestampFromSnowflake);
      assert.strictEqual(roles.size, 1);
      assert.deepStrictEqual(roles.get("1234567890987654231"), role);
      assert.strictEqual(roles.get("1234567890987654231").created_on, 0);
    });
  });

  describe("mapRoles", () => {
    let sub_upsertRole;

    beforeEach(() => {
      sub_upsertRole = sinon.stub(Guild, "upsertRole");
    });

    it(".", () => {
      const got = Guild.mapRoles([]);
      const exp = new Map();

      sinon.assert.notCalled(sub_upsertRole);
      assert.deepStrictEqual(got, exp);
    });
    it("..", () => {
      const role = {};
      const got = Guild.mapRoles([role]);
      const exp = new Map();

      sinon.assert.calledOnce(sub_upsertRole);
      assert.deepStrictEqual(got, exp);
      assert.strictEqual(sub_upsertRole.getCall(0).args[1], role);
    });
    it("...", () => {
      const role1 = {};
      const role2 = {};

      const got = Guild.mapRoles([role1, role2]);
      const exp = new Map();

      sinon.assert.calledTwice(sub_upsertRole);
      assert.deepStrictEqual(got, exp);
      assert.strictEqual(sub_upsertRole.getCall(0).args[1], role1);
      assert.strictEqual(sub_upsertRole.getCall(1).args[1], role2);
    });
  });

  describe("upsertMember", () => {
    let stub_paracord_upsertUser;

    beforeEach(() => {
      stub_paracord_upsertUser = sinon.stub(ParacordClient, "upsertUser");
    });

    it(".", () => {
      const cachedUser = { id: "abc", prop: true };
      stub_paracord_upsertUser.returns(cachedUser);
      const cachedMember = { prop: true };
      const members = new Map().set(cachedUser.id, cachedMember);
      const member = { user: { id: cachedUser.id }, prop: false };
      const guild = { presences: new Map().set(member.user.id, null) };

      Guild.upsertMember(members, member, guild, c);

      sinon.assert.calledOnce(stub_paracord_upsertUser);
      assert.strictEqual(members.size, 1);
      assert.strictEqual(members.get(member.user.id), cachedMember);
      assert.deepStrictEqual(members.get(member.user.id), {
        user: cachedUser,
        prop: false
      });
    });
    it("..", () => {
      const cachedUser = { id: "abc", prop: true };
      stub_paracord_upsertUser.returns(cachedUser);
      const members = new Map();
      const member = { user: { id: cachedUser.id }, prop: false };
      const guild = { presences: new Map().set(member.user.id, null) };

      Guild.upsertMember(members, member, guild, c);

      sinon.assert.calledOnce(stub_paracord_upsertUser);
      assert.strictEqual(members.size, 1);
      assert.deepStrictEqual(members.get(member.user.id), {
        user: cachedUser,
        prop: false
      });
    });
    it("...", () => {
      stub_paracord_upsertUser.returns(undefined);
      const members = new Map();
      const member = { user: { id: "abc" } };
      const guild = { presences: new Map().set(member.user.id, null) };

      Guild.upsertMember(members, member, guild, c);

      sinon.assert.calledOnce(stub_paracord_upsertUser);
      assert.strictEqual(members.size, 0);
    });
    it("....", () => {
      const members = new Map();
      const member = { user: { id: "abc" } };
      const guild = { presences: new Map() };

      Guild.upsertMember(members, member, guild, c);

      sinon.assert.notCalled(stub_paracord_upsertUser);
    });
  });

  describe("mapMembers", () => {
    it(".", () => {
      const sub_upsertMember = sinon.stub(Guild, "upsertMember");
      const members = [{}];

      Guild.mapMembers(members);

      sinon.assert.calledOnce(sub_upsertMember);
    });
  });

  describe("mapPresences", () => {
    it(".", () => {
      const stub_paracord_upsertPresence = sinon.stub(
        ParacordClient,
        "upsertPresence"
      );
      const presences = [{}];

      Guild.mapPresences(presences);

      sinon.assert.calledOnce(stub_paracord_upsertPresence);
    });
  });
});
