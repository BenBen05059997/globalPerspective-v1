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

// ── Country flag emoji ────────────────────────────────────────────────────────

const COUNTRY_CODES = {
  'afghanistan':'AF','albania':'AL','algeria':'DZ','argentina':'AR','armenia':'AM',
  'australia':'AU','austria':'AT','azerbaijan':'AZ','bahrain':'BH','bangladesh':'BD',
  'belarus':'BY','belgium':'BE','bolivia':'BO','bosnia':'BA','brazil':'BR','brunei':'BN',
  'bulgaria':'BG','cambodia':'KH','cameroon':'CM','canada':'CA','chile':'CL','china':'CN',
  'colombia':'CO','croatia':'HR','cuba':'CU','cyprus':'CY','czech republic':'CZ','czechia':'CZ',
  'denmark':'DK','ecuador':'EC','egypt':'EG','estonia':'EE','ethiopia':'ET','finland':'FI',
  'france':'FR','georgia':'GE','germany':'DE','ghana':'GH','greece':'GR','guatemala':'GT',
  'haiti':'HT','honduras':'HN','hungary':'HU','iceland':'IS','india':'IN','indonesia':'ID',
  'iran':'IR','iraq':'IQ','ireland':'IE','israel':'IL','italy':'IT','jamaica':'JM',
  'japan':'JP','jordan':'JO','kazakhstan':'KZ','kenya':'KE','kosovo':'XK','kuwait':'KW',
  'laos':'LA','latvia':'LV','lebanon':'LB','libya':'LY','lithuania':'LT','luxembourg':'LU',
  'malaysia':'MY','mexico':'MX','moldova':'MD','mongolia':'MN','morocco':'MA','myanmar':'MM',
  'nepal':'NP','netherlands':'NL','new zealand':'NZ','nigeria':'NG','north korea':'KP',
  'norway':'NO','oman':'OM','pakistan':'PK','palestine':'PS','panama':'PA','peru':'PE',
  'philippines':'PH','poland':'PL','portugal':'PT','qatar':'QA','romania':'RO','russia':'RU',
  'saudi arabia':'SA','senegal':'SN','serbia':'RS','singapore':'SG','slovakia':'SK',
  'slovenia':'SI','somalia':'SO','south africa':'ZA','south korea':'KR','south sudan':'SS',
  'spain':'ES','sri lanka':'LK','sudan':'SD','sweden':'SE','switzerland':'CH','syria':'SY',
  'taiwan':'TW','tajikistan':'TJ','thailand':'TH','turkey':'TR','turkmenistan':'TM',
  'ukraine':'UA','united arab emirates':'AE','uae':'AE','united kingdom':'GB','uk':'GB',
  'united states':'US','usa':'US','us':'US','uruguay':'UY','uzbekistan':'UZ','venezuela':'VE',
  'vietnam':'VN','yemen':'YE','zambia':'ZM','zimbabwe':'ZW',
};

function countryFlag(name) {
  if (!name) return '  ';
  const code = COUNTRY_CODES[name.toLowerCase()];
  if (!code || code.length !== 2) return '  ';
  return String.fromCodePoint(0x1F1E6 + code.charCodeAt(0) - 65, 0x1F1E6 + code.charCodeAt(1) - 65);
}

function topicFlag(entry) {
  const regions = entry.regions || [];
  for (const r of regions) {
    const flag = countryFlag(r);
    if (flag !== '  ') return flag;
  }
  return '🌐';
}

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

// ── Interactive terminal helpers ──────────────────────────────────────────────

const ALT_SCREEN_ON = '\x1b[?1049h';
const ALT_SCREEN_OFF = '\x1b[?1049l';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const REVERSE = '\x1b[7m';

function wrapText(text, width) {
  if (!text) return [];
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > width) {
      lines.push(line.trim());
      line = w;
    } else {
      line = line ? line + ' ' + w : w;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

function truncate(str, max) {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

// ── Commands ─────────────────────────────────────────────────────────────────

async function cmdToday() {
  const data = await api('today');
  const entries = data?.entries || [];

  if (entries.length === 0) {
    console.log(`${c.dim}No topics today.${c.reset}`);
    return;
  }

  if (!process.stdin.isTTY) {
    printTodayFlat(entries);
    return;
  }

  await interactiveToday(entries);
}

function printTodayFlat(entries) {
  console.log(`\n${c.bold}📰 Today's Global Topics${c.reset} ${c.dim}(${entries.length} topics)${c.reset}\n`);
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
      const flag = topicFlag(e);
      console.log(`  ${flag} ${e.title}`);
      if (regions) console.log(`      ${c.dim}${regions}${c.reset}`);
    }
    console.log();
  }
  console.log(`${c.dim}  Full analysis at ${c.cyan}https://globalperspective.net${c.reset}`);
}

async function interactiveToday(entries) {
  // Build category groups
  const CAT_ORDER = ['conflict', 'politics', 'economy', 'technology', 'environment', 'health', 'society', 'military', 'diplomacy', 'security', 'science', 'culture', 'other'];
  const catMap = {};
  for (const e of entries) {
    const cat = (e.category || 'other').toLowerCase();
    if (!catMap[cat]) catMap[cat] = [];
    catMap[cat].push(e);
  }
  const categories = CAT_ORDER.filter(k => catMap[k]);
  categories.push(...Object.keys(catMap).filter(k => !categories.includes(k)));

  let catIdx = 0;
  let itemIdx = 0;
  let expanded = false;
  let aiTab = 0;
  const AI_TABS = ['summary', 'prediction', 'trace_cause'];
  const AI_LABELS = ['Summarize', 'Predict', 'Trace Cause'];
  let scrollOffset = 0;

  function currentItems() { return catMap[categories[catIdx]] || []; }

  function render() {
    const cols = process.stdout.columns || 80;
    const rows = process.stdout.rows || 24;
    let buf = '\x1b[2J\x1b[H'; // clear + home

    // ── Header ──
    buf += `${c.bold} 📰 Global Perspectives${c.reset}${c.dim}  ${entries.length} topics${c.reset}\n`;

    // ── Category tabs ──
    buf += '\n ';
    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      const count = catMap[cat].length;
      const cc = CAT_COLORS[cat] || c.gray;
      if (i === catIdx) {
        buf += `${REVERSE}${cc}${c.bold} ${cat} (${count}) ${c.reset} `;
      } else {
        buf += `${c.dim} ${cat} (${count}) ${c.reset}`;
      }
    }
    buf += '\n\n';

    // ── Item list ──
    const items = currentItems();
    const maxListRows = expanded ? Math.floor((rows - 8) / 2) : rows - 8;

    // Adjust scroll
    if (itemIdx < scrollOffset) scrollOffset = itemIdx;
    if (itemIdx >= scrollOffset + maxListRows) scrollOffset = itemIdx - maxListRows + 1;

    const visibleEnd = Math.min(items.length, scrollOffset + maxListRows);

    for (let i = scrollOffset; i < visibleEnd; i++) {
      const e = items[i];
      const isSelected = i === itemIdx;
      const regions = (e.regions || []).slice(0, 3).join(', ');
      const flag = topicFlag(e);
      const title = truncate(e.title, cols - 10);

      if (isSelected) {
        buf += `${REVERSE}${c.bold} ▸ ${flag} ${title}${c.reset}\n`;
        if (regions) buf += `${c.cyan}     ${regions}${c.reset}\n`;
      } else {
        buf += `   ${flag} ${title}\n`;
      }
    }

    // Scroll indicator
    if (items.length > maxListRows) {
      const pct = Math.round(((itemIdx + 1) / items.length) * 100);
      buf += `\n${c.dim}   ${itemIdx + 1}/${items.length} (${pct}%)${c.reset}`;
    }

    // ── Expanded detail ──
    if (expanded && items[itemIdx]) {
      const e = items[itemIdx];
      buf += '\n\n';
      buf += ` ${c.dim}${'─'.repeat(cols - 2)}${c.reset}\n`;

      // AI tab bar
      buf += ' ';
      for (let t = 0; t < AI_TABS.length; t++) {
        const hasData = e.ai?.[AI_TABS[t]];
        if (t === aiTab) {
          buf += `${REVERSE}${c.cyan}${c.bold} ${AI_LABELS[t]} ${c.reset} `;
        } else if (hasData) {
          buf += `${c.dim} ${AI_LABELS[t]} ${c.reset} `;
        } else {
          buf += `${c.dim} ${AI_LABELS[t]} ${c.reset} `;
        }
      }
      buf += '\n\n';

      const content = e.ai?.[AI_TABS[aiTab]];
      if (content) {
        const wrapped = wrapText(content, cols - 6);
        const maxLines = rows - maxListRows - 12;
        for (const line of wrapped.slice(0, Math.max(3, maxLines))) {
          buf += `   ${line}\n`;
        }
        if (wrapped.length > maxLines) {
          buf += `   ${c.dim}... (${wrapped.length - maxLines} more lines — view full at globalperspective.net)${c.reset}\n`;
        }
      } else {
        buf += `   ${c.dim}No ${AI_LABELS[aiTab].toLowerCase()} available for this topic.${c.reset}\n`;
      }

      if (e.threadId) {
        buf += `\n   ${c.dim}Story arc: ${c.cyan}gp thread ${e.threadId}${c.reset}\n`;
      }
    }

    // ── Keybindings bar ──
    buf += `\n${c.dim} ←→${c.reset} category  ${c.dim}↑↓${c.reset} navigate  ${c.dim}Enter${c.reset} ${expanded ? 'collapse' : 'expand'}  ${c.dim}Tab${c.reset} AI tab  ${c.dim}q${c.reset} quit`;

    process.stdout.write(buf);
  }

  // Enter alternate screen
  process.stdout.write(ALT_SCREEN_ON + HIDE_CURSOR);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  process.stdout.on('resize', render);
  render();

  return new Promise((resolve) => {
    process.stdin.on('data', (key) => {
      const items = currentItems();

      if (key === 'q' || key === '\x03') { // q or Ctrl+C
        process.stdout.write(ALT_SCREEN_OFF + SHOW_CURSOR);
        process.stdin.setRawMode(false);
        resolve();
        process.exit(0);
        return;
      }

      // Arrow up / k
      if (key === '\x1b[A' || key === 'k') {
        itemIdx = Math.max(0, itemIdx - 1);
      }
      // Arrow down / j
      else if (key === '\x1b[B' || key === 'j') {
        itemIdx = Math.min(items.length - 1, itemIdx + 1);
      }
      // Arrow left / h / Shift+Tab — previous category
      else if (key === '\x1b[D' || key === 'h' || key === '\x1b[Z') {
        catIdx = (catIdx - 1 + categories.length) % categories.length;
        itemIdx = 0;
        scrollOffset = 0;
        expanded = false;
      }
      // Arrow right / l — next category
      else if (key === '\x1b[C' || key === 'l') {
        catIdx = (catIdx + 1) % categories.length;
        itemIdx = 0;
        scrollOffset = 0;
        expanded = false;
      }
      // Number keys 1-9 — jump to category
      else if (key >= '1' && key <= '9') {
        const idx = parseInt(key) - 1;
        if (idx < categories.length) {
          catIdx = idx;
          itemIdx = 0;
          scrollOffset = 0;
          expanded = false;
        }
      }
      // Enter — toggle expand
      else if (key === '\r' || key === '\n') {
        expanded = !expanded;
        aiTab = 0;
      }
      // Tab — cycle AI tab
      else if (key === '\t') {
        if (expanded) aiTab = (aiTab + 1) % AI_TABS.length;
        else expanded = true;
      }
      // Escape — collapse
      else if (key === '\x1b' && expanded) {
        expanded = false;
      }
      // g — go to top
      else if (key === 'g') {
        itemIdx = 0;
        scrollOffset = 0;
      }
      // G — go to bottom
      else if (key === 'G') {
        itemIdx = items.length - 1;
      }

      render();
    });
  });
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

  const flag = countryFlag(name);
  console.log(`\n${c.bold}${flag} ${name}${c.reset}  ${riskColor}${c.bold}${(data.riskLevel || '').toUpperCase()}${c.reset} ${riskColor}${arrow}${c.reset}`);

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
    const flag = countryFlag(name);
    console.log(`  ${flag} ${c.bold}${String(count).padStart(3)}${c.reset}  ${name}`);
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
