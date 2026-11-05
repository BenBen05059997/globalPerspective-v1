import Card from '@/shared/ui/Card.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import AsOf from '@/shared/ui/AsOf.jsx';
import { qualityItems } from '@/features/ops/lib/quality.js';

function PartTable({ table }) {
  if (!table) return null;
  return (
    <div className="ops-scroll" tabIndex={0} role="region" aria-label={table.caption}>
      <table className="ops-table ops-table--text">
        <caption className="ops-caption">{table.caption}</caption>
        <thead><tr>{table.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.join('|')}>
              <th scope="row" className="ops-table__wrap">{row[0]}</th>
              {row.slice(1).map((cell, j) => <td key={table.head[j + 1]}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Part({ part }) {
  const meta = [part.when, part.source].filter(Boolean).join(' · ');
  return (
    <div className="ops-part">
      <h4 className="ops-part__title">{part.label}</h4>
      {part.state === 'ok' ? <p className="ops-part__headline">{part.headline}</p> : null}
      {part.state === 'not_available' ? <p className="ops-line"><strong>Not available.</strong> {part.why}</p> : null}
      {part.state === 'error' ? <p className="ops-line ops-line--warn">Could not be read on the last run: {part.why}</p> : null}
      {part.state === 'missing' ? <p className="ops-line">Not in the file yet.</p> : null}
      {part.facts.length ? <dl className="ops-facts">{part.facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl> : null}
      <PartTable table={part.table} />
      {meta ? <p className="ops-note">{meta}</p> : null}
    </div>
  );
}

export default function QualityPanel({ quality }) {
  if (!quality) {
    return (
      <Card as="section" aria-label="Quality">
        <SectionHeader label="Quality" as="h2" />
        <p className="ops-line">The quality section has not been written yet.</p>
      </Card>
    );
  }
  return (
    <Card as="section" aria-label="Quality" className="ops-panel">
      <SectionHeader label="Quality" as="h2" hint="Six checks on the last closed UTC day, each naming its source. Built once a UTC day.">
        <AsOf generatedAt={quality.pulledAt || quality.asOf} source="newsHealth" />
      </SectionHeader>
      {qualityItems(quality).map((item) => (
        <div key={item.id} className="ops-check">
          <h3 className="ops-check__title">{item.title}</h3>
          {item.parts.map((p) => <Part key={p.id} part={p} />)}
        </div>
      ))}
      {quality.note ? <p className="ops-note">{quality.note}</p> : null}
    </Card>
  );
}
