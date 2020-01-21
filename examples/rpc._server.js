"use strict";
const { Server } = require("../../index");
const { EventEmitter } = require("events");

const logEmitter = new EventEmitter();
logEmitter.on("DEBUG", event => console.log(event));

const serverOptions = { emitter: logEmitter };
/*
    const serverOptions = { 
        emitter: logEmitter,
        host: "127.0.0.1",
        port: "50051"
    };
*/

/* Provides logging output for a resultant api client. */
const apiOptions = { emitter: logEmitter };
const token = "myBotToken";

const server = new Server(serverOptions);

/* Add whichever services this server should handle. */
server.addRequestService(token, apiOptions); // Sends requests on behalf of the client.
server.addRateLimitService(token, apiOptions); // Caches rate limits and authorizes requests.
server.addLockService(); // Provides mutexes for gateway clients sending `identify` payloads.

/* Begin serving the request. */
server.serve();
