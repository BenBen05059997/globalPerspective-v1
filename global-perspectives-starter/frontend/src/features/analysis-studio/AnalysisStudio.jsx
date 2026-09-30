import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGeminiTopics } from '@/shared/data/useGeminiTopics';
import { useAuth } from '@/shared/contexts/AuthContext';
import { useWeeklyArchive } from '@/features/threads/hooks/useWeeklyArchive';
import { getProvider } from '@/features/analysis-studio/lib/llm';
import { runChat } from '@/features/analysis-studio/lib/llm';
import { loadByok } from '@/features/analysis-studio/lib/byok';
import { useMembership } from '@/features/account/hooks/useMembership';
import { runMemberAnalysis, analyzeConfigured, fetchThreadAnalyses, fetchCountryHistory } from '@/shared/api/restProxy';
import { reportFetchError } from '@/shared/api/errorSink';
import { iso3ForName } from '@/features/map/lib/situationLabels.js';
import { buildCountryRiskSeries, buildCountryChangeLog } from '@/features/analysis-studio/lib/countryDriftPicture';
import { LENSES, SYSTEM_PROMPT, DEEP_SYSTEM_PROMPT, buildAnalysisContext, buildUserMessage } from '@/features/analysis-studio/lib/analysis';
import { SOURCE_KIND_LABELS } from '@/features/analysis-studio/lib/analysisPrompt';
import { buildEarlierStoryList } from '@/features/analysis-studio/lib/earlierStories';
import ShareControl from '@/features/analysis-studio/components/ShareControl.jsx';
import SignedOutExample from '@/features/analysis-studio/components/SignedOutExample.jsx';
import { validateAnalysis } from '@/features/analysis-studio/lib/analysisValidator';
import { extractStruct, validateStruct } from '@/features/analysis-studio/lib/analysisStruct';
import { assessSelection } from '@/features/analysis-studio/lib/sourceRobustness';
import { renumberWebCitations } from '@/features/analysis-studio/lib/webCitations';
import { buildQuote } from '@/features/analysis-studio/lib/quote';
import { dropUnbackedPlaces, classifyPlaces } from '@/features/analysis-studio/lib/oursVsRun';
import { buildScenarioBands } from '@/features/analysis-studio/lib/scenarioBands';
import { buildComparePicture } from '@/features/analysis-studio/lib/comparePicture';
import { sentenceCitations } from '@/features/analysis-studio/lib/freeformPicture';
import { addSection } from '@/features/analysis-studio/lib/deckStack';
import ProviderModal from '@/features/analysis-studio/components/ProviderModal';
import StudioDeck from '@/features/analysis-studio/components/StudioDeck';
import { useIsPhone } from '@/shared/hooks/useIsPhone';
import '@/features/analysis-studio/AnalysisStudio.css';

const MAX_STORIES = 4;

// S5c F1 §2 "one picture per lens" — builds the picture data for the just-finished run
// from already-sanitized inputs only (never raw model text). `whatchanged` calls the REAL
// `country_history` proxy action for whichever of the selected stories' regions resolve to
// an actual country (iso3ForName — a macro-region like "East Asia" has no history to fetch
// and is silently skipped, never faked); async because of that fetch.
async function buildLensPicture(lensId, { struct, selectedTopics, citations, prose, today }) {
  if (!lensId) return null;
  const sourceRegions = [...new Set(
    (selectedTopics || []).flatMap((t) => (Array.isArray(t.regions) ? t.regions : []))
  )];

  if (lensId === 'scenario') {
    const scenarios = struct?.scenarios || [];
    if (scenarios.length === 0) return null;
    const { scenarios: kept, dropped } = dropUnbackedPlaces(scenarios, sourceRegions);
    const { bands, undated } = buildScenarioBands(kept, today);
    const allPlaces = kept.flatMap((s) => s.places || []);
    const { ours } = classifyPlaces(allPlaces, sourceRegions);
    return { kind: 'scenario', data: { bands, undated }, oursVsRun: (ours.length || dropped.length) ? { ours, runOnly: [], dropped } : null };
  }
  if (lensId === 'compare') {
    const picture = buildComparePicture(selectedTopics, citations);
    return {
      kind: 'compare',
      data: picture,
      oursVsRun: picture.sharedPlaces.length ? { ours: picture.sharedPlaces, runOnly: [], dropped: [] } : null,
    };
  }
  if (lensId === 'whatchanged') {
    // Only names that resolve to a real country (iso3ForName) are fetchable — a macro-region
    // ("East Asia") or a body of water names no country_history record and is skipped, not faked.
    const countryNames = [...new Set(sourceRegions.filter((r) => iso3ForName(r)))];
    const countries = await Promise.all(countryNames.map(async (name) => {
      try {
        const res = await fetchCountryHistory(name);
        if (!res?.success) return { name, series: { points: [], gaps: [] }, changeLog: [] };
        return {
          name,
          series: buildCountryRiskSeries(res.snapshots),
          changeLog: buildCountryChangeLog(res.driftNotes),
        };
      } catch (err) {
        reportFetchError('analysis-studio-whatchanged-country-history', err);
        return { name, series: { points: [], gaps: [] }, changeLog: [] };
      }
    }));
    return { kind: 'whatchanged', data: { countries }, oursVsRun: null };
  }
  if (lensId === 'freeform') {
    return { kind: 'freeform', data: { sentences: sentenceCitations(prose) }, oursVsRun: null };
  }
  return null;
}

export default function AnalysisStudio() {
  useEffect(() => { document.title = 'Analysis Studio | Global Perspectives'; }, []);
  const { topics, loading: topicsLoading } = useGeminiTopics();
  // D2's whole point is "every story analysable, not only today's ~17" — the picker must
  // actually offer stories beyond today, or D2's feed never gets exercised by a real
  // selection. `useWeeklyArchive` is the same 30-day, 30-min-cached hook /weekly already
  // uses (fetchArchiveRange, lightweight entries — no heavy AI fields, 6MB-safe).
  const { dayMap: archiveDayMap, loading: archiveLoading, error: archiveError } = useWeeklyArchive();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Analysis Studio is a registered-only feature (anonymous guests count as
  // not-registered). This gate is scoped to THIS feature only — it does not touch
  // the public data hooks.
  const isRegistered = Boolean(user && !user.isAnonymous);

  // Running on OUR compute (no BYOK) is paid for by a member's monthly allowance OR by
  // purchased credits — so any signed-in user with an allowance or a credit balance can use
  // it. Free users with their own key keep BYOK (free). All gated behind the analyze endpoint
  // being wired, so this is a no-op until go-live.
  const { isMember, creditBalance, refresh: refreshMembership } = useMembership();
  const serverCapable = analyzeConfigured() && (isMember || creditBalance > 0);

  // A previously-saved byok record whose provider id no longer exists (e.g. a
  // retired provider like OpenRouter) must not silently misbehave — treat it as
  // "no valid key" so the normal choose-a-model flow (ProviderModal) picks up.
  const [byok, setByok] = useState(() => {
    const saved = loadByok();
    return saved && getProvider(saved.provider) ? saved : null;
  });
  const [modalOpen, setModalOpen] = useState(false);

  const [selected, setSelected] = useState([]); // topicIds
  // Earlier stories the reader picked (last 30 days) — kept independent of the current
  // search filter so a selected row is never dropped from `selectedTopics` just because
  // it scrolled out of view or no longer matches the search box.
  const [pickedEarlier, setPickedEarlier] = useState({}); // { [topicId]: rowObject }
  const [earlierQuery, setEarlierQuery] = useState('');
  const [earlierPreview, setEarlierPreview] = useState({}); // { [threadId]: 'RICH'|'THIN' }
  const didSeedFromParams = useRef(false);
  const [mode, setMode] = useState('guided'); // 'guided' | 'freeform'
  const [lensId, setLensId] = useState(LENSES[0].id);
  // Guard: a stale/deep-linked lensId that no longer matches a LENSES entry
  // (e.g. a lens removed in a later prune) must never render/run as a broken
  // or empty lens — fall back to the safest default instead. Also covers
  // 'compare' becoming invalid if the selection drops below 2 stories.
  const activeLensId =
    LENSES.some((l) => l.id === lensId) && !(lensId === 'compare' && selected.length < 2)
      ? lensId
      : 'scenario';
  const [focus, setFocus] = useState('');
  const [freeform, setFreeform] = useState('');

  const [running, setRunning] = useState(false);
  const isPhone = useIsPhone();
  // S5c F2 "+ Add analysis": a case is one frozen selection; each successful run on that
  // SAME selection stacks a new SECTION here (deckStack.js) — never replaces the last one.
  // `expandedFailed` is per-section ("show anyway" — S5's gate must not leak across runs).
  const [sections, setSections] = useState([]);
  const [expandedFailed, setExpandedFailed] = useState({});
  const [deckView, setDeckView] = useState('deck'); // 'deck' | 'text' | 'board' — F3, desktop only
  const nextSectionId = useRef(0);
  // The reader-pays "quote before the run" (D2 stored-data feed + typed sources —
  // TRACK_RECORD_AND_STUDIO_RULING.md, S5b). Recomputed whenever the selection or the
  // model/path that would run changes. `contextCache` remembers the last computed
  // context (keyed by selection) so onRun reuses it instead of re-fetching everything
  // a second time when the reader hits Run right after the quote settled.
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const contextCache = useRef({ key: null, promise: null, data: null });
  const [error, setError] = useState(null);

  const provider = byok ? getProvider(byok.provider) : null;
  const modelChip = byok ? `${provider?.label || byok.provider} · ${byok.model}` : 'Choose model';
  // Deep research needs an API that actually searches the web (Perplexity native,
  // Anthropic via its web_search tool). For others the mode is disabled with an
  // honest reason — a "search the web" prompt to a no-search API fakes its sources.
  const canDeepResearch = !byok || Boolean(provider?.webSearch);

  // A wrong/expired key surfaces as a 401/403/auth error from the provider — point
  // the user straight at the key editor (the #1 fix is changing the key).
  const looksLikeKeyError = Boolean(error) && /401|403|invalid|unauthor|api key|authentication/i.test(error);

  // Block the whole feature for non-registered users (anonymous guests included).
  const blocked = !authLoading && !isRegistered;

  // Today's topics ∪ any earlier (last-30-days) story ever picked — so a selection built
  // from EITHER picker section resolves correctly, regardless of the earlier list's
  // current search filter (see `pickedEarlier` above).
  const allKnownStories = useMemo(() => {
    const map = new Map();
    topics.forEach((t) => map.set(t.topicId || t.id, t));
    Object.values(pickedEarlier).forEach((r) => map.set(r.topicId, r));
    return map;
  }, [topics, pickedEarlier]);
  const selectedTopics = useMemo(
    () => selected.map((id) => allKnownStories.get(id)).filter(Boolean),
    [selected, allKnownStories]
  );
  const selectionKey = selected.slice().sort().join(',');

  // The earlier-stories list itself (today's topicIds excluded so nothing is offered
  // twice), filtered live by the search box.
  const todayTopicIds = useMemo(() => new Set(topics.map((t) => t.topicId || t.id)), [topics]);
  const earlierRows = useMemo(
    () => buildEarlierStoryList(archiveDayMap, { excludeTopicIds: todayTopicIds, query: earlierQuery }),
    [archiveDayMap, todayTopicIds, earlierQuery]
  );
  const EARLIER_DISPLAY_CAP = 40;
  const earlierDisplayed = earlierRows.slice(0, EARLIER_DISPLAY_CAP);

  // RICH/THIN PREVIEW for the earlier list — a lightweight, honestly-partial check (one
  // batched `thread_analysis` call, capped like the action itself at 20 ids) so scrolling
  // hundreds of archive days never fires hundreds of requests. This only reflects stored
  // ANALYSIS/DRIFT — the FORECAST snapshot (also RICH-qualifying) is checked only once a
  // story is actually selected and the real quote runs, so a "THIN" preview can still turn
  // RICH on selection. That gap is intentional and cheap; label it honestly, never silently.
  const previewKey = earlierDisplayed.slice(0, 20).map((r) => r.threadId).join(',');
  useEffect(() => {
    const ids = previewKey ? previewKey.split(',') : [];
    const unknown = ids.filter((id) => !(id in earlierPreview));
    if (unknown.length === 0) return undefined;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetchThreadAnalyses(unknown);
        if (cancelled) return;
        setEarlierPreview((prev) => {
          const next = { ...prev };
          for (const id of unknown) {
            const rec = res?.data?.[id];
            next[id] = rec && (rec.trajectory || rec.driftNote) ? 'RICH' : 'THIN';
          }
          return next;
        });
      } catch (err) {
        reportFetchError('analysis-studio-earlier-preview', err);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [previewKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleEarlier(row) {
    setPickedEarlier((p) => ({ ...p, [row.topicId]: row }));
    toggle(row.topicId);
  }

  // Which path a run right now would actually take (mirrors onRun's own logic) — the
  // quote must describe THIS run, not a generic one. Deep research always stays BYOK
  // (needs a web-search-capable key).
  const wouldUseServer = serverCapable && mode !== 'deep' && (isMember || !byok);
  const quoteModel = wouldUseServer ? null : (byok ? byok.model : null);
  const quoteMaxOutputTokens = wouldUseServer ? null : (mode === 'deep' ? 3000 : 2400);

  // Fetch + build the numbered typed-source context for the CURRENT selection, reusing
  // the in-flight/last result when the selection hasn't changed since (onRun calls this
  // too, so a reader who hits Run right after the quote settles never double-fetches).
  const getContext = useCallback((key, topicsForKey) => {
    const cache = contextCache.current;
    if (cache.key === key && (cache.promise || cache.data)) {
      return cache.promise || Promise.resolve(cache.data);
    }
    const promise = buildAnalysisContext(topicsForKey).then((data) => {
      contextCache.current = { key, promise: null, data };
      return data;
    });
    contextCache.current = { key, promise, data: null };
    return promise;
  }, []);

  // Quote before the run — recomputed live as the selection (or the path/model that
  // would run) changes. A failed fetch here fails empty (quote clears) rather than
  // showing a stale or invented figure.
  useEffect(() => {
    let cancelled = false;
    if (selectedTopics.length === 0) { setQuote(null); setQuoteLoading(false); return undefined; }
    setQuoteLoading(true);
    getContext(selectionKey, selectedTopics)
      .then((ctx) => {
        if (cancelled) return;
        setQuote(buildQuote({
          perStory: ctx.perStory,
          totalChars: ctx.totalChars,
          model: quoteModel,
          maxOutputTokens: quoteMaxOutputTokens,
          memberPath: wouldUseServer,
        }));
      })
      .catch(() => { if (!cancelled) setQuote(null); })
      .finally(() => { if (!cancelled) setQuoteLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey, wouldUseServer, quoteModel, quoteMaxOutputTokens]);

  useEffect(() => {
    if (didSeedFromParams.current) return;
    if (topicsLoading || topics.length === 0) return;
    didSeedFromParams.current = true;
    const raw = searchParams.get('stories');
    if (!raw) return;
    const requested = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (requested.length === 0) return;
    const known = new Set(topics.map((t) => t.topicId || t.id));
    const valid = requested.filter((id) => known.has(id)).slice(0, MAX_STORIES);
    if (valid.length > 0) setSelected(valid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicsLoading, topics]);

  function toggle(id) {
    setSelected((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= MAX_STORIES) return cur;
      return [...cur, id];
    });
  }

  // Per-section "show anyway" (never global — a fresh section never inherits a
  // previous run's expanded state; S5's shareability gate is per-run).
  function handleShowAnyway(sectionId) {
    setExpandedFailed((prev) => ({ ...prev, [sectionId]: true }));
  }

  async function onRun() {
    setError(null);
    if (!isRegistered) return; // the sign-in gate overlay handles this
    const deep = mode === 'deep';
    // Server (our-compute) path for guided/free-form: members spend allowance-then-credits,
    // non-members spend credits — but a non-member who has their own key keeps BYOK (free).
    // Deep research needs a web-search provider, so it stays BYOK for everyone.
    const useServer = serverCapable && !deep && (isMember || !byok);
    if (!useServer && !byok) { setModalOpen(true); return; }
    if (selectedTopics.length === 0) { setError('Pick at least one story to analyze.'); return; }

    setRunning(true);
    // Source robustness (L1): is this built on corroborated reporting or a single
    // unverified outlet? Computed client-side from the selected stories' sources.
    const sourceInfo = assessSelection(selectedTopics);
    const startedAt = Date.now();
    try {
      // Reuse the context the quote already fetched for this exact selection — the
      // quote effect above keys the same cache, so a reader who hits Run right after
      // the quote settles never triggers a second round of fetches.
      const { context, citations: cites, thin } = await getContext(selectionKey, selectedTopics);
      // Thin material only over-reaches in the closed-book modes; deep mode pulls
      // fresh material from the web, so the guard doesn't apply there.
      const thinGuard = thin && !deep;
      const userMsg = buildUserMessage({ context, mode, lensId: activeLensId, focus, freeform, thin: thinGuard });
      // The Scenario / Economic-ripple guided lenses hard-require a closing
      // ```gp-struct``` block (analysisPrompt.js) — the validator's structural/
      // schema-failure check only applies there (deep and free-form never promise one).
      const lensRequiresStruct = mode === 'guided' && !deep
        && Boolean(LENSES.find((l) => l.id === activeLensId)?.requiresStruct);

      let text = '';
      let web = [];
      let runUsage = null;
      if (useServer) {
        // Our-compute path (DeepSeek), server-pinned system prompt; paid by allowance/credit.
        const r = await runMemberAnalysis(userMsg);
        text = r.report;
        // Reflect the spent credit / used allowance in the chip + nudges.
        if (refreshMembership) refreshMembership();
      } else {
        const r = await runChat({
          provider: byok.provider,
          model: byok.model,
          apiKey: byok.key,
          baseUrl: byok.baseUrl,
          system: deep ? DEEP_SYSTEM_PROMPT : SYSTEM_PROMPT,
          user: userMsg,
          webResearch: deep,
          // 1600 → 2400: the P1/P2 structure (Key judgments + indicators table +
          // gp-struct block) adds real output length — at 1600 the block, which
          // comes last, gets truncated mid-JSON (seen live 2026-07-10).
          maxTokens: deep ? 3000 : 2400,
        });
        text = r.text;
        // Perplexity's `sonar` models write their OWN [n] markers against THEIR
        // search results, natively, regardless of what our prompt asks for — those
        // numbers must never be read as our story numbers (D3 fix; webCitations.js).
        // Other web-search providers (Anthropic's tool) are prompted to use [Wn]
        // directly, so nothing needs rewriting for them.
        const nativeNumbering = deep && byok.provider === 'perplexity';
        const renumbered = renumberWebCitations(text, r.webSources || [], { nativeNumbering });
        text = renumbered.text;
        web = renumbered.webSources;
        runUsage = r.usage || null;
      }
      // Pull out the optional ```gp-struct``` block (guided scenario/economic lenses
      // only) BEFORE anything else touches the text: the validator and <Markdown>
      // must only ever see the stripped prose — the raw JSON's bare numbers would
      // false-trigger the invented_figure check, and it isn't meant to render as prose.
      const { struct: rawStruct, prose } = extractStruct(text);
      const sanitizedStruct = validateStruct(rawStruct, prose);
      // Enforce the honesty guardrails on what actually came back (the prompt only
      // asks; this verifies). In deep mode the web legitimately introduces figures
      // beyond our material, so the invented-figure check (context) is skipped —
      // phantom [n]/[Wn] citations and the structural check still run.
      const runChecks = validateAnalysis(prose, deep
        ? { citations: cites, webSources: web }
        : { citations: cites, context, thinInput: thinGuard, webSources: web, requiresStruct: lensRequiresStruct, structOk: Boolean(sanitizedStruct) });

      // S5c F2: stack this run as a new section of the same case — never replace the
      // last one. `effectiveLensId` maps mode+lens onto the 4 launch lenses (deep
      // research is a separate toggle, not one of them, so it gets no picture).
      const effectiveLensId = deep ? null : mode === 'freeform' ? 'freeform' : activeLensId;
      const lensLabel = deep ? 'Deep research' : mode === 'freeform' ? 'Free-form' : (LENSES.find((l) => l.id === activeLensId)?.label || activeLensId);
      const today = new Date().toISOString().slice(0, 10);
      const picture = await buildLensPicture(effectiveLensId, { struct: sanitizedStruct, selectedTopics, citations: cites, prose, today });
      const timeDates = [
        ...cites.map((c) => c.date).filter(Boolean),
        ...(sanitizedStruct?.scenarios || []).map((s) => s.by).filter(Boolean),
      ];

      nextSectionId.current += 1;
      const section = {
        id: nextSectionId.current,
        lensId: effectiveLensId,
        lensLabel,
        mode,
        report: prose,
        citations: cites,
        webSources: web,
        checks: runChecks,
        struct: sanitizedStruct,
        sourceInfo,
        ranOnServer: useServer,
        usage: runUsage,
        elapsedMs: Date.now() - startedAt,
        byokModel: byok?.model || null,
        picture,
        timeDates,
        today,
        createdAt: new Date().toISOString(),
      };
      setSections((prev) => addSection(prev, section));
    } catch (err) {
      if (err?.code === 'out_of_credits') setError("You're out of analysis credits, and any monthly allowance is used up. Add credits or subscribe to keep analyzing.");
      else setError(err?.message || 'Analysis failed.');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="as-page">
      <header className="as-head">
        <div>
          <div className="label">Analysis Studio · beta</div>
          <h1>Analyze the news yourself</h1>
          <p className="as-sub">
            Pick the stories you care about, choose a lens or ask your own question, and get a
            cited deep-dive built from our intelligence.{' '}
            {isMember && serverCapable
              ? 'Included with your membership — no API key needed.'
              : 'Studio runs on your own API key.'}
          </p>
        </div>
        <button className="as-model-chip" onClick={() => setModalOpen(true)} title="Choose provider / model / key">
          <span className="as-chip-dot" />
          {serverCapable && !byok ? (isMember ? 'Member · included' : `Credits · ${creditBalance}`) : modelChip}
          <span className="as-chip-caret">▾</span>
        </button>
      </header>

      <div className="as-grid">
        {/* Step 1 — pick stories */}
        <section className="as-panel">
          <div className="as-panel-head">
            <h2>1 · Select stories</h2>
            <span className="as-count">{selected.length}/{MAX_STORIES}</span>
          </div>
          {topicsLoading && topics.length === 0 ? (
            <div className="as-muted">Loading today's stories…</div>
          ) : topics.length === 0 ? (
            <div className="as-muted">No stories available right now.</div>
          ) : (
            <ul className="as-stories">
              {topics.map((t) => {
                const id = t.topicId || t.id;
                const on = selected.includes(id);
                const full = !on && selected.length >= MAX_STORIES;
                return (
                  <li key={id}>
                    <button
                      className={`as-story${on ? ' on' : ''}`}
                      onClick={() => toggle(id)}
                      disabled={full}
                      title={full ? `Max ${MAX_STORIES} stories` : undefined}
                    >
                      <span className="as-check" aria-hidden>{on ? '✓' : ''}</span>
                      <span className="as-story-body">
                        <span className="as-story-title">{t.title}</span>
                        <span className="as-story-meta">
                          {t.category || '—'}
                          {Array.isArray(t.regions) && t.regions.length > 0 && ` · ${t.regions.slice(0, 3).join(', ')}`}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="as-earlier">
            <div className="as-earlier-head">Earlier stories (last 30 days)</div>
            <input
              className="as-input as-earlier-search"
              placeholder="Search earlier stories…"
              value={earlierQuery}
              onChange={(e) => setEarlierQuery(e.target.value)}
            />
            {archiveLoading && earlierRows.length === 0 ? (
              <div className="as-muted">Loading the last 30 days…</div>
            ) : archiveError ? (
              <div className="as-muted">Couldn't load earlier stories.</div>
            ) : earlierRows.length === 0 ? (
              <div className="as-muted">{earlierQuery ? 'No matches.' : 'Nothing else stored in the last 30 days.'}</div>
            ) : (
              <>
                <ul className="as-stories as-earlier-list">
                  {earlierDisplayed.map((row) => {
                    const id = row.topicId;
                    const on = selected.includes(id);
                    const full = !on && selected.length >= MAX_STORIES;
                    const badge = earlierPreview[row.threadId];
                    return (
                      <li key={id}>
                        <button
                          className={`as-story${on ? ' on' : ''}`}
                          onClick={() => toggleEarlier(row)}
                          disabled={full}
                          title={full ? `Max ${MAX_STORIES} stories` : undefined}
                        >
                          <span className="as-check" aria-hidden>{on ? '✓' : ''}</span>
                          <span className="as-story-body">
                            <span className="as-story-title">{row.title}</span>
                            <span className="as-story-meta">
                              {row.date}
                              {row.category && ` · ${row.category}`}
                              {Array.isArray(row.regions) && row.regions.length > 0 && ` · ${row.regions.slice(0, 3).join(', ')}`}
                            </span>
                          </span>
                          {badge && <span className={`as-richness ${badge === 'RICH' ? 'rich' : 'thin'}`}>{badge}</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {earlierRows.length > earlierDisplayed.length && (
                  <div className="as-muted as-earlier-more">{earlierRows.length - earlierDisplayed.length} more — refine your search.</div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Step 2 — choose mode */}
        <section className="as-panel">
          <div className="as-panel-head">
            <h2>2 · Choose your analysis</h2>
          </div>

          <div className="as-modes">
            <button className={`as-mode${mode === 'guided' ? ' on' : ''}`} onClick={() => setMode('guided')}>
              Guided lens
            </button>
            <button className={`as-mode${mode === 'freeform' ? ' on' : ''}`} onClick={() => setMode('freeform')}>
              Free-form
            </button>
            <button
              className={`as-mode${mode === 'deep' ? ' on' : ''}`}
              onClick={() => canDeepResearch && setMode('deep')}
              disabled={!canDeepResearch}
              title={canDeepResearch
                ? 'The model searches the web for extra reporting on your stories'
                : `${provider?.label || 'This provider'}'s API can't search the web — choose Perplexity or Anthropic`}
            >
              Deep research <span className="as-mode-tag">web</span>
            </button>
          </div>

          {mode === 'deep' ? (
            <>
              <p className="as-deep-note">
                Our stories seed a real web search ({provider?.webSearch === 'always'
                  ? 'built into this model'
                  : 'via the provider’s search tool'}) — the model gathers current reporting,
                then writes: what happened · why · what might happen next · who’s affected.
              </p>
              <textarea
                className="as-textarea"
                placeholder="Optional focus — e.g. 'emphasize the energy supply angle' (leave empty for the full deep analysis)"
                value={freeform}
                onChange={(e) => setFreeform(e.target.value)}
                rows={3}
              />
            </>
          ) : mode === 'guided' ? (
            <>
              <div className="as-lenses">
                {LENSES.filter((l) => !l.hidden).map((l) => {
                  // Compare is meaningless with a single story — gate it on 2+ selected.
                  const compareDisabled = l.id === 'compare' && selected.length < 2;
                  return (
                    <button
                      key={l.id}
                      className={`as-lens${activeLensId === l.id ? ' on' : ''}`}
                      onClick={() => setLensId(l.id)}
                      disabled={compareDisabled}
                      title={compareDisabled ? 'Select 2+ stories to compare them' : undefined}
                    >
                      <span className="as-lens-label">{l.label}</span>
                      <span className="as-lens-blurb">{l.blurb}</span>
                    </button>
                  );
                })}
              </div>
              <input
                className="as-input"
                placeholder="Optional focus (e.g. 'emphasize the energy angle')"
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
              />
            </>
          ) : (
            <textarea
              className="as-textarea"
              placeholder="Ask anything about the selected stories — e.g. 'What would a ceasefire mean for oil and for European gas?' Answers stay grounded in (and cited to) your selected stories."
              value={freeform}
              onChange={(e) => setFreeform(e.target.value)}
              rows={5}
            />
          )}

          {selectedTopics.length > 0 && (
            <div className="as-quote" aria-live="polite">
              <div className="as-quote-head">What this run sends</div>
              {quoteLoading && !quote ? (
                <div className="as-muted">Checking what's stored for these stories…</div>
              ) : quote ? (
                <>
                  <ul className="as-quote-stories">
                    {quote.perStory.map((p, i) => (
                      <li key={i}>
                        <span className={`as-richness ${p.richness === 'RICH' ? 'rich' : 'thin'}`}>{p.richness}</span>
                        <span className="as-quote-story-title">{p.title}</span>
                        <span className="as-quote-story-counts">
                          {Object.entries(p.counts).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${SOURCE_KIND_LABELS[k] || k}`).join(' · ') || 'no stored material'}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <ul className="as-quote-lines">
                    {quote.lines.map((l, i) => <li key={i}>{l}</li>)}
                  </ul>
                </>
              ) : null}
            </div>
          )}

          <button className="as-run" onClick={onRun} disabled={running}>
            {running ? 'Analyzing…' : sections.length > 0 ? '+ Add analysis' : 'Run analysis'}
          </button>
          {sections.length > 0 && !running && (
            <div className="as-hint">Runs another lens on the same frozen sources — no new fetch.</div>
          )}
          {isMember && serverCapable ? (
            <div className="as-hint">Included with your membership — no API key needed.</div>
          ) : !byok ? (
            <div className="as-hint">Studio runs on your own API key — you'll be asked to choose a model + paste it first.</div>
          ) : null}
          {/* Credits are parked (S5a removed the credit copy only); the membership pointer stays.
              "Country change-alerts" was dropped from it: the drift-email cron is off (R2). */}
          {!isMember && (
            <div className="as-hint">
              Don't want to manage an API key? A <strong>membership</strong> includes Studio runs plus the
              full self-correction history.{' '}
              <button className="as-link-btn" onClick={() => navigate('/membership')}>See membership →</button>
            </div>
          )}
          {error && (
            <div className="as-error">
              <div>{error}</div>
              {looksLikeKeyError && (
                <div className="as-error-actions">
                  This usually means the API key is wrong or expired.
                  <button className="as-link-btn" onClick={() => setModalOpen(true)}>Change API key</button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Result — S5c: a case's runs stack here (F2), with a DECK|BOARD toggle (F3,
          desktop) / READ·MAP·LOG tabs (phone, P1). StudioRunResult renders each section
          with the exact markup/classes a single run has always used (S5a/S5b). */}
      {(running || sections.length > 0) && (
        <section className="as-result">
          <div className="as-panel-head">
            <h2>Analysis</h2>
          </div>
          {!running && sections.length > 0 && <ShareControl sections={sections} selectedTopics={selectedTopics} byok={byok} />}
          {running && (
            <div className="as-muted">Running on {serverCapable && mode !== 'deep' && (isMember || !byok) ? 'Global Perspectives AI' : modelChip}…</div>
          )}
          {!running && sections.length > 0 && (
            <StudioDeck
              sections={sections}
              view={deckView}
              onToggleView={setDeckView}
              expandedFailed={expandedFailed}
              onShowAnyway={handleShowAnyway}
              phone={isPhone}
              category={selectedTopics[0]?.category}
            />
          )}
        </section>
      )}

      {modalOpen && (
        <ProviderModal
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            const next = loadByok();
            setByok(next);
            // If they switched to a provider that can't search, drop out of deep mode.
            if (mode === 'deep' && next && !getProvider(next.provider)?.webSearch) setMode('guided');
          }}
        />
      )}

      {blocked && (
        <div className="as-gate" role="dialog" aria-modal="true" aria-label="Sign in required">
          <div className="as-gate-card">
            <div className="label">Analysis Studio</div>
            <h2>Sign in to analyze</h2>
            <p>
              Analysis Studio is available to registered accounts. Sign in (free) to pick
              stories and run your own cited analysis.
            </p>
            <SignedOutExample />
            <div className="as-gate-actions">
              <button className="as-run" onClick={() => navigate('/signin')}>Sign in</button>
              <button className="as-gate-back" onClick={() => navigate('/')}>Back to home</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
