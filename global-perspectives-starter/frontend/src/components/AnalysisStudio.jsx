import { useMemo, useState } from 'react';
import { useGeminiTopics } from '../hooks/useGeminiTopics';
import { getProvider } from '../services/llm';
import { runChat } from '../services/llm';
import { loadByok } from '../utils/byok';
import { LENSES, SYSTEM_PROMPT, buildAnalysisContext, buildUserMessage } from '../utils/analysis';
import ProviderModal from './ProviderModal';
import Markdown from './Markdown';
import './AnalysisStudio.css';

const MAX_STORIES = 4;

export default function AnalysisStudio() {
  const { topics, loading: topicsLoading } = useGeminiTopics();

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
  const [error, setError] = useState(null);

  const provider = byok ? getProvider(byok.provider) : null;
  const modelChip = byok ? `${provider?.label || byok.provider} · ${byok.model}` : 'Choose model';

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
    if (!byok) { setModalOpen(true); return; }
    if (selectedTopics.length === 0) { setError('Pick at least one story to analyze.'); return; }

    setRunning(true);
    setReport(null);
    setCitations([]);
    try {
      const { context, citations: cites } = await buildAnalysisContext(selectedTopics);
      const user = buildUserMessage({ context, mode, lensId, focus, freeform });
      const text = await runChat({
        provider: byok.provider,
        model: byok.model,
        apiKey: byok.key,
        system: SYSTEM_PROMPT,
        user,
      });
      setReport(text);
      setCitations(cites);
    } catch (err) {
      setError(err?.message || 'Analysis failed.');
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
            cited deep-dive built from our intelligence. Runs on your own API key.
          </p>
        </div>
        <button className="as-model-chip" onClick={() => setModalOpen(true)} title="Choose provider / model / key">
          <span className="as-chip-dot" />
          {modelChip}
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
          </div>

          {mode === 'guided' ? (
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
          {!byok && (
            <div className="as-hint">You'll be asked to choose a model + paste your API key first.</div>
          )}
          {error && <div className="as-error">{error}</div>}
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
            <div className="as-muted">Running on {modelChip}…</div>
          ) : (
            <>
              <Markdown text={report} className="as-md" />
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
                Generated by your chosen model from our story data. Treat as analyst input, not fact —
                verify load-bearing claims against the linked sources.
              </p>
            </>
          )}
        </section>
      )}

      {modalOpen && (
        <ProviderModal
          onClose={() => setModalOpen(false)}
          onSaved={() => setByok(loadByok())}
        />
      )}
    </div>
  );
}
