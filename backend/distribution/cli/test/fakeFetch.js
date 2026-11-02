'use strict';
// Preloaded with `node --require` by cliHarness.js: replaces globalThis.fetch so a CLI can never reach Resend. Not a test file.
//   FAKE_FETCH_LOG   path of the request log (JSON lines: url, method, headers, parsed body)
//   FAKE_FETCH_STATUS  HTTP status to answer (default 200)
const fs = require('node:fs');

globalThis.fetch = async (url, opts = {}) => {
  fs.appendFileSync(process.env.FAKE_FETCH_LOG, `${JSON.stringify({ url, method: opts.method, headers: opts.headers, body: JSON.parse(opts.body || 'null') })}\n`);
  const status = Number(process.env.FAKE_FETCH_STATUS || 200);
  const ok = status >= 200 && status < 300;
  return { ok, status, text: async () => JSON.stringify(ok ? { id: 'em_fake_1' } : { message: 'fake failure' }) };
};
