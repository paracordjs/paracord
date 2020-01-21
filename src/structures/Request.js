"use strict";
module.exports = class Request {
  constructor(wrappedRequest, method, endpoint, data, headers, timeout) {
    // wrapped axios.request() to update the cached ratelimit if one exists
    this.wrappedRequest = wrappedRequest;
    // http request method
    this.method = method;
    // body of the request if one provided
    this.endpoint = endpoint;
    // body of the request if one provided
    this.data = data;
    // how long to allow the request (promise) to sit on the queue before rejecting
    this.headers = headers;
    this.timeout = timeout;
    // major param type, combined with bucket and major id to get specific rate limit
    this.rateLimitMajorType;
    // major param id, combined with bucket and major type to get specific rate limit
    this.rateLimitMajorID;
    // remainder of endpoint after major param has been cut out, combined with major type and id to get specific rate limit
    this.rateLimitBucketPath;
    // used to get/set rate limit bucket to the bucket path
    this.rateLimitBucketKey;
    // used to get/set specific ratelimit from cache
    this.rateLimitKey;
    // filled when request send() is called while request is in queue, resolves the promise
    this.response;
    this.wrappedRequest;
    this.method;
    this.endpoint;
    this.data;
    this.headers;
    this.timeout;
    this.splitEndpointIntoRateMeta();
    this.convertBucketPathToKey();
    this.createRateLimitKey();
  }

  splitEndpointIntoRateMeta() {
    const [rateLimitMajorType, rateLimitMajorID, ...rateLimitBucketPath] = this.endpoint.split("/");
    Object.assign(this, { rateLimitMajorType, rateLimitMajorID, rateLimitBucketPath });
  }

  convertBucketPathToKey() {
    const { method, rateLimitBucketPath } = this;

    let key = [];

    if (method === "GET") key.push("g");
    else if (method === "POST") key.push("p");
    else if (method === "PATCH") key.push("u");
    else if (method === "DELETE") key.push("d");

    for (const param of rateLimitBucketPath) {
      if (param === "members") key.push("m");
      else if (param === "guilds") key.push("gu");
      else if (param === "channels") key.push("c");
    }

    this.rateLimitBucketKey = key.join("-");
  }

  createRateLimitKey() {
    this.rateLimitKey = `${this.rateLimitMajorType}-${this.rateLimitMajorID}-${this.rateLimitBucketKey}`;
  }

  send() {
    return this.wrappedRequest(this.rateLimitBucketKey, this.rateLimitKey, {
      method: this.method,
      url: this.endpoint,
      data: this.data,
      headers: this.headers,
      validateStatus: null
    });
  }
};
