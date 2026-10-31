// trackRecordFromView — the record view (`views/track-record.json`, decision 0044) as the data shape the page has always read
// (the `prediction_track_record` payload: the pilot-era fields flat, plus `questions`). Pure.
//   - `legacy` (the frozen pilot era) is spread flat; its provenance note (`source`, `asOf`) is not a page field.
//   - a week carries its `draw` ({K, pool, picked}) when the view could reproduce it from the forecast facts (0052); otherwise `loadDrawPool` fetches it when a reader verifies.
export function trackRecordFromView(view) {
  const { source: _source, asOf: _asOf, ...pilot } = view.legacy;
  return { ...pilot, questions: view.questions };
}

export const isTrackRecordView = (v) => Boolean(v && v.schemaVersion === 1 && v.questions && v.legacy);
