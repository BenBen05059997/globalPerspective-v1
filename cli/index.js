#!/usr/bin/env node

'use strict';

const API = 'https://ba4q3fnwq6.execute-api.ap-northeast-1.amazonaws.com/default/proxy';

// ── Colors (no dependencies) ─────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

const RISK_COLORS = {
  high: c.red,
  elevated: c.yellow,
  moderate: c.cyan,
  low: c.green,
};

const CAT_COLORS = {
  conflict: c.red,
  politics: c.blue,
  economy: c.green,
  technology: c.magenta,
  health: c.cyan,
  environment: c.green,
  military: c.red,
  diplomacy: c.magenta,
  security: c.yellow,
  society: c.cyan,
};

// ── API helpers ──────────────────────────────────────────────────────────────

async function api(action, payload = {}) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'API request failed');
  return data.data;
}

// ── Commands ─────────────────────────────────────────────────────────────────

async function cmdToday() {
  const data = await api('today');
  const entries = data?.entries || [];

  if (entries.length === 0) {
    console.log(`${c.dim}No topics today.${c.reset}`);
    return;
  }

  console.log(`\n${c.bold}📰 Today's Global Topics${c.reset} ${c.dim}(${entries.length} topics)${c.reset}\n`);

  // Group by category
  const groups = {};
  for (const e of entries) {
    const cat = (e.category || 'other').toLowerCase();
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(e);
  }

  for (const [cat, items] of Object.entries(groups).sort((a, b) => b[1].length - a[1].length)) {
    const cc = CAT_COLORS[cat] || c.gray;
    console.log(`${cc}${c.bold}  ${cat.toUpperCase()}${c.reset} ${c.dim}(${items.length})${c.reset}`);
    for (const e of items) {
      const regions = (e.regions || []).slice(0, 3).join(', ');
      const thread = e.threadId ? `${c.dim}🧵${c.reset}` : '  ';
      console.log(`  ${thread} ${e.title}`);
      if (regions) console.log(`      ${c.dim}${regions}${c.reset}`);
    }
    console.log();
  }

  console.log(`${c.dim}  Full analysis at ${c.cyan}https://globalperspective.net${c.reset}`);
}

async function cmdCountry(name) {
  if (!name) {
    console.error(`${c.red}Usage: gp country <name>${c.reset}`);
    console.error(`${c.dim}Example: gp country "United States"${c.reset}`);
    process.exit(1);
  }

  const data = await api('country_preview', { countryName: name });

  if (!data) {
    console.log(`${c.dim}No intelligence data for "${name}".${c.reset}`);
    return;
  }

  const riskColor = RISK_COLORS[data.riskLevel] || c.gray;
  const arrow = data.trajectory === 'escalating' ? '↗' : data.trajectory === 'de-escalating' ? '↘' : '→';

  console.log(`\n${c.bold}🌍 ${name}${c.reset}  ${riskColor}${c.bold}${(data.riskLevel || '').toUpperCase()}${c.reset} ${riskColor}${arrow}${c.reset}`);

  if (data.headline) {
    console.log(`${c.dim}${data.headline}${c.reset}\n`);
  }

  if (data.bluf) {
    console.log(`${c.bold}BOTTOM LINE${c.reset}`);
    console.log(`  ${data.bluf}\n`);
  }

  if (data.keyDevelopments?.length > 0) {
    console.log(`${c.bold}KEY DEVELOPMENTS${c.reset}`);
    for (const d of data.keyDevelopments) {
      console.log(`  ${c.cyan}${d.date}${c.reset}  ${d.text}`);
    }
    console.log();
  }

  if (data.totalArticles || data.dayCount) {
    console.log(`${c.dim}  ${data.totalArticles || '?'} articles across ${data.dayCount || '?'} days${c.reset}`);
    if (data.generatedAt) {
      const ago = Math.floor((Date.now() - new Date(data.generatedAt).getTime()) / 3600000);
      console.log(`${c.dim}  Updated ${ago}h ago${c.reset}`);
    }
  }

  console.log(`\n${c.dim}  Full briefing at ${c.cyan}https://globalperspective.net/weekly/country/${encodeURIComponent(name)}${c.reset}`);
}

async function cmdThread(threadId) {
  if (!threadId) {
    console.error(`${c.red}Usage: gp thread <threadId>${c.reset}`);
    console.error(`${c.dim}Example: gp thread thread-iran-war-abc123${c.reset}`);
    process.exit(1);
  }

  const data = await api('thread_preview', { threadId });

  if (!data) {
    console.log(`${c.dim}No analysis data for thread "${threadId}".${c.reset}`);
    return;
  }

  console.log(`\n${c.bold}🧵 ${data.threadTitle || threadId}${c.reset}\n`);

  if (data.entryShortTitles?.length > 0) {
    console.log(`${c.bold}TIMELINE${c.reset}`);
    for (const e of data.entryShortTitles) {
      console.log(`  ${c.cyan}●${c.reset} ${e.shortTitle}`);
    }
    console.log();
  }

  console.log(`${c.dim}  Full arc at ${c.cyan}https://globalperspective.net/weekly/thread/${threadId}${c.reset}`);
}

async function cmdCountries() {
  // Use today's topics to find most-mentioned countries
  const data = await api('today');
  const entries = data?.entries || [];
  const counts = {};
  for (const e of entries) {
    for (const r of (e.regions || [])) {
      counts[r] = (counts[r] || 0) + 1;
    }
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 15);

  console.log(`\n${c.bold}🌍 Top Countries in Today's News${c.reset}\n`);
  for (const [name, count] of sorted) {
    console.log(`  ${c.bold}${String(count).padStart(3)}${c.reset}  ${name}`);
  }
  console.log(`\n${c.dim}  Run ${c.cyan}gp country "<name>"${c.dim} for intelligence briefing${c.reset}`);
  console.log(`${c.dim}  Full dashboard at ${c.cyan}https://globalperspective.net/weekly/countries${c.reset}`);
}

function cmdHelp() {
  console.log(`
${c.bold}Global Perspectives${c.reset} — AI-powered global news intelligence

${c.bold}USAGE${c.reset}
  gp <command> [args]

${c.bold}COMMANDS${c.reset}
  ${c.cyan}today${c.reset}              Today's global topics grouped by category
  ${c.cyan}countries${c.reset}          Top countries in today's news
  ${c.cyan}country${c.reset} <name>     Country intelligence briefing
  ${c.cyan}thread${c.reset} <id>        Story arc thread analysis
  ${c.cyan}help${c.reset}               Show this help message

${c.bold}EXAMPLES${c.reset}
  ${c.dim}$ gp today${c.reset}
  ${c.dim}$ gp country "United States"${c.reset}
  ${c.dim}$ gp country Iran${c.reset}
  ${c.dim}$ gp countries${c.reset}
  ${c.dim}$ gp thread thread-iran-war-abc123${c.reset}

${c.bold}OUTPUT${c.reset}
  ${c.dim}$ gp today --json${c.reset}     Raw JSON output (pipe to jq, scripts, etc.)

${c.dim}https://globalperspective.net${c.reset}
`);
}

// ── JSON mode ────────────────────────────────────────────────────────────────

async function cmdJson(action, payload) {
  const data = await api(action, payload);
  console.log(JSON.stringify(data, null, 2));
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();
  const jsonMode = args.includes('--json');

  try {
    if (jsonMode) {
      if (command === 'today') return cmdJson('today');
      if (command === 'country') return cmdJson('country_preview', { countryName: args[1] });
      if (command === 'thread') return cmdJson('thread_preview', { threadId: args[1] });
      if (command === 'countries') return cmdJson('today');
    }

    switch (command) {
      case 'today': return cmdToday();
      case 'country': return cmdCountry(args.slice(1).join(' '));
      case 'thread': return cmdThread(args[1]);
      case 'countries': return cmdCountries();
      case 'help': case '--help': case '-h': return cmdHelp();
      default: return cmdHelp();
    }
  } catch (err) {
    console.error(`${c.red}Error: ${err.message}${c.reset}`);
    process.exit(1);
  }
}

main();
