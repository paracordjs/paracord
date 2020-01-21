"use strict";
/* eslint-disable new-cap*/

const assert = require("assert");
const sinon = require("sinon");
const mod = require("../ParacordClientEvents");
const ParacordClient = require("../../ParacordClient");
const Guild = require("../../structures/Guild");

describe("ParacordClientEvents", () => {
  let c;
  let clock;
  const tok = "some tok";

  beforeEach(() => {
    c = new ParacordClient(tok);
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    sinon.restore();
    clock.restore();
  });

  describe("READY", () => {
    it(".", () => {
      const stub_client_handleReady = sinon.stub(c, "handleReady");
      const data = {};

      mod.READY(c, data);

      sinon.assert.calledOnce(stub_client_handleReady);
      assert.strictEqual(stub_client_handleReady.getCall(0).args[0], data);
    });
  });

  describe("PRESENCE_UPDATE", () => {
    let stub_paracord_updateCachesOnPresence;

    beforeEach(() => {
      stub_paracord_updateCachesOnPresence = sinon.stub(
        ParacordClient,
        "updateCachesOnPresence"
      );
    });

    it(".", () => {
      const cachedPresence = {};
      stub_paracord_updateCachesOnPresence.returns(cachedPresence);
      c.guilds.set("123", {});
      const data = { guild_id: "123", user: { id: "abc" } };

      const got = mod.PRESENCE_UPDATE(c, data);

      sinon.assert.calledOnce(stub_paracord_updateCachesOnPresence);
      assert.strictEqual(got, cachedPresence);
    });
    it("..", () => {
      const cachedPresence = {};
      c.guilds.set("123", {});
      c.veryRecentlyUpdatedPresences.set("abc", null);
      c.presences.set("abc", cachedPresence);
      const data = { guild_id: "123", user: { id: "abc" } };

      const got = mod.PRESENCE_UPDATE(c, data);

      sinon.assert.notCalled(stub_paracord_updateCachesOnPresence);
      assert.strictEqual(got, cachedPresence);
      assert.deepStrictEqual(
        c.veryRecentlyUpdatedPresences,
        new Map().set("abc", 500)
      );
    });
    it("...", () => {
      c.guilds.set("123", {});
      c.veryRecentlyUpdatedPresences.set("abc", null);
      const data = { guild_id: "123", user: { id: "abc" } };

      const got = mod.PRESENCE_UPDATE(c, data);

      sinon.assert.notCalled(stub_paracord_updateCachesOnPresence);
      assert.strictEqual(got, data);
    });
  });

  describe("USER_UPDATE", () => {
    let stub_paracord_upsertUser;

    beforeEach(() => {
      stub_paracord_upsertUser = sinon.stub(ParacordClient, "upsertUser");
    });
    it(".", () => {
      const cachedUser = {};
      stub_paracord_upsertUser.returns(cachedUser);
      const data = { id: "abc" };

      const got = mod.USER_UPDATE(c, data);

      sinon.assert.calledOnce(stub_paracord_upsertUser);
      assert.strictEqual(got, cachedUser);
    });
    it("..", () => {
      const cachedUser = {};
      c.veryRecentlyUpdatedUsers.set("abc", null);
      c.users.set("abc", cachedUser);
      const data = { id: "abc" };

      const got = mod.USER_UPDATE(c, data);

      sinon.assert.notCalled(stub_paracord_upsertUser);
      assert.strictEqual(got, cachedUser);
    });
    it("...", () => {
      c.veryRecentlyUpdatedUsers.set("abc", null);
      const data = { id: "abc" };

      const got = mod.USER_UPDATE(c, data);

      sinon.assert.notCalled(stub_paracord_upsertUser);
      assert.strictEqual(got, data);
    });
  });

  describe("cacheMemberFromMessage", () => {
    let stub_guild_upsertMember;

    beforeEach(() => {
      stub_guild_upsertMember = sinon.stub(Guild, "upsertMember");
    });

    it(".", () => {
      const user = { id: "abc" };
      const data = { guild_id: "123", member: {}, author: user };
      c.guilds.set("123", { members: new Map() });
      c.presences.set("abc", null);

      const got = mod.cacheMemberFromMessage(c, data);

      sinon.assert.calledOnce(stub_guild_upsertMember);
      assert.strictEqual(got, data);
    });
    it("..", () => {
      const user = { id: "abc" };
      const data = { guild_id: "123", author: user };
      c.guilds.set("123", { members: new Map() });
      c.presences.set("abc", null);

      const got = mod.cacheMemberFromMessage(c, data);

      sinon.assert.notCalled(stub_guild_upsertMember);
      assert.strictEqual(got, data);
    });
    it("...", () => {
      const user = { id: "abc" };
      const data = { guild_id: "123", member: {}, author: user };
      c.presences.set("abc", null);

      const got = mod.cacheMemberFromMessage(c, data);

      sinon.assert.notCalled(stub_guild_upsertMember);
      assert.strictEqual(got, data);
    });
    it("....", () => {
      const user = { id: "abc" };
      const data = { guild_id: "123", member: {}, author: user };
      c.guilds.set("123", { members: new Map().set(user.id, null) });
      c.presences.set("abc", null);

      const got = mod.cacheMemberFromMessage(c, data);

      sinon.assert.notCalled(stub_guild_upsertMember);
      assert.strictEqual(got, data);
    });
    it(".....", () => {
      const user = { id: "abc" };
      const data = { guild_id: "123", member: {}, author: user };
      c.guilds.set("123", { members: new Map() });

      const got = mod.cacheMemberFromMessage(c, data);

      sinon.assert.notCalled(stub_guild_upsertMember);
      assert.strictEqual(got, data);
    });
  });

  describe("GUILD_MEMBER_ADD", () => {
    it(".", () => {
      const stub_guild_upsertMember = sinon.stub(Guild, "upsertMember");
      const data = {};

      const got = mod.GUILD_MEMBER_ADD(c, data);

      sinon.assert.notCalled(stub_guild_upsertMember);
      assert.strictEqual(got, data);
    });
    it("..", () => {
      const stub_guild_upsertMember = sinon.stub(Guild, "upsertMember");
      const data = { guild_id: "123" };
      const guild = { member_count: 1 };
      c.guilds.set("123", guild);

      const got = mod.GUILD_MEMBER_ADD(c, data);

      sinon.assert.calledOnce(stub_guild_upsertMember);
      assert.strictEqual(got, data);
      assert.strictEqual(guild.member_count, 2);
    });
  });
  describe("GUILD_MEMBER_UPDATE", () => {
    it(".", () => {
      const stub_guild_upsertMember = sinon.stub(Guild, "upsertMember");
      const data = {};

      const got = mod.GUILD_MEMBER_UPDATE(c, data);

      sinon.assert.notCalled(stub_guild_upsertMember);
      assert.strictEqual(got, data);
    });
    it("..", () => {
      const stub_guild_upsertMember = sinon.stub(Guild, "upsertMember");
      const data = { guild_id: "123" };
      const guild = { member_count: 1 };
      c.guilds.set("123", guild);

      const got = mod.GUILD_MEMBER_UPDATE(c, data);

      sinon.assert.calledOnce(stub_guild_upsertMember);
      assert.strictEqual(got, data);
      assert.strictEqual(guild.member_count, 1);
    });
  });
  describe("GUILD_MEMBER_REMOVE", () => {
    it(".", () => {
      const data = { guild_id: "123", user: { id: "abc" } };
      const members = new Map().set("abc", null);
      const guild = { member_count: 1, members: new Map([...members]) };

      const got = mod.GUILD_MEMBER_REMOVE(c, data);

      assert.strictEqual(got, data);
      assert.strictEqual(guild.member_count, 1);
      assert.deepStrictEqual(guild.members, members);
    });
    it("..", () => {
      const data = { guild_id: "123", user: { id: "abc" } };
      const members = new Map().set("abc", null);
      const guild = { member_count: 1, members };
      c.guilds.set("123", guild);
      c.user = {};

      const got = mod.GUILD_MEMBER_REMOVE(c, data);

      assert.strictEqual(got, data);
      assert.strictEqual(guild.member_count, 0);
      assert.deepStrictEqual(guild.members, new Map());
    });
    it("...", () => {
      const data = { guild_id: "123", user: { id: "abc" } };
      const members = new Map().set("abc", null);
      const guild = { member_count: 1, members };
      c.guilds.set("123", guild);
      c.user = { id: data.user.id };

      const got = mod.GUILD_MEMBER_REMOVE(c, data);

      assert.strictEqual(got, data);
      assert.strictEqual(guild.member_count, 0);
      assert.deepStrictEqual(guild.members, members);
    });
  });

  describe("CHANNEL_CREATE", () => {
    it(".", () => {
      const stub_guild_upsertChannel = sinon.stub(Guild, "upsertChannel");
      const data = {};

      const got = mod.CHANNEL_CREATE(c, data);

      sinon.assert.notCalled(stub_guild_upsertChannel);
      assert.strictEqual(got, data);
    });
    it("..", () => {
      const stub_guild_upsertChannel = sinon.stub(Guild, "upsertChannel");
      const data = { guild_id: "123" };
      c.guilds.set("123", {});

      const got = mod.CHANNEL_CREATE(c, data);

      sinon.assert.calledOnce(stub_guild_upsertChannel);
      assert.strictEqual(got, data);
    });
  });
  describe("CHANNEL_UPDATE", () => {
    it(".", () => {
      const stub_guild_upsertChannel = sinon.stub(Guild, "upsertChannel");
      const data = {};

      const got = mod.CHANNEL_UPDATE(c, data);

      sinon.assert.notCalled(stub_guild_upsertChannel);
      assert.strictEqual(got, data);
    });
    it("..", () => {
      const stub_guild_upsertChannel = sinon.stub(Guild, "upsertChannel");
      const data = { guild_id: "123" };
      c.guilds.set("123", {});

      const got = mod.CHANNEL_UPDATE(c, data);

      sinon.assert.calledOnce(stub_guild_upsertChannel);
      assert.strictEqual(got, data);
    });
  });
  describe("CHANNEL_DELETE", () => {
    it(".", () => {
      const data = { guild_id: "123", id: "abc" };
      const channels = new Map().set("abc", null);
      const guild = { channels: new Map([...channels]) };

      const got = mod.GUILD_MEMBER_REMOVE(c, data);

      assert.deepStrictEqual(guild.channels, channels);
      assert.strictEqual(got, data);
    });
    it("..", () => {
      const data = { guild_id: "123", id: "abc" };
      const channels = new Map().set("abc", null);
      const guild = { channels };
      c.guilds.set("123", guild);

      const got = mod.CHANNEL_DELETE(c, data);

      assert.deepStrictEqual(guild.channels, new Map());
      assert.strictEqual(got, data);
    });
  });

  describe("GUILD_ROLE_CREATE", () => {
    it(".", () => {
      const stub_guild_upsertRole = sinon.stub(Guild, "upsertRole");
      const data = {};

      const got = mod.GUILD_ROLE_CREATE(c, data);

      sinon.assert.notCalled(stub_guild_upsertRole);
      assert.strictEqual(got, data);
    });
    it("..", () => {
      const stub_guild_upsertRole = sinon.stub(Guild, "upsertRole");
      const data = { guild_id: "123" };
      c.guilds.set("123", {});

      const got = mod.GUILD_ROLE_CREATE(c, data);

      sinon.assert.calledOnce(stub_guild_upsertRole);
      assert.strictEqual(got, data);
    });
  });
  describe("GUILD_ROLE_UPDATE", () => {
    it(".", () => {
      const stub_guild_upsertRole = sinon.stub(Guild, "upsertRole");
      const data = {};

      const got = mod.GUILD_ROLE_UPDATE(c, data);

      sinon.assert.notCalled(stub_guild_upsertRole);
      assert.strictEqual(got, data);
    });
    it("..", () => {
      const stub_guild_upsertRole = sinon.stub(Guild, "upsertRole");
      const data = { guild_id: "123" };
      c.guilds.set("123", {});

      const got = mod.GUILD_ROLE_CREATE(c, data);

      sinon.assert.calledOnce(stub_guild_upsertRole);
      assert.strictEqual(got, data);
    });
  });
  describe("GUILD_ROLE_DELETE", () => {
    it(".", () => {
      const data = { guild_id: "123", role_id: "abc" };
      const roles = new Map().set("abc", null);
      const guild = { roles: new Map([...roles]) };

      const got = mod.GUILD_MEMBER_REMOVE(c, data);

      assert.deepStrictEqual(guild.roles, roles);
      assert.strictEqual(got, data);
    });
    it("..", () => {
      const data = { guild_id: "123", role_id: "abc" };
      const roles = new Map().set("abc", null);
      const guild = { roles };
      c.guilds.set("123", guild);

      const got = mod.GUILD_ROLE_DELETE(c, data);

      assert.deepStrictEqual(guild.roles, new Map());
      assert.strictEqual(got, data);
    });
  });

  describe("GUILD_CREATE", () => {
    it(".", () => {
      const upsertGuild_returns = {};
      const stub_paracord_upsertGuild = sinon
        .stub(ParacordClient, "upsertGuild")
        .returns(upsertGuild_returns);

      const data = {};

      const got = mod.GUILD_CREATE(c, data);

      sinon.assert.calledOnce(stub_paracord_upsertGuild);
      assert.strictEqual(got, upsertGuild_returns);
    });
  });
  describe("GUILD_UPDATE", () => {
    it(".", () => {
      const upsertGuild_returns = {};
      const stub_paracord_upsertGuild = sinon
        .stub(ParacordClient, "upsertGuild")
        .returns(upsertGuild_returns);
      const data = {};

      const got = mod.GUILD_UPDATE(c, data);

      sinon.assert.calledOnce(stub_paracord_upsertGuild);
      assert.strictEqual(got, upsertGuild_returns);
    });
  });
  describe("GUILD_DELETE", () => {
    let stub_paracord_upsertGuild;

    beforeEach(() => {
      stub_paracord_upsertGuild = sinon.stub(ParacordClient, "upsertGuild");
    });

    it(".", () => {
      const guild = { id: "123" };
      const data = { id: "123" };
      c.guilds.set(guild.id, guild);

      const got = mod.GUILD_DELETE(c, data);

      sinon.assert.notCalled(stub_paracord_upsertGuild);
      assert.strictEqual(got, guild);
      assert.deepStrictEqual(c.guilds, new Map());
    });
    it("..", () => {
      const guild = { id: "123" };
      const data = { id: "123", unavailable: true };
      c.guilds.set(guild.id, guild);
      const gotGuilds = new Map([...c.guilds]);

      const got = mod.GUILD_DELETE(c, data);

      sinon.assert.notCalled(stub_paracord_upsertGuild);
      assert.strictEqual(got, guild);
      assert.deepStrictEqual(c.guilds, gotGuilds);
    });
    it("...", () => {
      const guild = { id: "123" };
      stub_paracord_upsertGuild.returns(guild);
      const data = { id: "123", unavailable: true };

      const got = mod.GUILD_DELETE(c, data);

      sinon.assert.calledOnce(stub_paracord_upsertGuild);
      assert.strictEqual(got, guild);
    });
    it("....", () => {
      const data = { id: "123" };

      const got = mod.GUILD_DELETE(c, data);

      sinon.assert.notCalled(stub_paracord_upsertGuild);
      assert.strictEqual(got, data);
    });
  });
});

// let stub_paracord_upsertGuild;
// let fake_guild_constructor;
// let mock_Guild;

// beforeEach(() => {
//   stub_paracord_upsertGuild = sinon.stub(ParacordClient, "upsertGuild");
//   fake_guild_constructor = sinon.fake(() => {});
//   mock_Guild = class {
//     constructor() {
//       fake_guild_constructor();
//     }
//   };
// });
// sinon.assert.calledOnce(fake_guild_constructor);
