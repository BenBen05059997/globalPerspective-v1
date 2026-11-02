'use strict';
// Drives the operator CLIs (backend/distribution/cli/breaking/*.js) as real child processes, offline: a fake `aws` is first on PATH and
// (for send.js) a preloaded fake fetch replaces the network. The CLIs run main() at load time and shell out, so a black-box run is the
// only way to test them without editing them. Not a test file (`node --test` runs *.test.js only).
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI = path.resolve(__dirname, '../breaking');
const FAKE_AWS = path.join(__dirname, 'fakeAws.js');
const FAKE_FETCH = path.join(__dirname, 'fakeFetch.js');
const PROMPT = /(q=quit > |Enter to skip\):\n> )/g;

/** Plain value -> DynamoDB JSON (independent of the CLI's own marshal, so a bug there shows up). */
function marshal(v) {
  if (v === null || v === undefined) return { NULL: true };
  if (typeof v === 'string') return { S: v };
  if (typeof v === 'number') return { N: String(v) };
  if (typeof v === 'boolean') return { BOOL: v };
  if (Array.isArray(v)) return { L: v.map(marshal) };
  return { M: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, marshal(x)])) };
}
function unmarshal(av) {
  if ('S' in av) return av.S;
  if ('N' in av) return Number(av.N);
  if ('BOOL' in av) return av.BOOL;
  if ('NULL' in av) return null;
  if ('L' in av) return av.L.map(unmarshal);
  if ('M' in av) return Object.fromEntries(Object.entries(av.M).map(([k, x]) => [k, unmarshal(x)]));
  throw new Error('unknown attribute');
}
const row = (plain) => marshal(plain).M;

/**
 * Run `node <cli> ...args` with the fake aws on PATH.
 * @param {string} cli  file name under cli/breaking
 * @param {object} o    items: plain alert rows the fake table holds; answers: lines typed at the prompts (one per prompt, sent when the
 *                      prompt appears); pageSize; env; fail (aws op that errors); fetchStatus; fetch: true to preload the fake fetch
 * @returns {Promise<{code, stdout, stderr, awsCalls, fetchCalls, table: plain rows after the run, prompts}>}
 */
async function run(cli, { args = [], items = [], answers = [], pageSize, env = {}, fail, fetch = false, fetchStatus } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gp-cli-test-'));
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'aws'), `#!/bin/sh\nexec "${process.execPath}" "${FAKE_AWS}" "$@"\n`, { mode: 0o755 });
  const statePath = path.join(dir, 'state.json');
  const awsLog = path.join(dir, 'aws.log');
  const fetchLog = path.join(dir, 'fetch.log');
  fs.writeFileSync(statePath, JSON.stringify({ items: items.map(row), pageSize }));
  fs.writeFileSync(awsLog, '');
  fs.writeFileSync(fetchLog, '');

  const childEnv = {
    PATH: `${bin}${path.delimiter}${process.env.PATH}`,
    HOME: dir, TMPDIR: dir,
    FAKE_AWS_STATE: statePath, FAKE_AWS_LOG: awsLog, FAKE_FETCH_LOG: fetchLog,
    ...(fail ? { FAKE_AWS_FAIL: fail } : {}),
    ...(fetchStatus ? { FAKE_FETCH_STATUS: String(fetchStatus) } : {}),
    ...env,
  };
  const nodeArgs = [...(fetch ? ['--require', FAKE_FETCH] : []), path.join(CLI, cli), ...args];
  const child = spawn(process.execPath, nodeArgs, { cwd: dir, env: childEnv, stdio: ['pipe', 'pipe', 'pipe'] });

  let stdout = '';
  let stderr = '';
  let answered = 0;
  let prompts = 0;
  child.stderr.on('data', (d) => { stderr += d; });
  child.stdout.on('data', (d) => {
    stdout += d;
    const seen = (stdout.match(PROMPT) || []).length;
    while (prompts < seen) {
      prompts += 1;
      // readline drops lines typed before a question is pending, so each answer goes out only once its prompt has been printed.
      if (answered < answers.length) child.stdin.write(`${answers[answered++]}\n`);
      else child.stdin.end(); // the operator closed the terminal
    }
  });

  const code = await new Promise((resolve) => {
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolve('timeout'); }, 20000);
    child.on('close', (c) => { clearTimeout(timer); resolve(c); });
    if (cli.startsWith('send')) child.stdin.end();
  });

  const lines = (f) => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const result = {
    code, stdout, stderr, prompts,
    awsCalls: lines(awsLog),
    fetchCalls: lines(fetchLog),
    table: JSON.parse(fs.readFileSync(statePath, 'utf8')).items.map((it) => unmarshal({ M: it })),
    leftoverFiles: fs.readdirSync(dir).filter((f) => f.startsWith('breaking-')),
  };
  fs.rmSync(dir, { recursive: true, force: true });
  return result;
}

module.exports = { run, marshal, unmarshal };
