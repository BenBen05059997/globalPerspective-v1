// CountrySheet — the sheet blocks under the country page's tabs: How it connects, What we don't know, Your view,
// the copy / print actions and the footer line. Everything is assembled from data the page already holds; no model
// runs and nothing is fetched here. "Your view" stays in this browser (localStorage) and is never sent.
import { useEffect, useRef, useState } from 'react';
import ClaimTag from '@/shared/ui/ClaimTag.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import EntityLink from '@/shared/ui/EntityLink.jsx';
import Button from '@/shared/ui/Button.jsx';
import { emptyRow, loadView, saveView, ROWS_MAX, VIEW_MAX } from '@/features/countries/lib/countryYourView.js';
import '@/features/countries/components/CountrySheet.css';

export function HowItConnects({ rows, country }) {
  if (!rows?.length) return null;
  return (
    <section className="cs-block" aria-label="How it connects">
      <SectionHeader label="How it connects" hint={<><ClaimTag kind="judgment" /> judged to feed into, not proof of cause</>} />
      <ul className="cs-links">
        {rows.map((r) => (
          <li key={`${r.fromId}>${r.toId}`}>
            <EntityLink kind="story" id={r.fromId} pathOpts={{ from: 'country', country }} topic={{ title: r.fromTitle }}>{r.fromTitle}</EntityLink>
            {' '}<span className="cs-feeds">judged to feed into</span>{' '}
            <EntityLink kind="story" id={r.toId} topic={{ title: r.toTitle }}>{r.toTitle}</EntityLink>
            <span className="cs-meta"> · {r.confidence || 'unrated'} · {r.lag}</span>
            {r.mechanism ? <p className="cs-mech">&ldquo;{r.mechanism}&rdquo;</p> : null}
            {r.cited?.length > 0 ? (
              <ul className="cs-cited">
                {r.cited.slice(0, 3).map((c) => (
                  <li key={c.topicId || c.title}><ClaimTag kind="fact" />{c.date ? `${c.date} ` : ''}{c.title}</li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function WhatWeDontKnow({ lines }) {
  return (
    <section className="cs-block" aria-label="What we don't know">
      <SectionHeader label="What we don't know" hint={<ClaimTag kind="inference" />} />
      <ul className="cs-unknowns">{lines.map((l) => <li key={l}>{l}</li>)}</ul>
    </section>
  );
}

export function YourView({ country }) {
  const [v, setV] = useState(() => loadView(country));
  useEffect(() => { setV(loadView(country)); }, [country]);
  const update = (next) => { setV(next); saveView(country, next); };
  const setRow = (i, patch) => update({ ...v, rows: v.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  return (
    <section className="cs-block cs-yours" aria-label="Your view">
      <SectionHeader label="Your view" hint={<><ClaimTag kind="yours" /> Private. Never sent to us.</>} />
      <label className="cs-label" htmlFor="cs-view">Your view of {country} ({v.view.length}/{VIEW_MAX})</label>
      <textarea id="cs-view" className="cs-input" rows={3} maxLength={VIEW_MAX} value={v.view} onChange={(e) => update({ ...v, view: e.target.value })} />
      {v.rows.map((r, i) => (
        <div key={i} className="cs-row">
          <span className="cs-label">I&apos;d change my mind if</span>
          <input className="cs-input" aria-label="I'd change my mind if" value={r.ifText} onChange={(e) => setRow(i, { ifText: e.target.value })} />
          <span className="cs-label">by</span>
          <input className="cs-input cs-input--date" type="date" aria-label="by date" value={r.by} onChange={(e) => setRow(i, { by: e.target.value })} />
          <span className="cs-label">per</span>
          <input className="cs-input" aria-label="per source" value={r.source} onChange={(e) => setRow(i, { source: e.target.value })} />
          <input className="cs-input cs-input--p" aria-label="my p" placeholder="my p" value={r.p} onChange={(e) => setRow(i, { p: e.target.value })} />
          <Button compact className="cs-noprint" onClick={() => update({ ...v, rows: v.rows.filter((_, j) => j !== i) })}>Remove</Button>
        </div>
      ))}
      {v.rows.length < ROWS_MAX ? (
        <Button compact className="cs-noprint" onClick={() => update({ ...v, rows: [...v.rows, emptyRow()] })}>Add &ldquo;I&apos;d change my mind if&hellip;&rdquo;</Button>
      ) : null}
    </section>
  );
}

// Copy as text: the clipboard write runs inside the click; if the browser refuses, the text is shown in a
// textarea, selected, ready for the reader's own copy.
export function CopyAsText({ getText }) {
  const [state, setState] = useState(null); // 'copied' | { fallback: text }
  const area = useRef(null);
  useEffect(() => { if (state?.fallback) area.current?.select(); }, [state]);
  useEffect(() => {
    if (state !== 'copied') return undefined;
    const t = setTimeout(() => setState(null), 2000);
    return () => clearTimeout(t);
  }, [state]);
  function copy() {
    const text = getText();
    const fail = () => setState({ fallback: text });
    if (!navigator.clipboard?.writeText) { fail(); return; }
    navigator.clipboard.writeText(text).then(() => setState('copied'), fail);
  }
  return (
    <>
      <Button compact onClick={copy}>{state === 'copied' ? 'Copied' : 'Copy as text'}</Button>
      {state?.fallback ? (
        <textarea ref={area} className="cs-input cs-fallback cs-noprint" readOnly aria-label="Text to copy" value={state.fallback} rows={12} />
      ) : null}
    </>
  );
}

export function PrintButton() {
  return <Button compact onClick={() => window.print()}>Print</Button>;
}

export function SheetFooter({ date }) {
  return <p className="cs-footer">Assembled from our archive on {date}. No AI ran when you opened this page; model judgments are marked.</p>;
}
