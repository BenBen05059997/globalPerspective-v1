// The age rule a country briefing is shown by, the same as the country card and the map layer (freshnessState with
// COUNTRY_OLDER_AFTER_DAYS): 'hidden' (over 30 days) is too old to show as a briefing, 'older' is shown with a label.
import { freshnessState, COUNTRY_OLDER_AFTER_DAYS } from '@/shared/lib/freshness.js';

export function briefingAge(intel, now = Date.now()) {
  if (!intel?.generatedAt) return 'plain';
  const ageDays = (now - new Date(intel.generatedAt).getTime()) / 86400000;
  return freshnessState(ageDays, COUNTRY_OLDER_AFTER_DAYS);
}
