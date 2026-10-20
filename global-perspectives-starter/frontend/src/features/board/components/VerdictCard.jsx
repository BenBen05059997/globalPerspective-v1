import { useState } from 'react';
import Button from '@/shared/ui/Button.jsx';
import ClaimTag from '@/shared/ui/ClaimTag.jsx';
import { MAX_LINE, countryName } from '@/features/board/lib/boardOps.js';

// The connection verdict: what the cheap test found between two pins. Slice 1 shows only the grounds the
// server returns (shared actors, places, outlets, co-movement of the two risk series): no mechanism, no
// direction. The server's own note and limits are shown as they come; "none" is stated, never softened.
const STRENGTH = { none: 'No link found', weak: 'Weak link', medium: 'Medium link' };

function Ground({ g }) {
  if (g.kind === 'actor') return <li><strong>Shared actors:</strong> {(g.detail || []).join(', ')}</li>;
  if (g.kind === 'place') return <li><strong>Shared places:</strong> {(g.detail || []).map(countryName).join(', ')}</li>;
  if (g.kind === 'outlet') {
    return (
      <li>
        <strong>Shared outlets:</strong> {(g.detail?.outlets || []).join(', ')}
        {g.detail?.note ? <span className="board-note"> ({g.detail.note})</span> : null}
      </li>
    );
  }
  if (g.kind === 'comovement') {
    const { pairs, lagDays, note } = g.detail || {};
    return (
      <li>
        <strong>Scores moved together:</strong> {pairs} {pairs === 1 ? 'pairing' : 'pairings'}, up to {lagDays} {lagDays === 1 ? 'day' : 'days'} apart
        {note ? <span className="board-note"> ({note})</span> : null}
      </li>
    );
  }
  return null;
}

export default function VerdictCard({ labelA, labelB, state, kept, onKeep, onDismiss }) {
  const [line, setLine] = useState('');
  if (state.loading) return <p className="board-line">Testing {labelA} against {labelB}.</p>;
  if (state.error) return <p className="board-line" role="status">{state.error}</p>;
  const r = state.result;
  if (!r) return null;
  return (
    <div className="board-verdict" data-strength={r.strength}>
      <p className="board-verdict__pair">{labelA} <span aria-hidden="true">/</span> {labelB}</p>
      <p className="board-verdict__strength">{STRENGTH[r.strength] || r.strength}</p>
      {r.grounds?.length ? <ul className="board-verdict__grounds">{r.grounds.map((g, i) => <Ground key={`${g.kind}${i}`} g={g} />)}</ul> : null}
      {r.note ? <p className="board-verdict__note">{r.note}</p> : null}
      {r.limits?.length ? <ul className="board-verdict__limits">{r.limits.map((l) => <li key={l}>{l}</li>)}</ul> : null}
      <p className="board-verdict__basis"><ClaimTag kind="inference" /> Computed from what we hold; it is a test, not a finding.</p>
      <label className="board-field">
        <span className="board-field__label">Your line (optional)</span>
        <input
          className="board-input"
          type="text"
          value={line}
          maxLength={MAX_LINE}
          onChange={(e) => setLine(e.target.value)}
          placeholder="Why you are tying these two"
        />
      </label>
      <div className="board-actions">
        <Button variant="primary" onClick={() => onKeep(line)}>{kept ? 'Replace with my string' : 'Keep string'}</Button>
        <Button onClick={onDismiss}>Dismiss</Button>
      </div>
    </div>
  );
}
