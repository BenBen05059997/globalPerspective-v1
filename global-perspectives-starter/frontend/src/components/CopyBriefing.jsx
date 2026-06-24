import { useState } from 'react';
import { threadPath } from '../utils/threadPath';

export default function CopyBriefing({ getText }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const text = getText();
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button className="copy-briefing-btn" onClick={handleCopy}>
      {copied ? '✓ Copied' : '📋 Copy briefing'}
    </button>
  );
}

// ── Formatters ───────────────────────────────────────────────────────────────

export function formatThreadBriefing(thread, analysis) {
  const title = analysis?.threadTitle || thread.latestTitle;
  const lines = [];

  lines.push(`🧵 ${title}`);
  lines.push(`${thread.articleCount} articles · ${thread.dayCount} days · ${thread.regions.slice(0, 4).join(', ')}`);
  lines.push('');

  if (analysis?.storyArc) {
    lines.push('HOW IT EVOLVED');
    lines.push(analysis.storyArc);
    lines.push('');
  }

  if (analysis?.trajectory) {
    lines.push("WHAT'S NEXT");
    lines.push(analysis.trajectory);
    lines.push('');
  }

  if (analysis?.rootCauseChain) {
    lines.push('WHY IT HAPPENED');
    lines.push(analysis.rootCauseChain);
    lines.push('');
  }

  if (analysis?.watchQuestions?.length > 0) {
    lines.push('QUESTIONS TO WATCH');
    for (const q of analysis.watchQuestions) {
      lines.push(`• ${q}`);
    }
    lines.push('');
  }

  lines.push(`— Global Perspectives · globalperspective.net${threadPath(thread.threadId)}`);

  return lines.join('\n');
}

export function formatCountryBriefing(countryName, intel, countryData) {
  const lines = [];

  lines.push(`🌍 ${countryName}${intel?.riskLevel ? ` — ${intel.riskLevel.toUpperCase()}` : ''}`);
  if (intel?.headline) lines.push(intel.headline);
  lines.push('');

  if (intel?.bluf) {
    lines.push('BOTTOM LINE');
    lines.push(intel.bluf);
    lines.push('');
  }

  if (intel?.keyDevelopments?.length > 0) {
    lines.push('KEY DEVELOPMENTS');
    for (const d of intel.keyDevelopments) {
      lines.push(`${d.date}  ${d.text}`);
    }
    lines.push('');
  }

  if (intel?.whyItMatters) {
    lines.push('WHY IT MATTERS');
    lines.push(intel.whyItMatters.replace(/\*\*/g, ''));
    lines.push('');
  }

  if (intel?.riskSignals?.length > 0) {
    lines.push('WHAT TO WATCH');
    for (const s of intel.riskSignals) {
      lines.push(`⚡ ${s}`);
    }
    lines.push('');
  }

  if (countryData) {
    lines.push(`${countryData.totalArticles} articles across ${countryData.dayCount} days`);
  }

  lines.push(`— Global Perspectives · globalperspective.net/weekly/country/${encodeURIComponent(countryName)}`);

  return lines.join('\n');
}

export function formatDailyBrief(brief) {
  if (!brief) return '';
  const lines = [];

  lines.push(`DAILY INTELLIGENCE BRIEF — ${brief.displayDate}`);
  lines.push('');

  if (brief.headline) {
    lines.push(`LEAD: ${brief.headline}`);
    lines.push('');
  }

  if (brief.summary) {
    lines.push('OVERVIEW');
    lines.push(brief.summary.replace(/\*\*/g, ''));
    lines.push('');
  }

  if (brief.topStories?.length > 0) {
    lines.push('TOP STORIES');
    for (const story of brief.topStories) {
      const regions = (story.regions || []).join(', ');
      lines.push(`• [${(story.category || '').toUpperCase()}] ${story.title} (${regions})`);
      if (story.prediction) lines.push(`  → ${story.prediction}`);
    }
    lines.push('');
  }

  if (brief.risingThread?.title) {
    lines.push('RISING THREAD');
    lines.push(`${brief.risingThread.title} — ${brief.risingThread.articleCount || '?'} articles, ${brief.risingThread.dayCount || '?'} days`);
    if (brief.risingThread.oneLiner) lines.push(brief.risingThread.oneLiner);
    lines.push('');
  }

  if (brief.countryToWatch?.countryName) {
    lines.push('COUNTRY TO WATCH');
    lines.push(`${brief.countryToWatch.countryName} — ${(brief.countryToWatch.riskLevel || '').toUpperCase()}`);
    if (brief.countryToWatch.headline) lines.push(brief.countryToWatch.headline);
    lines.push('');
  }

  if (brief.stats) {
    lines.push(`${brief.stats.totalArticles} articles · ${brief.stats.sourceOutlets} sources · ${brief.stats.countriesCovered} countries`);
  }

  lines.push(`— Global Perspectives · globalperspective.net/daily/${brief.dateKey}`);

  return lines.join('\n');
}
