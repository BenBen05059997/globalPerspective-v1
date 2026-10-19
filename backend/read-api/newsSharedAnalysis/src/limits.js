// Size / count / shape limits for a share request, and the cleaning of everything a reader supplies.
// Nothing here trusts the client: every string is clipped, every URL goes through safeHttpUrl, every count is capped.
import { safeHttpUrl } from './urls.js';

export const MAX_PROSE_BYTES = 32 * 1024;   // total prose across all sections, in BYTES
export const MAX_BODY_BYTES = 200 * 1024;
export const MAX_SECTIONS = 4;
export const MAX_STORIES = 8;
export const MAX_WEB_SOURCES = 20;
export const DAILY_CAP = 20;
export const LENS_IDS = ['scenario', 'whatchanged', 'economic', 'compare', 'freeform'];
export const MODES = ['guided', 'freeform', 'deep'];

const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, n);
const UNSAFE = /<\s*script|javascript\s*:|data\s*:\s*text\/html/i;

export const proseBytes = (sections) => sections.reduce((n, s) => n + Buffer.byteLength(s.prose, 'utf8'), 0);
export const utcDayStart = (nowMs) => new Date(Math.floor(nowMs / 86400000) * 86400000).toISOString();

/** @returns {{ok:true, value:object}|{ok:false, status:number, code:string, message:string}} */
export function checkPayload(body) {
  const bad = (code, message, status = 400) => ({ ok: false, status, code, message });
  if (!body || typeof body !== 'object') return bad('bad_request', 'The request body must be a JSON object.');

  const stories = Array.isArray(body.stories) ? body.stories : null;
  if (!stories || stories.length < 1) return bad('bad_request', 'Pick at least one story.');
  if (stories.length > MAX_STORIES) return bad('too_many_stories', `A share can cover at most ${MAX_STORIES} stories.`);
  const cleanStories = [];
  for (const s of stories) {
    const topicId = clip(s && s.topicId, 200);
    const threadId = s && s.threadId ? clip(s.threadId, 120) : null;
    if (!topicId) return bad('bad_request', 'Every story needs a topicId.');
    if (threadId && !/^thread-[A-Za-z0-9_-]+$/.test(threadId)) return bad('bad_request', 'A threadId is not valid.');
    cleanStories.push({ topicId, threadId });
  }

  const sections = Array.isArray(body.sections) ? body.sections : null;
  if (!sections || sections.length < 1) return bad('bad_request', 'There is nothing to share.');
  if (sections.length > MAX_SECTIONS) return bad('too_many_sections', `A share can hold at most ${MAX_SECTIONS} analyses.`);
  const cleanSections = [];
  for (const sec of sections) {
    const mode = MODES.includes(sec && sec.mode) ? sec.mode : null;
    if (!mode) return bad('bad_request', 'An analysis has an unknown mode.');
    const lensId = sec.lensId == null ? null : String(sec.lensId);
    if (lensId !== null && !LENS_IDS.includes(lensId)) return bad('bad_request', 'An analysis has an unknown lens.');
    if (typeof sec.prose !== 'string' || !sec.prose.trim()) return bad('bad_request', 'An analysis has no text.');
    const prose = sec.prose.normalize('NFC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
    if (UNSAFE.test(prose)) return bad('unsafe_content', 'The text contains markup that is not allowed in a shared analysis.', 422);
    const webSources = (Array.isArray(sec.webSources) ? sec.webSources : []).slice(0, MAX_WEB_SOURCES).map((w, i) => ({
      n: Number.isFinite(w && w.n) ? w.n : i + 1,
      title: clip(w && w.title, 200) || null,
      url: safeHttpUrl(w && w.url), // reader-supplied: http(s) only, else no link (the entry keeps its place so [Wn] numbering holds)
    }));
    cleanSections.push({
      lensId, mode, prose,
      struct: sec.struct && typeof sec.struct === 'object' ? sec.struct : null,
      webSources,
      focus: sec.focus ? clip(sec.focus, 300) : null,
    });
  }
  if (proseBytes(cleanSections) > MAX_PROSE_BYTES) return bad('too_large', `The analysis text is over ${MAX_PROSE_BYTES / 1024} KB.`, 413);

  const citations = Array.isArray(body.citations) ? body.citations.slice(0, 200) : null;
  if (!citations) return bad('bad_request', 'The run\'s numbered sources are missing.');

  const run = {
    provider: clip(body.run && body.run.provider, 60) || null,
    model: clip(body.run && body.run.model, 80) || null,
    runAt: body.run && Number.isFinite(Date.parse(body.run.runAt)) ? new Date(body.run.runAt).toISOString() : null,
  };
  return { ok: true, value: { stories: cleanStories, sections: cleanSections, citations, run } };
}
