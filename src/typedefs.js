/** @typedef {import("./clients/Api")} Api */

/** @typedef {import("./clients/Gateway")} Gateway */

/** @typedef {import("./clients/Paracord")} Paracord */

/** @typedef {import("./rpc/services/request/RequestService")} RequestService */

/** @typedef {import("./rpc/services/identifyLock/IdentifyLockService")} IdentifyLockService */

/** @typedef {import("./clients/Api/structures/RateLimit")} RateLimit */

/** @typedef {import("./clients/Api/structures/RateLimitCache")} RateLimitCache */

/** @typedef {import("./clients/Api/structures/RateLimitMap")} RateLimitMap */

/** @typedef {import("./clients/Api/structures/Request")} Request */

/** @typedef {import("./clients/Api/structures/RequestQueue")} RequestQueue */

/** @typedef {import("./clients/Paracord/structures/Guild")} Guild */

/** @typedef {import("./rpc/structures/identityLock/Lock")} Lock */

/** @typedef {import("./rpc/server/Server")} Server */

/** @typedef {import("./clients/Api/structures/BaseRequest"} BaseRequest */

/** @typedef {import("./rpc/structures/rateLimit/RequestMetaMessage")} RequestMetaMessage */

/** @typedef {import("./clients/Api/structures/RateLimitHeaders")} RateLimitHeaders */

// API

/**
 * @typedef ApiOptions Optional parameters for this api handler.
 *
 * @property {import("events").EventEmitter} [emitter] Event emitter through which to emit debug and warning events.
 */

/**
 * @typedef RateLimitState The known state of a rate limit.
 * @property {number} remaining Number of requests available before hitting rate limit.
 * @property {number} limit From Discord - rate limit request cap.
 * @property {number|void} resetTimestamp When the rate limit requests remaining rests to `limit`.
 */

/**
 * @typedef ResponseHeaders Rate limit state with the bucket id. TODO(lando): add docs link
 * @property {string} bucket From Discord - the id of the rate limit bucket.
 * @property {RateLimitState} state
 */

/**
 * @callback WrappedRequest A `request` method of an axios instance
 * wrapped to decrement the associated rate limit cached state if one exists.
 *
 * @param {Request} request Data for axios' request method.
 * @returns {*} Response from Discord.
 */

/**
 * @typedef RequestOptions Optional parameters for a Discord REST request.
 *
 * @property {*} data Data to send in the body of the request.
 * @property {Object<string, any>} headers Headers to send with the request.
 */

// Gateway

/**
 * @typedef GatewayOptions Optional parameters for this gateway handler.
 *
 * @property {Object<string, any>} [identity] An object containing information for identifying with the gateway. `shard` property will be overwritten when using Paracord's Shard Launcher. https://discordapp.com/developers/docs/topics/gateway#identify-identify-structure
 * @property {import("events").EventEmitter} [emitter] Emitter through which Discord gateway events are sent.
 * @property {Object<string, string>} [events] Key:Value mapping DISCORD_EVENT to user's preferred emitted name.
 * @property {RequestService|Api} [api]
 */

/** @typedef {import("./clients/Gateway/structures/Identity")} Identity */

/** @typedef {[number, number]} Shard [ShardID, ShardCount] to identify with. https://discordapp.com/developers/docs/topics/gateway#identify-identify-structure */

/**
  * @typedef GatewayLockServerOptions
  *
  * @property  {void|ServerOptions} mainServerOptions Options for connecting this service to the identifylock server. Will not be released except by time out. Best used for global minimum wait time. Pass `null` to ignore.
   * @property  {ServerOptions} [serverOptions] Options for connecting this service to the identifylock server. Will be acquired and released in order.
  */

// Paracord

/**
 * @typedef ParacordOptions Optional parameters for this Paracord client.
 *
 * @property {Object<string, string>} [events] Key:Value mapping DISCORD_EVENT to user's preferred emitted name.
 * @property {ApiOptions} [apiOptions]
 * @property {GatewayOptions} [gatewayOptions]
 */

/**
 * @typedef ParacordLoginOptions Optional parameters for Paracord's login method.
 *
 * @param {Object<string, any>} [identity] An object containing information for identifying with the gateway. https://discordapp.com/developers/docs/topics/gateway#identify-identify-structure
 * @property {number[]} [shards] Shards to spawn internally.
 * @property {number} [shardCount] The total number of shards that will be handled by the bot.
 * @property {boolean} [allowEventsDuringStartup=false] During startup, if events should be emitted before `PARACORD_STARTUP_COMPLETE` is emitted. `GUILD_CREATE` events will never be emitted during start up.
 */

// Shard Launcher

/**
 * @typedef ShardLauncherOptions
 * @property {string} [token] Discord token. Used to find recommended shard count when no `shardIds` provided. Will be coerced into a bot token.
 * @property {InternalShardIds} [shardIds] Ids of the shards to start internally. Ignored if `shardChunks` is defined.
 * @property {InternalShardIds[]} [shardChunks] Arrays of shard Ids to launch. Each item will spawn a pm2 process with the designated shards internally.
 * @property {number} [shardCount] Total number of shards this app will be running across all instances.
 * @property {string} [appName] Name that will appear beside the shard number in pm2.
 * @property {Object<string, any>} [env] Additional environment variables to load into the app.
 */

/** @typedef {number[]} InternalShardIds Shard Ids designated to be spawned internally. */

// Misc

/**
 * @typedef ServerOptions
 *
 * @property {string} [host]
 * @property {number|string} [port]
 */

/**
 * @typedef ApiResponse Subset of response data after making a request with the Api handler.
 *
 * @property {number} status The HTTP status code of the response.
 * @property {string} statusText Status message returned by the server. (e.g. "OK" with a 200 status)
 * @property {*} data The data returned by Discord.
 */

/**
 * @typedef RpcServerOptions
 *
 * @property {string} [host]
 * @property {string|number} [port]
 * @property {import("events").EventEmitter} [emitter]
 * @property {RpcServerBindArgs} [bindArgs]
 */

/**
 * @typedef RpcServerBindArgs
 *
 * @property {string|number} port
 * @property {import("@grpc/grpc-js").ServerCredentials} creds
 * @property {Function} callback
 */

/**
 * @typedef ServiceOptions
 *
 * @property {string} [host]
 * @property {string|number} [port]
 * @property {import("@grpc/grpc-js").ChannelCredentials} [channel]
 */

/**
 * @typedef StatusMessage
 *
 * @property {boolean} success true, the operation was a success; false, the operation failed.
 * @property {string} message Reason for the failed operation.
 * @property {string} token Unique ID given to the last client to acquire the lock.
 */

/**
 * @typedef LockRequestProto
 *
 * @property {number} time_out How long in ms the server should wait before expiring the lock.
 * @property {string} token Unique ID given to the last client to acquire the lock.
 */

/**
 * @typedef TokenProto
 *
 * @property {string} value The string value of the token.
 */

/**
 * @typedef StatusProto
 *
 * @property {boolean} success Whether or not the operation was successful.
 * @property {string|void} [message] Reason why the operation failed.
 * @property {string|void} token Unique ID given to the last client to acquire the lock.
 */

/**
 * @typedef RequestProto
 *
 * @property {string} method HTTP method of the request.
 * @property {string} url Discord endpoint url. (e.g. channels/123)
 * @property {string} [data] JSON encoded data to send in the body of the request.
 * @property {string} [headers] JSON encoded headers to send with the request.
 */

/**
 * @typedef ResponseProto
 *
 * @property {string} status_code The HTTP status code of the response.
 * @property {string} status_text Status message returned by the server. (e.g. "OK" with a 200 status)
 * @property {string} data JSON encoded data returned by Discord.
 */

/**
 * @typedef RequestMetaProto
 *
 * @property {string} method HTTP method of the request.
 * @property {string} url Discord endpoint url. (e.g. channels/123)
 */

/**
 * @typedef AuthorizationProto
 *
 * @property {number} reset_after How long the client should wait in ms before asking to authorize the request again, if at all.
 */

/**
 * @typedef RateLimitStateProto
 *
 * @property {string} bucket From Discord - the id of the rate limit bucket.
 * @property {number} remaining From Discord - number of requests available before hitting rate limit.
 * @property {number} limit From Discord - rate limit request cap.
 * @property {number|void} reset_timestamp When the rate limit requests remaining rests to `limit`.
 */
