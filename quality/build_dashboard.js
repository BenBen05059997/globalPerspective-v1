#!/usr/bin/env node
// Build quality/dashboard.md from quality/reviews/*.md.
//
// Parses filled-in rubrics, aggregates grades + would-publish answers, and
// (when both signals exist for the same record) compares human grade against
// the auto-judge mean to surface judge-vs-human drift.
//
// Usage:
//   node quality/build_dashboard.js
//
// No npm deps. Re-runnable any time; safe to overwrite the dashboard file.

const fs = require('fs');
const path = require('path');

const REVIEWS_DIR = path.join(__dirname, 'reviews');
const OUT = path.join(__dirname, 'dashboard.md');

const RECORD_ID_RX = /\*\*ID:\*\*\s*`([^`]+)`/;
const AUTO_JUDGE_RX = /\*\*Auto-judge:\*\*\s*(.+)$/m;

// Extract a single bracketed answer — but reject template lines that still
// contain the full "[opt1 / opt2 / opt3]" placeholder.
function extractBracketAnswer(line, validOptions) {
  if (!line) return null;
  // Pull out the bracketed expression
  const m = line.match(/\[([^\]]+)\]/);
  if (!m) return null;
  const inside = m[1].trim();
  // Template lines contain slashes — reject
  if (inside.includes('/')) return null;
  return validOptions.includes(inside) ? inside : null;
}

// Extract the overall-grade letter. Accepts plain `A`, backticked `\`A\``,
// or `A — comment`. Rejects template lines containing "/".
function extractGrade(line) {
  if (!line) return null;
  const cleaned = line.replace(/^\*\*Overall grade:\*\*\s*/i, '').trim();
  if (cleaned.includes('/')) return null;
  // Strip wrapping backticks / brackets / asterisks, then look at first char
  const stripped = cleaned.replace(/^[`*\[]+|[`*\]]+$/g, '').trim();
  const first = stripped.charAt(0).toUpperCase();
  return /^[A-F]$/.test(first) ? first : null;
}

function parseReviewFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const week = path.basename(filePath, '.md');
  // Split on the per-record header
  const sections = text.split(/^## Record /m).slice(1);
  return sections.map(section => {
    const headlineMatch = section.match(/^\d+\s+—\s+(.+)$/m);
    const idMatch = section.match(RECORD_ID_RX);
    const judgeMatch = section.match(AUTO_JUDGE_RX);

    const gradeLineMatch = section.match(/\*\*Overall grade:\*\*[^\n]*/i);
    const wpLineMatch = section.match(/Would you publish[^\n]*/i);
    const bsLineMatch = section.match(/hallucinations or BS[^\n]*/i);

    return {
      week,
      headline: headlineMatch ? headlineMatch[1].trim() : '(unknown)',
      id: idMatch ? idMatch[1] : null,
      grade: gradeLineMatch ? extractGrade(gradeLineMatch[0]) : null,
      wouldPublish: extractBracketAnswer(wpLineMatch?.[0], ['yes', 'yes-with-edits', 'no']),
      bsLevel: extractBracketAnswer(bsLineMatch?.[0], ['none', 'minor', 'moderate', 'severe']),
      autoJudgeRaw: judgeMatch ? judgeMatch[1].trim() : null,
    };
  });
}

function collectReviews() {
  if (!fs.existsSync(REVIEWS_DIR)) return [];
  const files = fs.readdirSync(REVIEWS_DIR)
    .filter(f => /^\d{4}-\d{2}\.md$/.test(f))
    .map(f => path.join(REVIEWS_DIR, f))
    .sort();
  const all = [];
  for (const f of files) {
    all.push(...parseReviewFile(f));
  }
  return all;
}

function countBy(items, key) {
  const out = {};
  for (const it of items) {
    const v = it[key];
    if (!v) continue;
    out[v] = (out[v] || 0) + 1;
  }
  return out;
}

function meanGradeGpa(grades) {
  if (grades.length === 0) return null;
  const gpa = { A: 4, B: 3, C: 2, D: 1, F: 0 };
  const sum = grades.reduce((s, g) => s + (gpa[g] ?? 0), 0);
  return sum / grades.length;
}

function fmtPct(items, key, value) {
  const n = items.filter(it => it[key]).length;
  if (n === 0) return '—';
  const hit = items.filter(it => it[key] === value).length;
  return `${Math.round((hit / n) * 100)}% (${hit}/${n})`;
}

function fmtTable(rows) {
  if (rows.length === 0) return '_no graded records yet_';
  const cols = Object.keys(rows[0]);
  const head = `| ${cols.join(' | ')} |`;
  const sep = `| ${cols.map(() => '---').join(' | ')} |`;
  const body = rows.map(r => `| ${cols.map(c => r[c] ?? '').join(' | ')} |`).join('\n');
  return [head, sep, body].join('\n');
}

function render(reviews) {
  const today = new Date().toISOString().slice(0, 10);
  const totalLogged = reviews.length;
  const graded = reviews.filter(r => r.grade);
  const gpa = meanGradeGpa(graded.map(r => r.grade));

  // Per-week summary
  const weeks = [...new Set(reviews.map(r => r.week))].sort();
  const weekRows = weeks.map(w => {
    const wRecs = reviews.filter(r => r.week === w);
    const wGraded = wRecs.filter(r => r.grade);
    const wGpa = meanGradeGpa(wGraded.map(r => r.grade));
    return {
      week: w,
      records: wRecs.length,
      graded: wGraded.length,
      'mean GPA': wGpa != null ? wGpa.toFixed(2) : '—',
      'would publish': fmtPct(wRecs, 'wouldPublish', 'yes'),
      'yes-with-edits': fmtPct(wRecs, 'wouldPublish', 'yes-with-edits'),
    };
  });

  const gradeDist = countBy(graded, 'grade');
  const wpDist = countBy(reviews, 'wouldPublish');
  const bsDist = countBy(reviews, 'bsLevel');

  return `# Quality dashboard — human spot checks

> Auto-generated by \`quality/build_dashboard.js\` on ${today}.
> Source: \`quality/reviews/*.md\` (Layer 4 of [Quality Plan](../ECONOMIC_DISRUPTION_QUALITY_PLAN.md)).

## Headline

- **${totalLogged}** record(s) logged across **${weeks.length}** week(s)
- **${graded.length}** with a final grade
- **Mean GPA:** ${gpa != null ? gpa.toFixed(2) + ' / 4.00' : '—'}
- **Would-publish rate (yes):** ${fmtPct(reviews, 'wouldPublish', 'yes')}
- **Would-publish rate (yes or yes-with-edits):** ${(() => {
    const n = reviews.filter(r => r.wouldPublish).length;
    if (!n) return '—';
    const hit = reviews.filter(r => r.wouldPublish === 'yes' || r.wouldPublish === 'yes-with-edits').length;
    return `${Math.round((hit / n) * 100)}% (${hit}/${n})`;
  })()}

## Per-week trend

${fmtTable(weekRows)}

## Grade distribution

${Object.keys(gradeDist).length === 0 ? '_no grades yet_' : Object.entries(gradeDist).sort().map(([g, n]) => `- **${g}** — ${n}`).join('\n')}

## Would-publish distribution

${Object.keys(wpDist).length === 0 ? '_not answered yet_' : Object.entries(wpDist).map(([v, n]) => `- **${v}** — ${n}`).join('\n')}

## Hallucination level distribution

${Object.keys(bsDist).length === 0 ? '_not answered yet_' : Object.entries(bsDist).map(([v, n]) => `- **${v}** — ${n}`).join('\n')}

## Thresholds (from plan)

| Metric | Acceptable | Concerning | Target |
|---|---|---|---|
| Would-publish (yes-with-edits or better) | ≥ 80% | < 60% | ≥ 90% |
| Hit rate on direction calls (BRENT, 7d) | ≥ 55% | < 50% | ≥ 60% |
| Mean LLM-judge "no BS" | ≥ 4.0 / 5 | < 3.5 | ≥ 4.5 |

## How this gets used

- **Week 1–4:** baseline. Just keep logging — not enough to draw conclusions.
- **Week 5+:** compare per-record human grade against the auto-judge \`is_low_quality\` flag. Mismatches feed the judge-prompt revision (Phase E).
- **Month 3+:** publish the would-publish rate on \`/disclosures\` as the credibility moat.
`;
}

function main() {
  const reviews = collectReviews();
  const md = render(reviews);
  fs.writeFileSync(OUT, md, 'utf8');
  console.log(`Wrote ${OUT}`);
  console.log(`  ${reviews.length} record(s) parsed, ${reviews.filter(r => r.grade).length} graded.`);
}

main();
