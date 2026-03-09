'use strict';

const CATEGORY_LABEL = {
  politics:   'Politics',
  economy:    'Economy',
  military:   'Military',
  conflict:   'Conflict',
  disaster:   'Disaster',
  technology: 'Technology',
  health:     'Health',
};

const CATEGORY_EMOJI = {
  politics:   '\u{1F3DB}',
  economy:    '\u{1F4C8}',
  military:   '\u2694\uFE0F',
  conflict:   '\u{1F4A5}',
  disaster:   '\u{1F32A}',
  technology: '\u{1F4BB}',
  health:     '\u{1F3E5}',
};

const CATEGORY_ORDER = [
  'politics', 'economy', 'conflict', 'military',
  'technology', 'health', 'disaster',
];

function formatDisplayDate(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day))
    .toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
    });
}

function cleanAiText(text) {
  if (!text) return '';
  return text
    .replace(/^#{1,4}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/Watchlist Signals[\s\S]*/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function groupByCategory(entries) {
  const sorted = [...entries].filter(e => e && e.title).sort((a, b) => {
    const catA = CATEGORY_ORDER.indexOf(a.category || 'general');
    const catB = CATEGORY_ORDER.indexOf(b.category || 'general');
    const orderA = catA >= 0 ? catA : CATEGORY_ORDER.length;
    const orderB = catB >= 0 ? catB : CATEGORY_ORDER.length;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(b.archivedAt || 0) - new Date(a.archivedAt || 0);
  });

  const byCategory = {};
  for (const entry of sorted) {
    const cat = entry.category || 'general';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(entry);
  }
  return { sorted, byCategory };
}

/**
 * Build a prompt for an AI model to generate a narrative overview of today's news.
 *
 * @param {Array} entries - Archive entries from today-archive
 * @param {string} displayDate - Human-readable date (e.g. "March 3, 2026")
 * @returns {string} Prompt string to send to AI
 */
function buildAiOverviewPrompt(entries, displayDate) {
  const headlines = entries
    .filter(e => e && e.title)
    .slice(0, 20)
    .map((e, i) => {
      const cat = CATEGORY_LABEL[e.category] || 'General';
      const regions = (e.regions || []).slice(0, 2).join(', ') || 'Global';
      return `${i + 1}. [${cat}] ${e.title} (${regions})`;
    })
    .join('\n');

  return `You are writing the intro for a daily global news digest published on Dev.to. Today is ${displayDate}.

Here are today's top headlines:
${headlines}

Write a compelling 2-3 paragraph overview (150-200 words total) that:
- Summarizes the main themes and storylines of the day
- Highlights the most significant or interconnected events
- Uses a clear, informative tone suitable for a developer/tech audience
- Does NOT use bullet points or headers — just flowing paragraphs
- Does NOT mention "Dev.to" or "this article"

Write only the paragraphs, nothing else.`;
}

/**
 * Build a compact daily summary article from archive entries.
 *
 * @param {Array} entries - Archive entries (from today-archive DynamoDB item)
 * @param {string} dateKey - Date in YYYY-MM-DD format
 * @param {Object} [options]
 * @param {string} [options.siteUrl] - Link to the live site
 * @param {string} [options.aiOverview] - AI-generated narrative overview paragraphs
 * @param {number} [options.maxEntries] - Limit entries (0 = no limit)
 * @param {'devto'|'markdown'} [options.format] - Output format
 * @returns {{ title: string, body_markdown: string, description: string, stats: Object }}
 */
function buildDailySummary(entries, dateKey, options = {}) {
  const {
    siteUrl = 'https://globalperspective.net',
    aiOverview = '',
    maxEntries = 0,
    format = 'devto',
  } = options;

  const displayDate = formatDisplayDate(dateKey);

  let filtered = [...entries].filter(e => e && e.title);
  if (maxEntries > 0) filtered = filtered.slice(0, maxEntries);

  const { sorted, byCategory } = groupByCategory(filtered);
  const totalCount = sorted.length;
  const activeCats = [...CATEGORY_ORDER, 'general'].filter(c => byCategory[c]);
  const categoryCount = activeCats.length;

  const bodyParts = [];

  if (format === 'devto') {
    bodyParts.push(
      `> **Global Perspectives** \u2014 AI-powered news platform tracking global events in real time. [Read live \u2192](${siteUrl})`,
      '',
    );
  }

  bodyParts.push(
    `**${totalCount} stories** from around the world across **${categoryCount} categories** \u2014 ${displayDate}`,
    '',
    '---',
    '',
  );

  if (aiOverview) {
    const overviewText = cleanAiText(aiOverview);
    bodyParts.push(overviewText, '', '---', '');
  }

  for (const cat of activeCats) {
    const emoji = CATEGORY_EMOJI[cat] || '\u{1F4CC}';
    const label = CATEGORY_LABEL[cat] || 'General';
    const catEntries = byCategory[cat];

    bodyParts.push(`## ${emoji} ${label}`);
    bodyParts.push('');

    for (const entry of catEntries) {
      const regions = (entry.regions || []).slice(0, 3).join(' \u00B7 ') || 'Global';
      const sources = (entry.sources || []).slice(0, 1);
      if (sources.length) {
        const s = sources[0];
        const url = s.url || s.link || '#';
        bodyParts.push(`- **[${entry.title}](${url})** \u2014 _${regions}_`);
      } else {
        bodyParts.push(`- **${entry.title}** \u2014 _${regions}_`);
      }
    }

    bodyParts.push('');
  }

  bodyParts.push(
    '---',
    '',
    '## About Global Perspectives',
    '',
    `[Global Perspectives](${siteUrl}) is an AI news platform that tracks ~13 global topics, refreshing every 2 hours. Each story includes root cause analysis, balanced perspectives, and chain-reaction predictions \u2014 visualized on an interactive world map.`,
    '',
    `[Explore today\u2019s full analysis \u2192](${siteUrl})`,
    '',
    `*Generated ${displayDate} \u2022 Stories from the past 24 hours*`,
  );

  const body_markdown = bodyParts.join('\n');
  const title = `Global News Digest \u2014 ${displayDate}`;
  const description = `${totalCount} global stories for ${displayDate}: AI-analyzed news across ${activeCats.map(c => CATEGORY_LABEL[c] || 'General').join(', ')}.`;

  const stats = {
    totalEntries: totalCount,
    categoryCount,
    categories: activeCats.reduce((acc, cat) => {
      acc[cat] = byCategory[cat].length;
      return acc;
    }, {}),
  };

  return { title, body_markdown, description, stats };
}

module.exports = {
  buildDailySummary,
  buildAiOverviewPrompt,
  formatDisplayDate,
  cleanAiText,
  groupByCategory,
  CATEGORY_LABEL,
  CATEGORY_EMOJI,
  CATEGORY_ORDER,
};
