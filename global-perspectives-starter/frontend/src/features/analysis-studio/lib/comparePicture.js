// imported by Node tooling outside src/ — keep relative imports
// Compare lens picture (S5c F1 §2): "lanes, shared places, a judged link, and a cited
// grid" — one lane per selected story, the region(s) more than one lane shares, ONE
// judged link (labelled a model judgment, never invented beyond what the regions
// already show), and a small story x source-kind citation grid. Pure — no fetches.

function normalize(s) {
  return typeof s === 'string' ? s.trim().toLowerCase() : '';
}

// buildComparePicture(selectedTopics, citations) -> { lanes, sharedPlaces, judgedLink, grid }
export function buildComparePicture(selectedTopics, citations) {
  const topics = Array.isArray(selectedTopics) ? selectedTopics : [];
  const lanes = topics.map((t) => ({
    title: t.title || 'Untitled',
    regions: Array.isArray(t.regions) ? t.regions.filter(Boolean) : [],
  }));

  const regionCount = new Map(); // normalized -> { name, laneTitles: Set }
  lanes.forEach((l) => {
    l.regions.forEach((r) => {
      const key = normalize(r);
      if (!key) return;
      if (!regionCount.has(key)) regionCount.set(key, { name: r, laneTitles: new Set() });
      regionCount.get(key).laneTitles.add(l.title);
    });
  });
  const sharedPlaces = [...regionCount.values()]
    .filter((v) => v.laneTitles.size > 1)
    .map((v) => v.name);

  // ONE judged link: the two lanes that share the first shared region, if any — never
  // a claim the data doesn't support, always labelled a model judgment (the region
  // overlap is real; "related" beyond that is our reading, not a reported fact).
  let judgedLink = null;
  if (sharedPlaces.length > 0) {
    const via = sharedPlaces[0];
    const laneTitles = [...regionCount.get(normalize(via)).laneTitles];
    if (laneTitles.length >= 2) {
      judgedLink = { from: laneTitles[0], to: laneTitles[1], via, label: 'shares a region — model judgment' };
    }
  }

  const grid = lanes.map((l) => {
    const rows = (Array.isArray(citations) ? citations : []).filter((c) => c.storyTitle === l.title);
    const counts = { NEWS: 0, ANALYSIS: 0, DRIFT: 0, FORECAST: 0 };
    rows.forEach((c) => { counts[c.kind] = (counts[c.kind] || 0) + 1; });
    return { title: l.title, counts };
  });

  return { lanes, sharedPlaces, judgedLink, grid };
}
