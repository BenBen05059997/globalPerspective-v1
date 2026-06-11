import { useEffect, useRef, useState } from 'react';
import { PROVIDERS, getProvider } from '../services/llm';
import { loadByok, saveByok, clearByok } from '../utils/byok';
import './ProviderModal.css';

// BYOK chooser: pick provider → model → paste key. Stored browser-only.
export default function ProviderModal({ onClose, onSaved }) {
  const overlayRef = useRef(null);
  const existing = loadByok();
  const [provider, setProvider] = useState(existing?.provider || PROVIDERS[0].id);
  const [model, setModel] = useState(existing?.model || PROVIDERS[0].models[0]);
  const [key, setKey] = useState(existing?.key || '');

  const p = getProvider(provider) || PROVIDERS[0];

  // Keep the model valid when the provider changes.
  function handleProvider(id) {
    setProvider(id);
    const next = getProvider(id);
    if (next && !next.models.includes(model)) setModel(next.models[0]);
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleSave(e) {
    e.preventDefault();
    if (!key.trim()) return;
    saveByok({ provider, model, key: key.trim() });
    onSaved?.({ provider, model });
    onClose();
  }

  function handleClear() {
    clearByok();
    setKey('');
    onSaved?.(null);
  }

  return (
    <div
      className="pm-overlay"
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div className="pm-modal" role="dialog" aria-modal="true" aria-label="Choose analysis model">
        <div className="pm-header">
          <h3>Choose your model</h3>
          <button className="pm-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>

        <p className="pm-note">
          Bring your own API key to run analyses. <strong>Your key stays in this browser</strong> and
          is never sent to our servers — it goes straight to the provider you pick.
        </p>

        <form className="pm-form" onSubmit={handleSave}>
          <label className="pm-label">
            Provider
            <select value={provider} onChange={(e) => handleProvider(e.target.value)}>
              {PROVIDERS.map((pp) => (
                <option key={pp.id} value={pp.id}>{pp.label}</option>
              ))}
            </select>
          </label>

          <label className="pm-label">
            Model
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              {p.models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>

          {p.webSearch && (
            <p className="pm-search-note">
              {p.webSearch === 'always'
                ? '🔎 This model searches the web on every run — it powers the Deep research mode.'
                : '🔎 Supports web search via the provider’s tool — unlocks the Deep research mode.'}
            </p>
          )}

          <label className="pm-label">
            API key
            <input
              type="password"
              value={key}
              placeholder={p.keyHint || 'Paste your API key'}
              onChange={(e) => setKey(e.target.value)}
              autoComplete="off"
              spellCheck="false"
              autoFocus
            />
          </label>

          <div className="pm-actions">
            {existing && (
              <button type="button" className="pm-clear" onClick={handleClear}>
                Clear key
              </button>
            )}
            <button type="submit" className="pm-save" disabled={!key.trim()}>
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
