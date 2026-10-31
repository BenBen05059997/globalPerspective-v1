'use strict';
// A test helper for the Lambdas that read the record behind RECORD_READS (decision 0054): the AWS SDK is replaced, a module is loaded fresh with the
// environment the test wants, DynamoDB commands go to `ddb(input, commandName)` (return the raw response, e.g. {Item}) and S3 GetObject to the `files` map
// (key -> object; a missing key answers NoSuchKey, as S3 does). Every read is logged in `reads` ('ddb:<key>' / 's3:<key>').
const Module = require('node:module');

function stubAws({ ddb = () => { throw new Error('unexpected DynamoDB read'); }, files = {}, modules = {} } = {}) {
  const reads = [];
  const original = Module._load;
  const describe = (input) => (input.Key ? JSON.stringify(input.Key) : input.TableName || '');
  Module._load = function load(name, ...args) {
    if (Object.prototype.hasOwnProperty.call(modules, name)) return modules[name]; // e.g. a native module the Lambda needs only to post
    if (name === '@aws-sdk/client-s3') {
      class GetObjectCommand { constructor(input) { this.input = input; } }
      class S3Client {
        async send(cmd) {
          reads.push(`s3:${cmd.input.Key}`);
          const v = files[cmd.input.Key];
          if (v === undefined) { const e = new Error('NoSuchKey'); e.name = 'NoSuchKey'; throw e; }
          return { Body: { transformToString: async () => JSON.stringify(v) } };
        }
      }
      return { S3Client, GetObjectCommand, PutObjectCommand: class {} };
    }
    if (name.startsWith('@aws-sdk/')) {
      return new Proxy({}, {
        get: (_, key) => {
          if (key === 'DynamoDBDocumentClient') return { from: () => ({ send: async (cmd) => { reads.push(`ddb:${describe(cmd.input)}`); return ddb(cmd.input, cmd.constructor.name); } }) };
          return { [key]: class { constructor(input) { this.input = input; } } }[key]; // named after the command, so ddb() can tell GetCommand from ScanCommand
        },
      });
    }
    return original.call(this, name, ...args);
  };
  return {
    reads, files,
    /** Load `file` (an absolute path) fresh with these environment variables (undefined deletes one). */
    load(file, env = {}) {
      for (const [k, v] of Object.entries(env)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
      delete require.cache[require.resolve(file)];
      return require(file);
    },
    restore() { Module._load = original; },
  };
}

const hoursAgo = (h, now = Date.now()) => new Date(now - h * 3600000).toISOString();
/** The manifest every fresh-view read needs. */
const freshManifest = (h = 1) => ({ 'record/views/manifest.json': { builtAt: hoursAgo(h) } });

module.exports = { stubAws, hoursAgo, freshManifest };
