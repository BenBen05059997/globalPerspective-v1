// A story view of the record (decisions 0037, 0042) -> the timeline entries the story page has always read from the
// archive (`narrative_thread`), so the page switches source without changing what readers see. Entries only (recovered
// article rows are not shown here yet). Entry notes become `ai` text exactly as the archive stored it: markdown as is,
// json as its text, cut at the archive's 1,500 characters.
import { resolveCountry } from '@/shared/lib/countries.js';

const MAX_AI_CHARS = 1500; // the agent's archive trim (NewsProjectInvokeAgentLambda trimAi)
const AI_FIELD = { summary: 'summary', prediction: 'prediction', cause: 'trace_cause' };

function aiText(note) {
  const text = note.format === 'json' ? JSON.stringify(note.content) : String(note.content ?? '');
  return text.length > MAX_AI_CHARS ? `${text.slice(0, MAX_AI_CHARS)}...` : text;
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

function aiOf(notes) {
  if (!notes) return null;
  const ai = {};
  for (const [part, field] of Object.entries(AI_FIELD)) ai[field] = notes[part] ? aiText(notes[part]) : null;
  return Object.values(ai).some(Boolean) ? ai : null;
}

/** story view -> archive-shaped entries (date ascending, as the view keeps them); [] when the view has none. */
export function viewEntriesToThread(view) {
  const entries = Array.isArray(view?.entries) ? view.entries : [];
  return entries.filter((e) => e.kind !== 'article').map((e) => {
    const iso3 = Array.isArray(e.iso3) ? e.iso3 : [];
    const ai = aiOf(e.notes);
    return {
      topicId: e.topicId ?? null,
      threadId: view.threadId,
      title: e.title,
      date: e.date,
      archivedAt: e.at,
      category: e.category ?? '',
      event_type: e.eventType ?? null,
      iso3,
      regions: iso3.map((c) => resolveCountry(c)?.name).filter(Boolean),
      actors: Array.isArray(e.actors) ? e.actors : [],
      sources: (e.sources || []).map((s) => ({
        title: s.title, url: s.url, source: s.outlet || hostOf(s.url), outletCountry: s.outletCountry ?? null,
        outletType: s.outletType ?? null, ...(s.tier ? { tier: s.tier } : {}), ...(s.snippet ? { snippet: s.snippet } : {}),
      })),
      ...(ai ? { ai } : {}),
      fromRecord: true,
    };
  });
}
