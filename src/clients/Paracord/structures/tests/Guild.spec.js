// "use strict";
// const assert = require("assert");
// const sinon = require("sinon");
// const Guild = require("../Guild");
// const Paracord = require("../../Paracord");
// const Utils = require("../../../../utils/Util");

// describe("Guild", () => {
//   let g;
//   let c;
//   let clock;
//   const token = "Bot tok";

//   beforeEach(() => {
//     g = new Guild({}, undefined, true);
//     c = new Paracord(token);
//     c.user = {};

//     clock = sinon.useFakeTimers();
//   });

//   afterEach(() => {
//     sinon.restore();
//     clock.restore();
//   });

//   describe("constructGuildFromData", () => {
//     let stub_mapChannels;
//     let stub_mapRoles;
//     let stub_mapPresences;
//     let stub_mapMembers;
//     // let stub_lazyLoadGuildOwner;
//     let stub_lazyLoadguileMe;
//     let stub_timestampFromSnowflake;

//     beforeEach(() => {
//       stub_mapChannels = sinon.stub(Guild, "mapChannels");
//       stub_mapRoles = sinon.stub(Guild, "mapRoles");
//       stub_mapPresences = sinon.stub(Guild, "mapPresences");
//       stub_mapMembers = sinon.stub(Guild, "mapMembers");
//       // stub_lazyLoadGuildOwner = sinon.stub(Guild, "lazyLoadGuildOwner");
//       stub_lazyLoadguileMe = sinon.stub(Guild, "lazyLoadGuildMe");
//       stub_timestampFromSnowflake = sinon.stub(Util, "timestampFromSnowflake");
//     });

//     it(".", () => {
//       const guildData = {};
//       stub_timestampFromSnowflake.returns(1);

//       g.constructGuildFromData(guildData, c);

//       sinon.assert.calledOnce(stub_timestampFromSnowflake);
//       sinon.assert.notCalled(stub_mapChannels);
//       sinon.assert.notCalled(stub_mapRoles);
//       sinon.assert.notCalled(stub_mapPresences);
//       sinon.assert.notCalled(stub_mapMembers);
//       // sinon.assert.calledOnce(stub_lazyLoadGuildOwner);
//       sinon.assert.calledOnce(stub_lazyLoadguileMe);
//       assert.strictEqual(g.created_on, 1);
//       assert.deepStrictEqual(g.channels, new Map());
//       assert.deepStrictEqual(g.roles, new Map());
//       assert.deepStrictEqual(g.presences, new Map());
//       assert.deepStrictEqual(g.members, new Map());
//     });
//     it("..", () => {
//       const guildData = { channels: [], roles: [], presences: [], members: [] };
//       const mapChannels_returns = new Map();
//       const mapRoles_returns = new Map();
//       const mapPresences_returns = new Map();
//       // const mapMembers_returns = new Map();
//       stub_mapChannels.returns(mapChannels_returns);
//       stub_mapRoles.returns(mapRoles_returns);
//       stub_mapPresences.returns(mapPresences_returns);
//       // stub_mapMembers.returns(mapMembers_returns);
//       g.created_on = 1;

//       g.constructGuildFromData(guildData, c);

//       sinon.assert.notCalled(stub_timestampFromSnowflake);
//       sinon.assert.calledOnce(stub_mapChannels);
//       sinon.assert.calledOnce(stub_mapRoles);
//       sinon.assert.calledOnce(stub_mapPresences);
//       sinon.assert.calledOnce(stub_mapMembers);
//       // sinon.assert.calledOnce(stub_lazyLoadGuildOwner);
//       sinon.assert.calledOnce(stub_lazyLoadguileMe);
//       assert.strictEqual(g.channels, mapChannels_returns);
//       assert.strictEqual(g.roles, mapRoles_returns);
//       assert.strictEqual(g.presences, mapPresences_returns);
//       // assert.strictEqual(g.members, mapMembers_returns);
//     });
//     it("...", () => {
//       const guildData = {};

//       g.me = null;

//       g.constructGuildFromData(guildData, c);

//       sinon.assert.notCalled(stub_lazyLoadguileMe);
//     });
//   });

//   describe("upsertChannel", () => {
//     it(".", () => {
//       const stub_timestampFromSnowflake = sinon
//         .stub(Util, "timestampFromSnowflake")
//         .returns(0);
//       const channels = new Map();
//       const channel = { id: "1234567890987654231" };

//       Guild.upsertChannel(channels, channel);

//       sinon.assert.calledOnce(stub_timestampFromSnowflake);
//       assert.strictEqual(channels.size, 1);
//       assert.deepStrictEqual(channels.get("1234567890987654231"), channel);
//       assert.strictEqual(channels.get("1234567890987654231").created_on, 0);
//     });
//   });

//   describe("mapChannels", () => {
//     let sub_upsertChannel;

//     beforeEach(() => {
//       sub_upsertChannel = sinon.stub(Guild, "upsertChannel");
//     });

//     it(".", () => {
//       const got = Guild.mapChannels([]);

//       const exp = new Map();

//       sinon.assert.notCalled(sub_upsertChannel);
//       assert.deepStrictEqual(got, exp);
//     });
//     it("..", () => {
//       const channel = {};

//       const got = Guild.mapChannels([channel]);
//       const exp = new Map();

//       sinon.assert.calledOnce(sub_upsertChannel);
//       assert.deepStrictEqual(got, exp);
//       assert.strictEqual(sub_upsertChannel.getCall(0).args[1], channel);
//     });
//     it("...", () => {
//       const channel1 = {};
//       const channel2 = {};

//       const got = Guild.mapChannels([channel1, channel2]);
//       const exp = new Map();

//       sinon.assert.calledTwice(sub_upsertChannel);
//       assert.deepStrictEqual(got, exp);
//       assert.strictEqual(sub_upsertChannel.getCall(0).args[1], channel1);
//       assert.strictEqual(sub_upsertChannel.getCall(1).args[1], channel2);
//     });
//   });

//   describe("upsertRole", () => {
//     it(".", () => {
//       const stub_timestampFromSnowflake = sinon
//         .stub(Util, "timestampFromSnowflake")
//         .returns(0);
//       const roles = new Map();
//       const role = { id: "1234567890987654231" };

//       Guild.upsertRole(roles, role);

//       sinon.assert.calledOnce(stub_timestampFromSnowflake);
//       assert.strictEqual(roles.size, 1);
//       assert.deepStrictEqual(roles.get("1234567890987654231"), role);
//       assert.strictEqual(roles.get("1234567890987654231").created_on, 0);
//     });
//   });

//   describe("mapRoles", () => {
//     let sub_upsertRole;

//     beforeEach(() => {
//       sub_upsertRole = sinon.stub(Guild, "upsertRole");
//     });

//     it(".", () => {
//       const got = Guild.mapRoles([]);
//       const exp = new Map();

//       sinon.assert.notCalled(sub_upsertRole);
//       assert.deepStrictEqual(got, exp);
//     });
//     it("..", () => {
//       const role = {};
//       const got = Guild.mapRoles([role]);
//       const exp = new Map();

//       sinon.assert.calledOnce(sub_upsertRole);
//       assert.deepStrictEqual(got, exp);
//       assert.strictEqual(sub_upsertRole.getCall(0).args[1], role);
//     });
//     it("...", () => {
//       const role1 = {};
//       const role2 = {};

//       const got = Guild.mapRoles([role1, role2]);
//       const exp = new Map();

//       sinon.assert.calledTwice(sub_upsertRole);
//       assert.deepStrictEqual(got, exp);
//       assert.strictEqual(sub_upsertRole.getCall(0).args[1], role1);
//       assert.strictEqual(sub_upsertRole.getCall(1).args[1], role2);
//     });
//   });

//   describe("upsertMember", () => {
//     let stub_client_upsertUser;

//     beforeEach(() => {
//       stub_client_upsertUser = sinon.stub(c, "upsertUser");
//     });

//     it(".", () => {
//       const cachedUser = { id: "abc" };
//       stub_client_upsertUser.returns(cachedUser);
//       const cachedMember = {};

//       g.members.set("abc", cachedMember);

//       const member = { user: { id: "abc" } };

//       g.upsertMember(member, c);

//       assert.strictEqual(member.user, cachedUser);
//       assert.strictEqual(g.members.size, 1);
//       assert.strictEqual(g.members.get("abc"), cachedMember);
//     });
//     it("..", () => {
//       const cachedUser = { id: "abc" };
//       stub_client_upsertUser.returns(cachedUser);
//       const cachedMember = {};

//       const member = { user: { id: "abc" } };

//       g.upsertMember(member, c);

//       assert.strictEqual(member.user, cachedUser);
//       assert.strictEqual(g.members.size, 1);
//       assert.notStrictEqual(g.members.get("abc"), cachedMember);
//       assert.deepStrictEqual(g.members.get("abc"), { ...member });
//     });
//   });

//   describe("mapMembers", () => {
//     it(".", () => {
//       const sub_upsertMember = sinon.stub(g, "upsertMember");
//       const members = [{}];

//       Guild.mapMembers(members, g, c);

//       sinon.assert.calledOnce(sub_upsertMember);
//     });
//   });

//   describe("mapPresences", () => {
//     let stub_paracord_updatePresences;

//     beforeEach(() => {
//       stub_paracord_updatePresences = sinon.stub(c, "updatePresences");
//     });

//     it(".", () => {
//       const presences = [];

//       const got = Guild.mapPresences(presences, c);
//       const exp = new Map();

//       sinon.assert.notCalled(stub_paracord_updatePresences);
//       assert.deepStrictEqual(got, exp);
//     });
//     it("..", () => {
//       const presence = { user: { id: "123" } };
//       stub_paracord_updatePresences.returns(presence);
//       const presences = [{}];

//       const got = Guild.mapPresences(presences, c);

//       sinon.assert.calledOnce(stub_paracord_updatePresences);
//       assert.deepStrictEqual(got.size, 1);
//       assert.deepStrictEqual(got.get("123"), presence);
//     });
//   });
// });
