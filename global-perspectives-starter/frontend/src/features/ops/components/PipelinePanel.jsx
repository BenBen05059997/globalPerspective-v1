import { useState } from 'react';
import Card from '@/shared/ui/Card.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import AsOf from '@/shared/ui/AsOf.jsx';
import { pivot, noRun, statusOf, factLines, dayParts, STATUS } from '@/features/ops/lib/pipeline.js';

function Detail({ stage, cell }) {
  if (!cell) return <p className="ops-line ops-detail__hint">Hover or tap a cell for that day&apos;s numbers.</p>;
  const { row, date } = cell;
  const s = statusOf(row?.status);
  const facts = row ? factLines(row.facts) : [];
  return (
    <div className="ops-detail__body">
      <p className="ops-detail__head"><strong>{stage.label}</strong> · {dayParts(date).long} · <span className={`ops-detail__status ops-detail__status--${row?.status || 'nodata'}`}>{s.label}</span></p>
      {facts.length ? <dl className="ops-facts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl> : null}
      {row?.note ? <p className="ops-note">{row.note}</p> : null}
      {row?.error ? <p className="ops-line ops-line--warn">Could not be read: {row.error}</p> : null}
      {row?.source ? <p className="ops-note">Source: {row.source}{row.at ? ` · ${new Date(row.at).toISOString().replace('T', ' ').slice(0, 16)} UTC` : ''}</p> : <p className="ops-note">No row for this day.</p>}
    </div>
  );
}

export default function PipelinePanel({ health }) {
  const [sel, setSel] = useState(null); // { id, date }
  if (!health) {
    return (
      <Card as="section" aria-label="Pipeline">
        <SectionHeader label="Pipeline" as="h2" />
        <p className="ops-line">The pipeline view has not been generated yet.</p>
      </Card>
    );
  }
  const stages = pivot(health);
  const dates = (health.days || []).map((d) => d.date);
  const selStage = sel ? stages.find((s) => s.id === sel.id) : null;
  const selCell = selStage ? selStage.cells.find((c) => c.date === sel.date) : null;
  const r = health.now?.resolver;
  return (
    <Card as="section" aria-label="Pipeline" className="ops-panel">
      <SectionHeader label="Pipeline" as="h2" hint={`Last ${dates.length} UTC days, one cell per stage per day. A day is judged after the next day starts.`}>
        <AsOf generatedAt={health.asOf} source="newsHealth" />
      </SectionHeader>

      <div className="ops-legend" aria-label="Cell key">
        {Object.entries(STATUS).map(([id, s]) => <span key={id} className={`ops-legend__item ops-cell--${id}`}><span aria-hidden="true">{s.glyph}</span> {s.label}</span>)}
      </div>

      <div className="ops-grid-scroll" tabIndex={0} role="region" aria-label="Pipeline by stage and day">
        <div className="ops-grid" style={{ '--ops-days': dates.length }}>
          <div className="ops-grid__row ops-grid__row--head">
            <div className="ops-grid__label" />
            {dates.map((d, i) => {
              const p = dayParts(d);
              return <div key={d} className="ops-grid__date" title={p.long}>{i === 0 || p.day === '1' ? <><span>{p.day}</span><span className="ops-grid__month">{p.month}</span></> : p.day}</div>;
            })}
          </div>
          {stages.map((s) => {
            const empty = noRun(s.cells);
            return (
              <div key={s.id} className="ops-grid__row" role="group" aria-label={s.label}>
                <div className="ops-grid__label">{s.label}</div>
                {empty.noRun ? (
                  <div className="ops-grid__norun">no run{empty.error ? <span className="ops-note"> · could not be read: {empty.error}</span> : null}</div>
                ) : s.cells.map((c) => {
                  const st = statusOf(c.row?.status);
                  const on = sel && sel.id === s.id && sel.date === c.date;
                  return (
                    <button
                      key={c.date}
                      type="button"
                      className={`ops-cell ops-cell--${c.row?.status || 'nodata'}${on ? ' ops-cell--on' : ''}`}
                      aria-label={`${s.label}, ${dayParts(c.date).long}: ${st.label}`}
                      aria-pressed={on}
                      title={`${dayParts(c.date).long}: ${st.label}`}
                      onMouseEnter={() => setSel({ id: s.id, date: c.date })}
                      onFocus={() => setSel({ id: s.id, date: c.date })}
                      onClick={() => setSel({ id: s.id, date: c.date })}
                    >
                      <span aria-hidden="true">{st.glyph}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="ops-detail" aria-live="polite"><Detail stage={selStage || {}} cell={selCell} /></div>
      {r && !r.error ? (
        <p className="ops-note">Resolver now: {r.sampled} questions sampled, {r.due} due, {r.drafted} drafted, {r.verdicts} settled{r.commits != null ? `, ${r.commits} weekly commitments` : ''}.</p>
      ) : r?.error ? <p className="ops-note">Resolver status could not be read: {r.error}</p> : null}
    </Card>
  );
}
