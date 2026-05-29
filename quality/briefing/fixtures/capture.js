#!/usr/bin/env node
// Capture a frozen snapshot of the three economy data sources for the briefing
// eval set. POSTs each public action to the REST proxy and writes
//   fixtures/real-<YYYY-MM-DD>.json   { capturedAt, topMovers, disruptions, markets }
//
// Usage:
//   node quality/briefing/fixtures/capture.js
//
// No npm deps — uses built-in fetch (Node 18+). All actions are public.

const fs = require('fs');
const path = require('path');

const ENDPOINT = 'https://ba4q3fnwq6.execute-api.ap-northeast-1.amazonaws.com/default/proxy';

async function call(action) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  if (!res.ok) throw new Error(`${action} → HTTP ${res.status}`);
  const json = await res.json();
  if (json && json.success === false) throw new Error(`${action} → success:false`);
  return json && 'data' in json ? json.data : json;
}

async function main() {
  console.log('Capturing economy snapshot from proxy…');
  const [topMovers, disruptions, markets] = await Promise.all([
    call('economic_top_movers'),
    call('economic_impact_list'),
    call('markets_global'),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const snapshot = {
    capturedAt: new Date().toISOString(),
    topMovers,
    disruptions,
    markets,
  };

  const outPath = path.join(__dirname, `real-${today}.json`);
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2), 'utf8');

  const sevCount = (disruptions || []).reduce((acc, d) => {
    acc[d.severity] = (acc[d.severity] || 0) + 1;
    return acc;
  }, {});
  console.log(`Wrote ${outPath}`);
  console.log(`  topMovers:   ${(topMovers || []).length} instruments`);
  console.log(`  disruptions: ${(disruptions || []).length} stories  ${JSON.stringify(sevCount)}`);
  console.log(`  series keys: ${Object.keys((markets && markets.series) || {}).length}`);
}

main().catch(err => {
  console.error('Capture failed:', err.message);
  process.exit(1);
});
