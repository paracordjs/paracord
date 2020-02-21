"use strict";
const SECONDINMILLISECONDS = 1e3;
const MINUTEINMILLISECONDS = 60 * SECONDINMILLISECONDS;

module.exports = {
  SECONDINMILLISECONDS,
  MINUTEINMILLISECONDS,
  GIGABYTEINBYTES: 1073741824,
  /** Websocket parameters appended to the url received from Discord. */
  GATEWAYDEFAULTWSPARAMS: "?v=6&encoding=json",
  /** Gateway websocket connection rate limit. */
  GATEWAYMAXREQUESTSPERMINUTE: 120,
  /** A buffer the reserves this amount of gateway requests every minute for critical tasks. */
  GATEWAYREQUESTBUFFER: 4,
  /** https://discordapp.com/developers/docs/topics/opcodes-and-status-codes */
  GATEWAYOPCODES: {
    DISPATCH: 0,
    HEARTBEAT: 1,
    IDENTIFY: 2,
    RESUME: 6,
    RECONNECT: 7,
    REQUEST_GUILD_MEMBERS: 8,
    INVALID_SESSION: 9,
    HELLO: 10,
    HEARTBEAT_ACK: 11
  },
  /** https://discordapp.com/developers/docs/topics/opcodes-and-status-codes#gateway-gateway-close-event-codes */
  GATEWAYCLOSECODE: {
    CLEAN: 1000,
    CLOSED_BY_PEER: 1006,
    UNKNOWN_ERROR: 4000,
    UNKNOWN_OPCODE: 4001,
    DECODE_ERROR: 4002,
    NOT_AUTHENTICATED: 4003,
    AUTHENTICATION_FAILED: 4004,
    ALREADY_AUTHENTICATED: 4005,
    SESSION_NO_LONGER_VALID: 4006,
    INVALID_SEQ: 4007,
    RATE_LIMITED: 4008,
    SESSION_TIMEOUT: 4009,
    INVALID_SHARD: 4010,
    SHARDING_REQUIRED: 4011,
    MISSED_HEARTBEAT: 4100 // Not a Discord close event
  },
  CHANNELTYPE: {
    GUILD_TEXT: 0,
    DM: 1,
    GUILD_VOICE: 2,
    GROUP_DM: 3,
    GUILD_CATEGORY: 4,
    GUILD_NEWS: 5,
    GUILD_STORE: 6
  },
  DISCORDAPIURL: "https://discordapp.com/api",
  DISCORDAPIDEFAULTVERSION: "v6",
  /** Discord epoch (2015-01-01T00:00:00.000Z) */
  DISCORDEPOCH: 1420070400000,
  DISCORDIMAGEBASEURL: "https://cdn.discordapp.com/",
  PARACORDUPDATEUSERWAITMILLISECONDS: 500,
  /** A permissions map for operations relevant to the library. */
  PERMISSIONS: {
    ADMINISTRATOR: 0x8
  },
  /** For internal logging. */
  LOGSOURCE: {
    GATEWAY: 0,
    API: 1,
    PARACORD: 2,
    RPC: 3
  },
  LOGLEVEL: {
    FATAL: 0,
    ERROR: 1,
    WARNING: 2,
    INFO: 4,
    DEBUG: 5
  }
};
