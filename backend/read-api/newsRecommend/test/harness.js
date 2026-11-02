'use strict';
// Shared setup for the newsRecommend handler tests (prefs, follow, unsubscribe, recommend): the handler is loaded fresh against a fake
// DynamoDB client that logs every command, with Google's certs served by a fake fetch (shared/test/firebaseToken.js). Not a test file itself
// (`npm test` runs ../test/*.test.js only).
const path = require('node:path');
const { stubAws } = require('../../../shared/test/stubAws');
const fb = require('../../../shared/test/firebaseToken');

const INDEX = path.resolve(__dirname, '../src/index.js');
const USERS_TABLE = 'GlobalPerspectiveUserTable'; // the Lambda's default for USERS_DDB_TABLE
const ENV = {
  USER_PREFS_TABLE: 'PrefsT', SAVED_ITEMS_TABLE: 'SavedT', TOPICS_DDB_TABLE: 'TopicsT', FIREBASE_PROJECT_ID: fb.PROJECT,
};
const UNSET = { USER_PREFS_TABLE: undefined, SAVED_ITEMS_TABLE: undefined, TOPICS_DDB_TABLE: undefined, FIREBASE_PROJECT_ID: undefined, USERS_DDB_TABLE: undefined, SITE_URL: undefined, RECORD_READS: undefined };

/**
 * const h = harness();          // h.load(env?) -> handler; h.sent = [{ name, input }]; h.respond = (name, input) => raw DynamoDB response
 * Call h.stop() in afterEach.
 */
function harness() {
  const h = { aws: null, sent: [], respond: () => ({}) };
  h.load = (env = ENV) => {
    if (h.aws) h.aws.restore();
    h.sent = [];
    h.respond = () => ({});
    h.aws = stubAws({ ddb: (input, name) => { h.sent.push({ name, input }); return h.respond(name, input, input.TableName); } });
    return h.aws.load(INDEX, { ...UNSET, ...env }).handler;
  };
  h.stop = () => { if (h.aws) { h.aws.restore(); h.aws = null; } };
  /** The commands sent to one table, optionally of one kind. */
  h.to = (table, name) => h.sent.filter((s) => s.input.TableName === table && (!name || s.name === name));
  return h;
}

const authed = (claims = {}) => ({ authorization: fb.bearer({ sub: 'user-1', ...claims }) });
/** A Function-URL POST carrying { action, payload }. */
const post = (handler, action, payload, headers = authed()) => handler({
  requestContext: { http: { method: 'POST' } }, headers, body: JSON.stringify({ action, payload }),
});
/** An email-link GET (action and params in the query string). */
const get = (handler, query, headers = {}) => handler({ requestContext: { http: { method: 'GET' } }, headers, queryStringParameters: query });
const json = (res) => JSON.parse(res.body);
const noCors = (res) => {
  const bad = Object.keys(res.headers).filter((k) => /^access-control-/i.test(k));
  if (bad.length) throw new Error(`unexpected CORS header(s): ${bad.join(', ')}`);
};

module.exports = { harness, authed, post, get, json, noCors, USERS_TABLE, ENV, fb };
