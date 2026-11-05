// Pure helpers of the recovery script. They live in the newsRecover Lambda (one copy, shared with the operator CLI); this file re-exports them.
import { createRequire } from 'node:module';
const r = createRequire(import.meta.url)('../newsRecover/src/recover.js');
export const {
  SELECTOR_INDEX,
  parseRssXml,
  GDELT_MAX,
  readFeeds,
  gdeltTargets,
  gdeltUrl,
  seendateIso,
  parseGdeltDoc,
  gdeltLine,
  cdxUrl,
  snapshotUrl,
  parseCdx,
  waybackLines,
  dedupeLines,
  tally,
  dayRange,
  splitWindow,
  gkgFileUrls,
  unzipFirst,
  parseGkg,
} = r;
