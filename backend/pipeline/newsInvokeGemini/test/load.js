'use strict';
// Loads src/index.js without the AWS SDK (the Lambda runtime provides it; dev machines do not have it).
// `env` becomes process.env of the loaded module; `overrides` replaces modules by name (e.g. './_shared/llm').
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createRequire } = require('node:module');

const INDEX = path.join(__dirname, '..', 'src', 'index.js');

function loadIndex({ env = {}, overrides = {}, now } = {}) {
  const real = createRequire(INDEX);
  const sdk = (n) => {
    if (n === '@aws-sdk/client-dynamodb') return { DynamoDBClient: class {} };
    if (n === '@aws-sdk/lib-dynamodb') {
      return { DynamoDBDocumentClient: { from: () => ({ send: async () => ({}) }) }, GetCommand: class { constructor(i) { this.input = i; } }, PutCommand: class { constructor(i) { this.input = i; } } };
    }
    if (n === '@aws-sdk/client-s3') return { S3Client: class { async send() { return {}; } }, GetObjectCommand: class { constructor(i) { this.input = i; } }, PutObjectCommand: class { constructor(i) { this.input = i; } } };
    return null;
  };
  const context = {
    exports: {}, process: { env }, console, Date: now ? class extends Date { constructor(...a) { super(...(a.length ? a : [now])); } static now() { return new Date(now).getTime(); } } : Date,
    setTimeout, clearTimeout, URL, AbortController, fetch: (...a) => (overrides.fetch || globalThis.fetch)(...a),
    require: (n) => (n in overrides ? overrides[n] : (sdk(n) || real(n))),
  };
  vm.runInNewContext(fs.readFileSync(INDEX, 'utf8'), context);
  return context.exports;
}

module.exports = { loadIndex };
