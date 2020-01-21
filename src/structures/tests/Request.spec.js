"use strict";
const assert = require("assert");
const sinon = require("sinon");
const Request = require("../Request");
const { DISCORDURI } = require("../../util/constants");

describe("Requests", () => {
  describe("splitEndpointIntoRateMeta", () => {
    it("...", () => {
      {
        const endpoint = "channels/abc123/messages/def456";
        const data = {};
        const timeout = 1;

        const r = new Request({}, null, endpoint);

        assert.strictEqual(r.rateLimitMajorType, "channels");
        assert.strictEqual(r.rateLimitMajorID, "abc123");
        assert.deepStrictEqual(r.rateLimitBucketPath, ["messages", "def456"]);
      }
      {
        const endpoint = "channels/abc123/messages/def456";
        const data = {};
        const timeout = 1;

        const r = new Request({}, null, endpoint);

        assert.strictEqual(r.rateLimitMajorType, "channels");
        assert.strictEqual(r.rateLimitMajorID, "abc123");
        assert.deepStrictEqual(r.rateLimitBucketPath, ["messages", "def456"]);
      }
    });
    it("...", () => {
      {
        const method = "GET";
        const endpoint = "channels/abc123/members/def456";
        const data = {};
        const timeout = 1;

        const r = new Request({}, method, endpoint);

        assert.strictEqual(r.rateLimitBucketKey, "g-m");
      }
      {
        const method = "POST";
        const endpoint = "channels/abc123/guilds/def456";
        const data = {};
        const timeout = 1;

        const r = new Request({}, method, endpoint);

        assert.strictEqual(r.rateLimitBucketKey, "p-gu");
      }
      {
        const method = "PATCH";
        const endpoint = "guilds/abc123/channels/def456";
        const data = {};
        const timeout = 1;

        const r = new Request({}, method, endpoint);

        assert.strictEqual(r.rateLimitBucketKey, "u-c");
      }
      {
        const method = "DELETE";
        const endpoint = "channels/abc123/members/def456";
        const data = {};
        const timeout = 1;

        const r = new Request({}, method, endpoint);

        assert.strictEqual(r.rateLimitBucketKey, "d-m");
      }
    });
  });

  describe("createRateLimitKey", () => {
    {
      const method = "DELETE";
      const endpoint = "channels/abc123/members/def456";
      const data = {};
      const timeout = 1;

      const r = new Request({}, method, endpoint);

      assert.strictEqual(r.rateLimitKey, `${r.rateLimitMajorType}-${r.rateLimitMajorID}-${r.rateLimitBucketKey}`);
    }
  });

  //   describe("send", () => {
  //     let got;
  //     const fake_wrappedRequest = sinon.fake(() => {
  //       got = arguments;
  //     });

  //     const method = "meth";
  //     const endpoint = "/some/endpoint";
  //     const data = {};
  //     const timeout = 1;

  //     const r = new Request(fake_wrappedRequest, method, endpoint, data, timeout);
  //     r.send();

  //     const exp = [
  //       {
  //         method,
  //         url: `${DISCORDURI}/${endpoint}`,
  //         data,
  //         validateStatus: null
  //       }
  //     ];

  //     sinon.assert.calledOnce(fake_wrappedRequest);
  //     assert.deepStrictEqual(got, exp);
  //   });
});
