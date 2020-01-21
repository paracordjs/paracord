"use strict";
const assert = require("assert");
const sinon = require("sinon");
const Util = require("../Util");

describe("Util", () => {
  describe("timestampFromSnowflake", () => {
    it(".", () => {
      const snowflake = "399864099946889216";

      const got = Util.timestampFromSnowflake(snowflake);

      assert.deepStrictEqual(got, 1515405430543);
    });
  });

  describe("computeGuildPerms", () => {
    it(".", () => {
      const member = { user: { id: "123" } };
      const guild = { owner: { user: { id: "123" } } };

      const got = Util.computeGuildPerms(member, guild);

      assert.strictEqual(got, 0x8);
    });
    it("..", () => {
      const member = { user: { id: "124" }, roles: [] };
      const guild = { owner: { user: { id: "123" } }, roles: new Map() };
      const stub_guild_roles_get = sinon.stub(guild.roles, "get");
      stub_guild_roles_get.returns({ permissions: 0 });

      const got = Util.computeGuildPerms(member, guild);

      sinon.assert.calledOnce(stub_guild_roles_get);
      assert.strictEqual(got, 0);
    });
    it("...", () => {
      const member = { user: { id: "124" }, roles: ["1"] };
      const guild = { id: "125", owner: { user: { id: "123" } }, roles: new Map() };
      const stub_guild_roles_get = sinon.stub(guild.roles, "get");
      stub_guild_roles_get.onCall(0).returns({ permissions: 0 });
      stub_guild_roles_get.onCall(1).returns(undefined);

      const got = Util.computeGuildPerms(member, guild);

      sinon.assert.calledTwice(stub_guild_roles_get);
      assert.strictEqual(got, 0);
      assert.strictEqual(stub_guild_roles_get.getCall(0).args[0], "125");
    });
    it("....", () => {
      const member = { user: { id: "124" }, roles: ["1"] };
      const guild = { owner: { user: { id: "123" } }, roles: new Map() };
      const stub_guild_roles_get = sinon.stub(guild.roles, "get");
      stub_guild_roles_get.onCall(0).returns({ permissions: 0 });
      stub_guild_roles_get.onCall(1).returns({ permissions: 0x8 });

      const got = Util.computeGuildPerms(member, guild);

      sinon.assert.calledTwice(stub_guild_roles_get);
      assert.strictEqual(got, 0x8);
      assert.strictEqual(stub_guild_roles_get.getCall(1).args[0], "1");
    });
    it(".....", () => {
      const member = { user: { id: "124" }, roles: ["1", "2"] };
      const guild = { owner: { user: { id: "123" } }, roles: new Map() };
      const stub_guild_roles_get = sinon.stub(guild.roles, "get");
      stub_guild_roles_get.onCall(0).returns({ permissions: 0 });
      stub_guild_roles_get.onCall(1).returns({ permissions: 0x1 });
      stub_guild_roles_get.onCall(2).returns({ permissions: 0x2 });

      const got = Util.computeGuildPerms(member, guild);

      sinon.assert.calledThrice(stub_guild_roles_get);
      assert.strictEqual(got, 0x3);
      assert.strictEqual(stub_guild_roles_get.getCall(2).args[0], "2");
    });
  });

  describe("_everyoneOverwrites", () => {
    it(".", () => {
      const perms = 0;
      const overwrites = [];
      const guildID = "123";

      const got = Util._everyoneOverwrites(perms, overwrites, guildID);

      assert.strictEqual(got, 0);
    });
    it("..", () => {
      const perms = 0x1;
      const overwrites = [{ type: "role", id: "123", allow: 0x2, deny: 0x0 }];
      const guildID = "123";

      const got = Util._everyoneOverwrites(perms, overwrites, guildID);

      assert.strictEqual(got, 0x3);
    });
    it("...", () => {
      const perms = 0x1;
      const overwrites = [{ type: "role", id: "123", allow: 0x2, deny: 0x1 }];
      const guildID = "123";

      const got = Util._everyoneOverwrites(perms, overwrites, guildID);

      assert.strictEqual(got, 0x2);
    });
    it("....", () => {
      const perms = 0x1;
      const overwrites = [{ type: "member", id: "123", allow: 0x2, deny: 0x1 }];
      const guildID = "123";

      const got = Util._everyoneOverwrites(perms, overwrites, guildID);

      assert.strictEqual(got, 0x1);
    });
  });

  describe("_roleOverwrites", () => {
    it(".", () => {
      const perms = 0;
      const overwrites = [];
      const roles = [];

      const got = Util._roleOverwrites(perms, overwrites, roles);

      assert.strictEqual(got, 0);
    });
    it("..", () => {
      const perms = 0b01;
      const overwrites = [{ type: "role", id: "123", allow: 0b10, deny: 0b01 }];
      const roles = [];

      const got = Util._roleOverwrites(perms, overwrites, roles);

      assert.strictEqual(got, 0b01);
    });
    it("...", () => {
      const perms = 0b01;
      const overwrites = [{ type: "role", id: "123", allow: 0b10 }];
      const roles = ["123"];

      const got = Util._roleOverwrites(perms, overwrites, roles);

      assert.strictEqual(got, 0b11);
    });
    it("....", () => {
      const perms = 0b01;
      const overwrites = [{ type: "role", id: "123", allow: 0b10, deny: 0b01 }];
      const roles = ["123"];

      const got = Util._roleOverwrites(perms, overwrites, roles);

      assert.strictEqual(got, 0b10);
    });
    it(".....", () => {
      const perms = 0b0001;
      const overwrites = [
        { type: "role", id: "123", allow: 0b0010 },
        { type: "role", id: "456", allow: 0b0100 },
        { type: "role", id: "789", allow: 0b1000 }
      ];
      const roles = ["123", "789"];

      const got = Util._roleOverwrites(perms, overwrites, roles);

      assert.strictEqual(got, 0b1011);
    });
    it("......", () => {
      const perms = 0b0001;
      const overwrites = [
        { type: "role", id: "123", allow: 0b0010 },
        { type: "role", id: "456", allow: 0b0100 },
        { type: "member", id: "789", allow: 0b1000 }
      ];
      const roles = ["123", "789"];

      const got = Util._roleOverwrites(perms, overwrites, roles);

      assert.strictEqual(got, 0b0011);
    });
  });

  describe("_memberOverwrites", () => {
    it(".", () => {
      const perms = 0;
      const overwrites = [];
      const memberID = "123";

      const got = Util._memberOverwrites(perms, overwrites, memberID);

      assert.strictEqual(got, 0);
    });
    it("..", () => {
      const perms = 0x1;
      const overwrites = [{ type: "member", id: "123", allow: 0x2, deny: 0x0 }];
      const memberID = "123";

      const got = Util._memberOverwrites(perms, overwrites, memberID);

      assert.strictEqual(got, 0x3);
    });
    it("...", () => {
      const perms = 0x1;
      const overwrites = [{ type: "member", id: "123", allow: 0x2, deny: 0x1 }];
      const memberID = "123";

      const got = Util._memberOverwrites(perms, overwrites, memberID);

      assert.strictEqual(got, 0x2);
    });
    it("....", () => {
      const perms = 0x0;
      const overwrites = [{ type: "member", id: "123", deny: 0x1 }];
      const memberID = "123";

      const got = Util._memberOverwrites(perms, overwrites, memberID);

      assert.strictEqual(got, 0x0);
    });
    it(".....", () => {
      const perms = 0x1;
      const overwrites = [{ type: "role", id: "123", allow: 0x2, deny: 0x1 }];
      const memberID = "123";

      const got = Util._memberOverwrites(perms, overwrites, memberID);

      assert.strictEqual(got, 0x1);
    });
  });

  describe("computeChannelOverwrites", () => {
    it(".", () => {
      const stub_everyoneOverwrites = sinon.stub(Util, "_everyoneOverwrites");
      const stub_roleOverwrites = sinon.stub(Util, "_roleOverwrites");
      const stub_memberOverwrites = sinon.stub(Util, "_memberOverwrites").returns(1);

      const perms = 0;
      const member = { user: {} };
      const guild = {};
      const channel = { permission_overwrites: [] };

      const got = Util.computeChannelOverwrites(perms, member, guild, channel);

      sinon.assert.calledOnce(stub_everyoneOverwrites);
      sinon.assert.calledOnce(stub_roleOverwrites);
      sinon.assert.calledOnce(stub_memberOverwrites);
      assert.strictEqual(got, 1);
    });
  });

  describe("computeChannelPerms", () => {
    it(".", () => {
      const stub_computeGuildPerms = sinon.stub(Util, "computeGuildPerms").returns(0x8);
      const stub_computerChannelOverwrites = sinon.stub(Util, "computeChannelOverwrites");

      const got = Util.computeChannelPerms();

      sinon.assert.calledOnce(stub_computeGuildPerms);
      sinon.assert.notCalled(stub_computerChannelOverwrites);
      assert.strictEqual(got, 0x8);
    });
    it("..", () => {
      const stub_computeGuildPerms = sinon.stub(Util, "computeGuildPerms");
      const stub_computerChannelOverwrites = sinon.stub(Util, "computeChannelOverwrites").returns(1);

      const got = Util.computeChannelPerms();

      sinon.assert.calledOnce(stub_computeGuildPerms);
      sinon.assert.calledOnce(stub_computerChannelOverwrites);
      assert.strictEqual(got, 1);
    });
  });
});
