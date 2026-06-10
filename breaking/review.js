#!/usr/bin/env node
'use strict';

/**
 * breaking/review.js — human confirmation queue for breaking-news alerts.
 *
 * The newsBreakingAlert Lambda detects a significant story each cycle and writes a
 * `status: 'proposed'` row to GlobalPerspectiveBreakingAlerts. It NEVER auto-sends.
 * This script lets the operator review each proposal, optionally add their own words
 * (an editor note that leads the email), and either CONFIRM it (status → 'confirmed',
 * which is what the future SES send step will pick up) or REJECT it. Mirrors
 * predictions/review.js — AWS CLI, no public auth surface, no npm deps.
 *
 * Until SES is wired (Phase 3), confirming only marks the proposal ready — nothing
 * is emailed. See BREAKING_ALERTS_PLAN.md.
 *
 * Usage:
 *   node breaking/review.js            # interactive: walk proposed alerts
 *   node breaking/review.js --list     # just list what's awaiting review
 */

const { execSync } = require('child_process');
const readline = require('readline');

const TABLE = 'GlobalPerspectiveBreakingAlerts';
const REGION = 'ap-northeast-1';

const FLAGS = process.argv.slice(2);
const LIST_ONLY = FLAGS.includes('--list');

function aws(args) {
  return execSync(`aws ${args}`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

// Minimal DynamoDB (un)marshal — S/N/BOOL/NULL/L/M.
function unmarshal(av) {
  if (av == null) return null;
  if ('S' in av) return av.S;
  if ('N' in av) return Number(av.N);
  if ('BOOL' in av) return av.BOOL;
  if ('NULL' in av) return null;
  if ('L' in av) return av.L.map(unmarshal);
  if ('M' in av) {
    const o = {};
    for (const k of Object.keys(av.M)) o[k] = unmarshal(av.M[k]);
    return o;
  }
  return av;
}
function marshal(v) {
  if (v === null || v === undefined) return { NULL: true };
  if (typeof v === 'string') return { S: v };
  if (typeof v === 'number') return { N: String(v) };
  if (typeof v === 'boolean') return { BOOL: v };
  if (Array.isArray(v)) return { L: v.map(marshal) };
  if (typeof v === 'object') {
    const M = {};
    for (const k of Object.keys(v)) M[k] = marshal(v[k]);
    return { M };
  }
  return { S: String(v) };
}

function scanProposed() {
  const items = [];
  let startKey = '';
  for (;;) {
    const skArg = startKey ? `--starting-token '${startKey}'` : '';
    const out = aws(
      `dynamodb scan --table-name ${TABLE} --region ${REGION} ` +
      `--filter-expression "#s = :p" ` +
      `--expression-attribute-names '{"#s":"status"}' ` +
      `--expression-attribute-values '{":p":{"S":"proposed"}}' ` +
      `--output json ${skArg}`,
    );
    const page = JSON.parse(out);
    items.push(...(page.Items || []).map((it) => unmarshal({ M: it })));
    if (!page.NextToken) break;
    startKey = page.NextToken;
  }
  // Highest-scoring first.
  return items.sort((a, b) => (b.score || 0) - (a.score || 0));
}

function putItem(item) {
  const fs = require('fs');
  const tmp = require('os').tmpdir() + `/breaking-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
  fs.writeFileSync(tmp, JSON.stringify(marshal(item).M));
  aws(`dynamodb put-item --table-name ${TABLE} --region ${REGION} --item file://${tmp}`);
  fs.unlinkSync(tmp);
}

function show(item) {
  console.log('\n════════════════════════════════════════════');
  console.log(`Story:   ${item.title}`);
  console.log(`Thread:  ${item.alertKey}`);
  console.log(`Score:   ${item.score}   reasons: ${(item.reasons || []).join('; ') || 'n/a'}`);
  console.log(`Verify:  ${item.verify?.status || 'n/a'} ${item.verify?.note ? '— ' + item.verify.note : ''}`);
  console.log(`Cycle:   ${item.cycle}`);
  console.log('──── draft email ────');
  console.log(`Subject: ${item.draft?.subject || ''}`);
  console.log(item.draft?.text || '(no body)');
  console.log('════════════════════════════════════════════');
}

async function main() {
  const queue = scanProposed();
  if (!queue.length) {
    console.log('No proposed alerts awaiting review. ✓');
    return;
  }
  console.log(`${queue.length} alert(s) awaiting review (highest-scoring first).`);

  if (LIST_ONLY) {
    for (const it of queue) console.log(`  [${it.score}] ${it.title}  (${it.alertKey})  verify=${it.verify?.status || 'n/a'}`);
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((res) => rl.question(q, res));

  for (const item of queue) {
    show(item);
    const ans = (await ask('\n[c]=confirm  w=add your words then confirm  r=reject  s=skip  q=quit > ')).trim().toLowerCase();
    if (ans === 'q') break;
    if (ans === 's' || ans === '') continue;

    if (ans === 'r') {
      item.status = 'rejected';
      item.reviewedAt = new Date().toISOString();
      putItem(item);
      console.log('  → rejected (will not send).');
      continue;
    }

    if (ans === 'c' || ans === 'w') {
      if (ans === 'w') {
        const note = (await ask('Your words (one line, leads the email; Enter to skip):\n> ')).trim();
        if (note) {
          item.editorNote = note;
          // Reflect the note at the top of the stored draft so the confirmed record
          // previews exactly what will send. (The Phase-3 sender re-renders from
          // editorNote as the source of truth.)
          item.draft = item.draft || {};
          item.draft.text = `${note}\n\n${item.draft.text || ''}`.trim();
        }
      }
      item.status = 'confirmed';
      item.confirmedAt = new Date().toISOString();
      item.confirmedBy = 'human';
      putItem(item);
      console.log('  → confirmed (cleared to send once SES is wired).');
    } else {
      console.log('  (unrecognized — skipped)');
    }
  }
  rl.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
