#!/usr/bin/env node
/**
 * scripts/share-admin.mjs — operator tool for Analysis Studio shares (Batch 4 phase G).
 * Account deletion is a manual email process (Account.jsx), so a person's shares must be findable and removable.
 * READ-ONLY by default: nothing is deleted without --commit.
 *
 *   node scripts/share-admin.mjs --uid <firebase uid>                 list that person's shares (id, created)
 *   node scripts/share-admin.mjs --uid <firebase uid> --delete         show what WOULD be deleted (dry run)
 *   node scripts/share-admin.mjs --uid <firebase uid> --delete --commit   hard-delete them
 *   node scripts/share-admin.mjs --id <share id> --delete [--commit]   the same for one share
 *
 * Uses the AWS CLI with your credentials (table GlobalPerspectiveShares, GSI uid-createdAt-index, ap-northeast-1).
 * The table and index must exist first (phase G, gate Y1); until then every call reports "table not found".
 */
import { execFileSync } from 'node:child_process';

const TABLE = 'GlobalPerspectiveShares';
const INDEX = 'uid-createdAt-index';
const REGION = 'ap-northeast-1';
const ID_RE = /^[A-Za-z0-9_-]{22}$/;

const args = process.argv.slice(2);
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const has = (n) => args.includes(n);
const aws = (a) => JSON.parse(execFileSync('aws', [...a, '--region', REGION, '--output', 'json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }) || '{}');

// exported for tests
export function listArgs(uid) {
  return ['dynamodb', 'query', '--table-name', TABLE, '--index-name', INDEX,
    '--key-condition-expression', 'uid = :u', '--expression-attribute-values', JSON.stringify({ ':u': { S: uid } })];
}
export function deleteArgs(id) {
  return ['dynamodb', 'delete-item', '--table-name', TABLE, '--key', JSON.stringify({ id: { S: id } })];
}

function main() {
  const uid = arg('--uid');
  const id = arg('--id');
  if (!uid && !id) { console.error('usage: share-admin.mjs --uid <uid> | --id <id>  [--delete [--commit]]'); process.exit(2); }
  let ids = [];
  if (id) {
    if (!ID_RE.test(id)) { console.error('not a share id'); process.exit(2); }
    ids = [{ id, createdAt: null }];
  } else {
    const r = aws(listArgs(uid));
    ids = (r.Items || []).map((i) => ({ id: i.id.S, createdAt: i.createdAt && i.createdAt.S }));
    console.log(`${ids.length} share${ids.length === 1 ? '' : 's'} for that uid`);
  }
  for (const s of ids) console.log(`  ${s.id}${s.createdAt ? `  ${s.createdAt}` : ''}  https://globalperspective.net/analyze/s/${s.id}`);
  if (!has('--delete')) return;
  if (!has('--commit')) { console.log(`\nDRY RUN: would delete ${ids.length}. Add --commit to delete.`); return; }
  for (const s of ids) { aws(deleteArgs(s.id)); console.log(`deleted ${s.id}`); }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) main();
