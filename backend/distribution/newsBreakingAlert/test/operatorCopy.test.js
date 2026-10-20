'use strict';
const test = require('node:test');
const assert = require('node:assert');
process.env.TOPICS_DDB_TABLE = 'T'; process.env.SUMMARIZE_PREDICT_TABLE = 'T';
const Module = require('node:module');
const orig = Module._load;
Module._load = function (req, ...r) {
  if (req.startsWith('@aws-sdk/')) return new Proxy({}, { get: () => class {} });
  return orig.call(this, req, ...r);
};
const { operatorCopy } = require('../src/index.js');
Module._load = orig;

test('operator email says the alert is not public and how to confirm', () => {
  const out = operatorCopy({ subject: 'Breaking: X', text: 'body', html: '<html><body style="m">hi</body></html>' }, 'thr-1');
  assert.match(out.subject, /^\[Unconfirmed\] Breaking: X/);
  assert.match(out.text, /NOT PUBLIC YET/);
  assert.match(out.text, /node backend\/distribution\/cli\/breaking\/review\.js/);
  assert.match(out.html, /<body style="m"><div[^>]*><strong>NOT PUBLIC YET/);
  assert.ok(out.text.endsWith('body') && out.html.includes('hi'));
});
