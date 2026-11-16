// Pure helpers shared inside the /today feature: topic ids and region order (Home, TopicNav), stored JSON (the AI result cards).

/** A topic's DOM/state id: its own id when it has one, else a slug of its title and position. */
export function getTopicId(t, idx) {
  const directId = t?.topicId || t?.topic_id || t?.id;
  if (directId != null) {
    const c = String(directId).trim();
    if (c.length > 0) return c;
  }
  return `${t.title || 'topic'}-${idx}`.replace(/[^a-zA-Z0-9]/g, '-');
}

/** [region, topics] pairs with at least one topic, most topics first, World last. */
export function sortRegions(categorizedTopics) {
  return Object.entries(categorizedTopics)
    .filter(([, rt]) => rt.length > 0)
    .sort((a, b) => {
      if (a[0] === 'World') return 1;
      if (b[0] === 'World') return -1;
      return b[1].length - a[1].length;
    });
}

/** Parsed JSON content, or null when it is empty or does not parse. */
export function tryParseJson(content) {
  if (!content) return null;
  try { return JSON.parse(content); } catch { return null; }
}
