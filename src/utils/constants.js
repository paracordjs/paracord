'use strict';

const SECOND_IN_MILLISECONDS = 1e3;
const MINUTE_IN_MILLISECONDS = 60 * SECOND_IN_MILLISECONDS;

module.exports = {
  SECOND_IN_MILLISECONDS,
  MINUTE_IN_MILLISECONDS,
  GIGABYTE_IN_BYTES: 1073741824,
  /** Websocket parameters appended to the url received from Discord. */
  GATEWAY_DEFAULT_WS_PARAMS: '?v=6&encoding=json',
  /** Gateway websocket connection rate limit. */
  GATEWAY_MAX_REQUESTS_PER_MINUTE: 120,
  /** A buffer the reserves this amount of gateway requests every minute for critical tasks. */
  GATEWAY_REQUEST_BUFFER: 4,
  /** https://discordapp.com/developers/docs/topics/opcodes-and-status-codes */
  GATEWAY_OP_CODES: {
    DISPATCH: 0,
    HEARTBEAT: 1,
    IDENTIFY: 2,
    RESUME: 6,
    RECONNECT: 7,
    REQUEST_GUILD_MEMBERS: 8,
    INVALID_SESSION: 9,
    HELLO: 10,
    HEARTBEAT_ACK: 11,
  },
  /** https://discordapp.com/developers/docs/topics/opcodes-and-status-codes#gateway-gateway-close-event-codes */
  GATEWAY_CLOSE_CODES: {
    CLEAN: 1000,
    ABNORMAL_CLOSE: 1006,
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
    INVALID_VERSION: 4012,
    INVALID_INTENT: 4013,
    DISALLOWED_INTENT: 4014,
    HEARTBEAT_TIMEOUT: 4999, // Not a Discord close event

  },
  CHANNEL_TYPES: {
    GUILD_TEXT: 0,
    DM: 1,
    GUILD_VOICE: 2,
    GROUP_DM: 3,
    GUILD_CATEGORY: 4,
    GUILD_NEWS: 5,
    GUILD_STORE: 6,
  },
  DISCORD_API_URL: 'https://discordapp.com/api',
  DISCORD_API_DEFAULT_VERSION: 'v6',
  /** Discord epoch (2015-01-01T00:00:00.000Z) */
  DISCORD_EPOCH: 1420070400000,
  DISCORD_CDN_URL: 'https://cdn.discordapp.com/',
  PARACORD_SWEEP_INTERVAL: 500,
  /** A permissions map for operations relevant to the library. */
  PERMISSIONS: {
    ADMINISTRATOR: 0x8,
  },
  /** For internal logging. */
  LOG_SOURCES: {
    GATEWAY: 0,
    API: 1,
    PARACORD: 2,
    RPC: 3,
  },
  LOG_LEVELS: {
    FATAL: 0,
    ERROR: 1,
    WARNING: 2,
    INFO: 4,
    DEBUG: 5,
  },
};
