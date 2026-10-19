// check_shared_blocks — ratchet on hand-made copies of shared blocks (engine: quality/ratchet.mjs).
//
// shared/ui owns the tier chip (TierChip), the tab switch (PhoneTabs) and the section header
// (SectionHeader). A feature that styles its own version is a copy that drifts, so per file and per
// kind the count may only go DOWN. Counted outside shared/ui (name heuristics, deliberately simple):
//   tierChip       distinct CSS classes defined with a risk-tier chip name: `tier` as a name part
//                  (al-tier-high, sh-tierlbl, hud-tier-chip), risk-pill/chip/badge, sev-chip/badge/pill.
//                  Source-quality tiers (`source-tier`) are a different thing and are not counted.
//   tabs           distinct CSS classes with `tab`/`tabs`/`tablist` as a name part, plus each
//                  role="tablist" written in JSX (a tab list not built with PhoneTabs)
//   sectionHeader  distinct CSS classes named <sec|section|rail|panel|col|left>-<head|header|hd|title|label|lbl|kicker>
// Shared `gp-*` classes restyled in a feature are not copies and are not counted. Excluded: tests, shared/ui.
import { run, isMain, stripCssComments } from './ratchet.mjs';

const TIER = /(?:^|[-_])(?:tier(?:lbl|label|chip|badge|pill)?|risk-?(?:pill|chip|badge)|sev(?:erity)?-?(?:chip|badge|pill))(?:$|[-_])/;
const TABS = /(?:^|[-_])(?:tabs?|tablist)(?:$|[-_])/;
const SECTION = /(?:^|[-_])(?:sec|section|rail|panel|col|left)[-_]+(?:head|header|hd|title|label|lbl|kicker)$/;
const TABLIST_JSX = /\brole=["'{`]+tablist\b/g;

// Distinct class names that appear in rule selectors (the text before each `{`).
function definedClasses(css) {
  const out = new Set();
  for (const [, selector] of stripCssComments(css).matchAll(/([^{}]+)\{/g)) {
    if (selector.trim().startsWith('@')) continue;
    for (const [, name] of selector.matchAll(/\.(-?[a-zA-Z_][\w-]*)/g)) if (!name.startsWith('gp-')) out.add(name);
  }
  return [...out];
}

export function countBlocks(text, file = '') {
  if (!file.endsWith('.css')) return { tabs: (text.match(TABLIST_JSX) || []).length };
  const names = definedClasses(text);
  return {
    tierChip: names.filter((n) => TIER.test(n) && !n.includes('source-tier')).length,
    tabs: names.filter((n) => TABS.test(n)).length,
    sectionHeader: names.filter((n) => SECTION.test(n)).length,
  };
}

export const skipSharedUi = (rel) => rel.startsWith('shared/ui/');

if (isMain(import.meta.url)) {
  process.exitCode = run({
    name: 'shared_blocks',
    title: 'hand-made shared blocks',
    count: countBlocks,
    skip: skipSharedUi,
    note: 'Per-file count of hand-made tier chips / tab lists / section headers outside shared/ui (see quality/check_shared_blocks.mjs). Counts may only fall; lower them with --lower after moving to the shared block.',
    advice: 'use TierChip, PhoneTabs or SectionHeader from shared/ui (or extend them) instead of a new class',
  });
}
