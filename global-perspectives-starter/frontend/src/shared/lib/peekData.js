// peekData — one pure function that turns a story record into the StoryPeek's fields (M5a).
// Same wording everywhere a story is mentioned (feed row, shaded country). Never fetches
// anything; every field is read straight off the record already loaded by the page. A field
// that isn't present in the data is left out — the peek is never padded with placeholder text
// (CLAUDE.md: no placeholder UI).
import { crisisTypeForCategory, crisisHueForCategory } from '@/shared/lib/crisisHue.js';

/**
 * peekData(topic, opts?) -> {
 *   category?: string,        // human label, e.g. "Conflict"
 *   crisisType?: string,      // 'conflict' | 'political' | 'economic' | 'humanitarian' | 'neutral'
 *   hue?: string,             // hex colour for the category dot
 *   headline: string,
 *   primaryCountry?: string,
 *   sourcesLabel?: string,    // "N sources" — omitted when the count isn't known
 *   updatedLabel?: string,    // "updated <date>" — omitted when no real timestamp is passed in
 *   hint: string,
 * }
 * Returns null for a record with no title (nothing to preview).
 *
 * `opts.asOf` — the feed-level timestamp (topics don't carry their own per-story date; the
 * whole batch shares one generatedDate/updatedAt from useGeminiTopics). Pass it in rather than
 * having this function guess a per-story date that doesn't exist.
 */
export function peekData(topic, opts = {}) {
  if (!topic || typeof topic !== 'object' || !topic.title) return null;
  const { asOf = null } = opts;

  const out = { headline: topic.title, hint: 'Click to open the story card' };

  if (topic.category) {
    out.crisisType = crisisTypeForCategory(topic.category);
    out.category = String(topic.category);
    out.hue = crisisHueForCategory(topic.category);
  }

  const country = topic.primaryCountry || (Array.isArray(topic.regions) ? topic.regions[0] : null);
  if (country) out.primaryCountry = country;

  const n = Array.isArray(topic.sources) ? topic.sources.length : (Number.isFinite(topic.sources) ? topic.sources : 0);
  if (n > 0) out.sourcesLabel = `${n} source${n === 1 ? '' : 's'}`;

  if (asOf) {
    const d = new Date(asOf);
    if (!Number.isNaN(d.getTime())) {
      out.updatedLabel = `updated ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    }
  }

  return out;
}

export default peekData;
