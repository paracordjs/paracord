'use strict';

const sinon = require('sinon');

const FAILED_TESTS = {};

// const originalLogFunction = console.log;
// let output;

beforeEach(function () {
  // output = "";
  // console.log = (...msgs) => {
  //   if (Array.isArray(msgs)) {
  //     const tmp = [];
  //     for (const msg of msgs) {
  //       if (msg === null) {
  //         tmp.push("null");
  //       } else if (msg === undefined) {
  //         tmp.push("undefined");
  //       } else {
  //         tmp.push(msg);
  //       }
  //     }

  //     output += tmp.join(" ") + "\n";
  //   } else {
  //     output += msgs === null ? "null" : msgs === undefined ? "undefined" : msgs + "\n";
  //   }
  // };

  if (FAILED_TESTS[this.currentTest.file]) {
    this.skip();
  }
});

afterEach(function () {
  // console.log = originalLogFunction; // undo dummy log function

  sinon.restore();
  if (this.currentTest.state === 'failed') {
    // console.log(output);
    FAILED_TESTS[this.currentTest.file] = true;
  }
});
