import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGeminiTopics } from '../hooks/useGeminiTopics';
import { useAuth } from '../contexts/AuthContext';
import { getProvider } from '../services/llm';
import { runChat } from '../services/llm';
import { loadByok } from '../utils/byok';
import { useMembership } from '../hooks/useMembership';
import { runMemberAnalysis, analyzeConfigured } from '../services/restProxy';
import { LENSES, SYSTEM_PROMPT, DEEP_SYSTEM_PROMPT, buildAnalysisContext, buildUserMessage } from '../utils/analysis';
import { validateAnalysis } from '../utils/analysisValidator';
import { assessSelection } from '../utils/sourceRobustness';
import ProviderModal from './ProviderModal';
import Markdown from './Markdown';
import './AnalysisStudio.css';

const MAX_STORIES = 4;

export default function AnalysisStudio() {
  const { topics, loading: topicsLoading } = useGeminiTopics();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  // Analysis Studio is a registered-only feature (anonymous guests count as
  // not-registered). This gate is scoped to THIS feature only — it does not touch
  // the public data hooks.
  const isRegistered = Boolean(user && !user.isAnonymous);

  // Members run on OUR compute (no BYOK needed) — that convenience IS the paid product;
  // reading the site stays free. Free registered users keep BYOK. isMember stays false
  // until billing is configured (window.POLAR_BILLING_ENDPOINT), so this is a no-op until
  // go-live. `memberRun` also requires the analyze endpoint to be wired.
  const { isMember, available: billingAvailable } = useMembership();
  const memberRun = isMember && analyzeConfigured();

  const [byok, setByok] = useState(() => loadByok());
  const [modalOpen, setModalOpen] = useState(false);

  const [selected, setSelected] = useState([]); // topicIds
  const [mode, setMode] = useState('guided'); // 'guided' | 'freeform'
  const [lensId, setLensId] = useState(LENSES[0].id);
  const [focus, setFocus] = useState('');
  const [freeform, setFreeform] = useState('');

  const [running, setRunning] = useState(false);
  const [report, setReport] = useState(null);
  const [citations, setCitations] = useState([]);
  const [webSources, setWebSources] = useState([]);
  const [checks, setChecks] = useState(null);
  const [sourceInfo, setSourceInfo] = useState(null);
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

  const selectedTopics = useMemo(
    () => topics.filter((t) => selected.includes(t.topicId || t.id)),
    [topics, selected]
  );

  function toggle(id) {
    setSelected((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= MAX_STORIES) return cur;
      return [...cur, id];
    });
  }

  async function onRun() {
    setError(null);
    if (!isRegistered) return; // the sign-in gate overlay handles this
    const deep = mode === 'deep';
    // Members run guided/free-form on our compute; deep research needs a web-search
    // provider, so it stays BYOK even for members.
    const useServer = memberRun && !deep;
    if (!useServer && !byok) { setModalOpen(true); return; }
    if (selectedTopics.length === 0) { setError('Pick at least one story to analyze.'); return; }

    setRunning(true);
    setReport(null);
    setCitations([]);
    setWebSources([]);
    setChecks(null);
    // Source robustness (L1): is this built on corroborated reporting or a single
    // unverified outlet? Computed client-side from the selected stories' sources.
    setSourceInfo(assessSelection(selectedTopics));
    try {
      const { context, citations: cites, thin } = await buildAnalysisContext(selectedTopics);
      // Thin material only over-reaches in the closed-book modes; deep mode pulls
      // fresh material from the web, so the guard doesn't apply there.
      const thinGuard = thin && !deep;
      const userMsg = buildUserMessage({ context, mode, lensId, focus, freeform, thin: thinGuard });

      let text = '';
      let web = [];
      if (useServer) {
        // Member path: our compute (DeepSeek), server-pinned system prompt + fair-use cap.
        const r = await runMemberAnalysis(userMsg);
        text = r.report;
      } else {
        const r = await runChat({
          provider: byok.provider,
          model: byok.model,
          apiKey: byok.key,
          system: deep ? DEEP_SYSTEM_PROMPT : SYSTEM_PROMPT,
          user: userMsg,
          webResearch: deep,
          maxTokens: deep ? 3000 : 1600,
        });
        text = r.text;
        web = r.webSources || [];
      }
      setReport(text);
      setCitations(cites);
      setWebSources(web);
      // Enforce the honesty guardrails on what actually came back (the prompt only
      // asks; this verifies). In deep mode the web legitimately introduces figures
      // beyond our material, so the invented-figure check (context) is skipped —
      // phantom [n] citations are still checked.
      setChecks(validateAnalysis(text, deep
        ? { citations: cites }
        : { citations: cites, context, thinInput: thinGuard }));
    } catch (err) {
      if (err?.code === 'daily_limit') setError(`You've reached today's analysis limit${err.limit ? ` (${err.limit})` : ''}. It resets tomorrow.`);
      else if (err?.code === 'membership_required') setError('This run needs an active membership.');
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
            {memberRun ? 'Included with your membership — no API key needed.' : 'Runs on your own API key.'}
          </p>
        </div>
        <button className="as-model-chip" onClick={() => setModalOpen(true)} title="Choose provider / model / key">
          <span className="as-chip-dot" />
          {memberRun && !byok ? 'Member · included' : modelChip}
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
                {LENSES.map((l) => (
                  <button
                    key={l.id}
                    className={`as-lens${lensId === l.id ? ' on' : ''}`}
                    onClick={() => setLensId(l.id)}
                  >
                    <span className="as-lens-label">{l.label}</span>
                    <span className="as-lens-blurb">{l.blurb}</span>
                  </button>
                ))}
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

          <button className="as-run" onClick={onRun} disabled={running}>
            {running ? 'Analyzing…' : 'Run analysis'}
          </button>
          {memberRun ? (
            <div className="as-hint">Included with your membership — no API key needed.</div>
          ) : !byok ? (
            <div className="as-hint">You'll be asked to choose a model + paste your API key first.</div>
          ) : null}
          {!memberRun && billingAvailable && (
            <div className="as-hint">
              Don't want to manage an API key?{' '}
              <button className="as-link-btn" onClick={() => navigate('/membership')}>Run it on us with a membership →</button>
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

      {/* Result */}
      {(running || report) && (
        <section className="as-result">
          <div className="as-panel-head">
            <h2>Analysis</h2>
            {report && !running && (
              <button className="as-rerun" onClick={onRun}>Run again</button>
            )}
          </div>
          {running ? (
            <div className="as-muted">Running on {memberRun && mode !== 'deep' ? 'Global Perspectives AI' : modelChip}…</div>
          ) : (
            <>
              {sourceInfo && sourceInfo.total > 0 && (
                <div className={`as-srcbasis${sourceInfo.severity === 'warn' ? ' warn' : ''}`}>
                  <span className="as-check-dot" aria-hidden />
                  <span><strong>Source basis:</strong> {sourceInfo.message}</span>
                </div>
              )}
              {checks && checks.warnings.length > 0 && (
                <div className={`as-checks${checks.hasError ? ' err' : ''}`}>
                  <div className="as-checks-head">
                    {checks.hasError
                      ? 'Guardrail check flagged a problem in this output'
                      : 'Guardrail check — please verify the flagged items'}
                  </div>
                  <ul>
                    {checks.warnings.map((w, i) => (
                      <li key={i} className={`sev-${w.severity}`}>
                        <span className="as-check-dot" aria-hidden />
                        {w.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {checks && checks.ok && (
                <div className="as-checks ok">
                  <span className="as-check-dot" aria-hidden />
                  Guardrail check passed — every source cited exists and no unsupported figures were detected.
                </div>
              )}
              <Markdown text={report} className="as-md" />
              {webSources.length > 0 && (
                <div className="as-cites">
                  <div className="label">Web sources (model-retrieved)</div>
                  <ol>
                    {webSources.map((w) => (
                      <li key={w.url}>
                        <a href={w.url} target="_blank" rel="noopener noreferrer">{w.title}</a>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {citations.length > 0 && (
                <div className="as-cites">
                  <div className="label">Sources</div>
                  <ol>
                    {citations.map((c) => (
                      <li key={c.n}>
                        <span className="as-cite-title">{c.title}</span>
                        {c.regions && <span className="as-cite-meta"> — {c.regions}</span>}
                        {c.sources?.length > 0 && (
                          <span className="as-cite-links">
                            {c.sources.slice(0, 4).map((u, i) => (
                              <a key={i} href={u} target="_blank" rel="noopener noreferrer">link{c.sources.length > 1 ? ` ${i + 1}` : ''}</a>
                            ))}
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <p className="as-disclaimer">
                Generated by {memberRun && webSources.length === 0 ? 'Global Perspectives AI' : 'your chosen model'} from our story data
                {webSources.length > 0 && ' plus model-retrieved web sources (not verified by our pipeline)'}.
                Treat as analyst input, not fact — verify load-bearing claims against the linked sources.
              </p>
            </>
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
