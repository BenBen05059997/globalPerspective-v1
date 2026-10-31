import { useState } from 'react';
import Button from '@/shared/ui/Button.jsx';
import ClaimTag from '@/shared/ui/ClaimTag.jsx';
import JointTrace from '@/features/board/components/JointTrace.jsx';
import { OursBadge, StrengthBadge } from '@/features/board/components/StringBadges.jsx';
import { useStoryViews } from '@/features/board/hooks/useStoryViews.js';
import { MAX_LINE, countryName } from '@/features/board/lib/boardOps.js';
import { evidenceRows, verdictMemo } from '@/features/board/lib/panelParts.js';
import { reportFetchError } from '@/shared/api/errorSink';
import { dayMonth } from '@/shared/lib/branchWording.js';
import '@/features/board/panels.css';

// The connection verdict (artboard 3): what the cheap test found between two pins. It shows only what the server
// returns plus the story record's dated headlines: no mechanism sentence, direction, "what follows if" or "what
// would break it" (those need a written reading). An element with no data is absent; "none" is stated, never softened.
const STRENGTH = { none: 'No link found', weak: 'Weak link', medium: 'Medium link' };

const groundOf = (grounds, kind) => (grounds || []).find((g) => g.kind === kind)?.detail;

export default function VerdictCard({ labelA, labelB, state, kept, onKeep, onDismiss }) {
  const [line, setLine] = useState('');
  const [copied, setCopied] = useState(false);
  const r = state.result;
  const { stories } = useStoryViews([r?.a, r?.b].filter((p) => p?.kind === 'thread'));
  if (state.loading) return <p className="board-line">Testing {labelA} against {labelB}.</p>;
  if (state.error) return <p className="board-line" role="status">{state.error}</p>;
  if (!r) return null;

  const actors = groundOf(r.grounds, 'actor') || [];
  const places = (groundOf(r.grounds, 'place') || []).map(countryName);
  const outlet = groundOf(r.grounds, 'outlet');
  const move = groundOf(r.grounds, 'comovement');
  // one chip per name: an actor tag and a place often name the same country in different case ("iran", "Iran"); the place's spelling wins
  const sitInBoth = [...new Map([...actors, ...places].map((name) => [String(name).toLowerCase(), name])).values()];
  const evidence = evidenceRows(stories, outlet?.outlets);
  const strengthWord = STRENGTH[r.strength] || r.strength;

  const exportMemo = async () => {
    try {
      await navigator.clipboard.writeText(verdictMemo({ labelA, labelB, strengthWord, note: r.note, shared: sitInBoth, evidence, line }));
      setCopied(true);
    } catch (err) {
      reportFetchError('board-memo', err);
    }
  };

  return (
    <div className="board-verdict pn-panel" data-strength={r.strength}>
      <header className="pn-head">
        <div className="pn-head__row">
          <span className="pn-kicker">Connection verdict</span>
          <Button variant="icon" label="Close panel" onClick={onDismiss}>×</Button>
        </div>
        <p className="pn-pair"><span className="pn-pin">{labelA}</span><span className="pn-pair__string" aria-hidden="true" /><span className="pn-pin">{labelB}</span></p>
      </header>

      <section className="pn-box pn-box--ours" aria-label="Verdict">
        <div className="pn-head__row">
          <span className="pn-kicker">Verdict</span>
          <span className="pn-badges"><OursBadge /><StrengthBadge strength={r.strength === 'none' ? null : r.strength} /></span>
        </div>
        <h3 className="pn-verdict">{strengthWord}</h3>
        {r.note ? <p className="pn-text">{r.note}</p> : null}
        <p className="pn-text"><ClaimTag kind="inference" /> Computed from what we hold; it is a test, not a finding.</p>
      </section>

      {move?.moves ? (
        <section className="pn-sec" aria-label="Joint trace">
          <h3 className="pn-kicker">Joint trace <ClaimTag kind="fact" /></h3>
          <JointTrace labelA={labelA} labelB={labelB} detail={move} />
          {move.note ? <p className="board-note">{move.note}</p> : null}
        </section>
      ) : move ? (
        <p className="pn-text"><strong>Scores moved together:</strong> {move.pairs} {move.pairs === 1 ? 'pairing' : 'pairings'}, up to {move.lagDays} {move.lagDays === 1 ? 'day' : 'days'} apart
          {move.note ? <span className="board-note"> ({move.note})</span> : null}</p>
      ) : null}

      {sitInBoth.length ? (
        <section className="pn-sec" aria-label="Who sits in both">
          <h3 className="pn-kicker">Who sits in both</h3>
          <ul className="pn-chips">{sitInBoth.map((name) => <li key={name} className="pn-chip">{name}</li>)}</ul>
        </section>
      ) : null}

      {evidence.length ? (
        <section className="pn-sec" aria-label="Evidence">
          <h3 className="pn-kicker">Evidence <ClaimTag kind="fact" /></h3>
          <ul className="pn-rows">
            {evidence.map((e) => (
              <li key={e.key} className="pn-row">
                <time className="pn-row__date" dateTime={e.date}>{dayMonth(e.date)}</time>
                <div><div className="pn-row__head">{e.outlet}</div><div className="board-note">{e.headline}</div></div>
              </li>
            ))}
          </ul>
          {outlet?.note ? <p className="board-note">Shared outlets: {outlet.note}.</p> : null}
        </section>
      ) : outlet?.outlets?.length ? (
        <p className="pn-text"><strong>Shared outlets:</strong> {outlet.outlets.join(', ')}{outlet.note ? <span className="board-note"> ({outlet.note})</span> : null}</p>
      ) : null}

      {r.limits?.length ? <ul className="board-verdict__limits">{r.limits.map((l) => <li key={l}>{l}</li>)}</ul> : null}

      <section className="pn-box pn-box--yours">
        <div className="pn-head__row">
          <label className="pn-kicker" htmlFor="pn-yourline">Your line (optional)</label>
          <ClaimTag kind="yours" />
        </div>
        <input
          id="pn-yourline"
          className="board-input"
          type="text"
          value={line}
          maxLength={MAX_LINE}
          onChange={(e) => setLine(e.target.value)}
          placeholder="Write one sentence on why you keep this"
        />
        <div className="board-actions pn-actions">
          <Button variant="primary" onClick={() => onKeep(line)}>{kept ? 'Replace with my string' : 'Keep string'}</Button>
          {navigator.clipboard?.writeText ? <Button onClick={exportMemo}>Export as memo</Button> : null}
          <Button className="pn-actions__drop" onClick={onDismiss}>Drop it</Button>
        </div>
        {copied ? <p className="board-note" role="status">Memo copied to the clipboard.</p> : null}
      </section>
    </div>
  );
}
