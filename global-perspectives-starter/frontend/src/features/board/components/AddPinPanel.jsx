import { useMemo, useState } from 'react';
import Button from '@/shared/ui/Button.jsx';
import { COUNTRIES } from '@/shared/lib/countries.js';
import { PIN_BUDGET } from '@/shared/lib/board.js';

// Add a pin: followed stories and actors, a search over today's stories, and countries. Each result is one
// button. The pin budget is a hard stop; the add buttons say so instead of failing quietly.
const MAX_RESULTS = 8;

function Row({ label, kind, onAdd, disabled }) {
  return (
    <li className="board-list__row">
      <span className="board-list__label"><span className="board-list__kind">{kind}</span> {label}</span>
      <Button compact disabled={disabled} onClick={onAdd} aria-label={`Add ${label}`}>Add</Button>
    </li>
  );
}

export default function AddPinPanel({ topics, followedThreads, followedActors, full, notice, onAdd }) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();

  const titleOf = useMemo(() => new Map(topics.filter((t) => t.threadId).map((t) => [t.threadId, t.title])), [topics]);
  const stories = useMemo(() => (query.length < 2 ? [] : topics
    .filter((t) => t.threadId && String(t.title || '').toLowerCase().includes(query)).slice(0, MAX_RESULTS)), [topics, query]);
  const countries = useMemo(() => (query.length < 2 ? [] : Object.entries(COUNTRIES)
    .filter(([, c]) => c.name.toLowerCase().includes(query) || (c.aliases || []).some((a) => a.toLowerCase().includes(query)))
    .slice(0, MAX_RESULTS)), [query]);

  return (
    <div className="board-add">
      {full ? <p className="board-line" role="status">Pin budget reached: a board holds at most {PIN_BUDGET} pins. Remove one to add another.</p> : null}
      {notice ? <p className="board-line" role="status">{notice}</p> : null}
      <label className="board-field">
        <span className="board-field__label">Search today&apos;s stories and countries</span>
        <input className="board-input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type two letters or more" />
      </label>
      {query.length >= 2 && !stories.length && !countries.length ? <p className="board-line">Nothing matches.</p> : null}
      {stories.length || countries.length ? (
        <ul className="board-list">
          {stories.map((t) => <Row key={t.threadId} kind="Story" label={t.title} disabled={full} onAdd={() => onAdd({ kind: 'thread', refId: t.threadId })} />)}
          {countries.map(([iso3, c]) => <Row key={iso3} kind="Country" label={c.name} disabled={full} onAdd={() => onAdd({ kind: 'country', refId: iso3 })} />)}
        </ul>
      ) : null}

      <h3 className="board-sub">Followed stories</h3>
      {followedThreads.length ? (
        <ul className="board-list">
          {followedThreads.map((id) => <Row key={id} kind="Story" label={titleOf.get(id) || id.replace(/^thread-/, '').replace(/[-_]+/g, ' ')} disabled={full} onAdd={() => onAdd({ kind: 'thread', refId: id })} />)}
        </ul>
      ) : <p className="board-line">You follow no stories yet.</p>}

      <h3 className="board-sub">Followed actors</h3>
      {followedActors.length ? (
        <ul className="board-list">
          {followedActors.map((name) => <Row key={name} kind="Actor" label={name} disabled={full} onAdd={() => onAdd({ kind: 'actor', refId: name })} />)}
        </ul>
      ) : <p className="board-line">You follow no actors yet.</p>}
    </div>
  );
}
