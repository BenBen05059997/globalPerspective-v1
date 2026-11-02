#!/usr/bin/env node
'use strict';
// A stand-in for the `aws` executable, put first on PATH by cliHarness.js. Not a test file.
// It answers the few DynamoDB calls the operator CLIs make, from a JSON state file, and logs every call (argv, and for put-item the
// item read from the file:// argument at call time) to a JSON-lines file. It never touches the network.
//   FAKE_AWS_STATE  path to { items: [<DynamoDB-JSON item>], pageSize?: number }
//   FAKE_AWS_LOG    path of the call log (JSON lines)
//   FAKE_AWS_FAIL   a sub-command name (e.g. put-item): that call prints an error and exits 1
const fs = require('node:fs');

const argv = process.argv.slice(2);
const [service, op] = argv;
const flags = {};
for (let i = 2; i < argv.length; i += 1) {
  if (argv[i].startsWith('--')) { flags[argv[i].slice(2)] = argv[i + 1]; i += 1; }
}
const state = JSON.parse(fs.readFileSync(process.env.FAKE_AWS_STATE, 'utf8'));
const log = (entry) => fs.appendFileSync(process.env.FAKE_AWS_LOG, `${JSON.stringify({ service, op, argv, ...entry })}\n`);

if (process.env.FAKE_AWS_FAIL === op) {
  log({ failed: true });
  console.error(`An error occurred (AccessDeniedException) when calling the ${op} operation`);
  process.exit(1);
}

if (service !== 'dynamodb') { log({ unexpected: true }); console.error(`fake aws: unexpected service ${service}`); process.exit(2); }

if (op === 'scan') {
  // Apply the filter the caller asked for: status IN every :value in --expression-attribute-values.
  const wanted = Object.values(JSON.parse(flags['expression-attribute-values'] || '{}')).map((v) => v.S);
  // ...and, when the filter says attribute_not_exists(confirmedAt), only rows without a confirmedAt.
  const needsNoConfirmedAt = /attribute_not_exists\(confirmedAt\)/.test(flags['filter-expression'] || '');
  const all = state.items.filter((it) => wanted.includes(it.status && it.status.S) && !(needsNoConfirmedAt && it.confirmedAt));
  const pageSize = state.pageSize || all.length || 1;
  const offset = Number(flags['starting-token'] || 0);
  const page = all.slice(offset, offset + pageSize);
  const out = { Items: page, Count: page.length };
  if (offset + pageSize < all.length) out.NextToken = String(offset + pageSize);
  log({ flags });
  process.stdout.write(JSON.stringify(out));
} else if (op === 'put-item') {
  const file = String(flags.item || '').replace(/^file:\/\//, '');
  const item = JSON.parse(fs.readFileSync(file, 'utf8'));
  log({ flags, itemFile: file, item });
  state.items = state.items.filter((it) => it.alertKey.S !== item.alertKey.S).concat([item]);
  fs.writeFileSync(process.env.FAKE_AWS_STATE, JSON.stringify(state));
  process.stdout.write('');
} else if (op === 'get-item') {
  const key = JSON.parse(flags.key).alertKey.S;
  const item = state.items.find((it) => it.alertKey.S === key);
  log({ flags });
  process.stdout.write(JSON.stringify(item ? { Item: item } : {}));
} else if (op === 'update-item') {
  const key = JSON.parse(flags.key).alertKey.S;
  const names = JSON.parse(flags['expression-attribute-names'] || '{}');
  const values = JSON.parse(flags['expression-attribute-values'] || '{}');
  log({ flags, key, names, values });
  process.stdout.write('');
} else {
  log({ unexpected: true });
  console.error(`fake aws: unexpected operation ${op}`);
  process.exit(2);
}
