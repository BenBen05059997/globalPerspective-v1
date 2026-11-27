import Card from '@/shared/ui/Card.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import AsOf from '@/shared/ui/AsOf.jsx';
import Stat from '@/features/ops/components/Stat.jsx';
import { usd, tokens, byLambda, dailyBars, unitRows } from '@/features/ops/lib/money.js';
import { dayParts } from '@/features/ops/lib/pipeline.js';

const since = (mtd) => (mtd && mtd.from ? `from ${dayParts(mtd.from).long}, ${mtd.days} ${mtd.days === 1 ? 'day' : 'days'} of data` : null);

function Bars({ bars }) {
  const max = Math.max(0, ...bars.flatMap((b) => [b.models || 0, b.aws || 0]));
  const h = (v) => (v == null || !max ? '0%' : `${Math.max(2, Math.round((v / max) * 100))}%`);
  return (
    <figure className="ops-bars" aria-label="Daily cost, last 14 days: AI-model estimate and AWS">
      <div className="ops-bars__plot">
        {bars.map((b) => (
          <div
            key={b.date}
            className="ops-bars__day"
            title={`${dayParts(b.date).long}: AI models ${usd(b.models) || 'no data'} (estimate), AWS ${usd(b.aws) || 'no data'}`}
          >
            <span className="ops-bars__bar ops-bars__bar--models" style={{ height: h(b.models) }} />
            <span className="ops-bars__bar ops-bars__bar--aws" style={{ height: h(b.aws) }} />
            <span className="ops-bars__date">{dayParts(b.date).day}</span>
          </div>
        ))}
      </div>
      <figcaption className="ops-bars__legend">
        <span className="ops-key ops-key--models">AI models, estimated</span>
        <span className="ops-key ops-key--aws">AWS, Cost Explorer</span>
        {max ? <span className="ops-note">tallest bar {usd(max)}</span> : null}
      </figcaption>
    </figure>
  );
}

export default function MoneyPanel({ ops }) {
  if (!ops) {
    return (
      <Card as="section" aria-label="Money">
        <SectionHeader label="Money" as="h2" />
        <p className="ops-line">The money file has not been written yet.</p>
      </Card>
    );
  }
  const { models, aws, unitCosts } = ops;
  const lambdas = byLambda(models);
  const bars = dailyBars(ops);
  const units = unitRows(unitCosts);
  const yDate = models?.yesterday?.date ? dayParts(models.yesterday.date).long : null;
  return (
    <Card as="section" aria-label="Money" className="ops-panel">
      <SectionHeader label="Money" as="h2" hint="AI-model spend is an estimate from the usage log lines at list prices; AWS is Cost Explorer's own figure.">
        <AsOf generatedAt={ops.asOf} source="newsHealth" />
      </SectionHeader>

      {models?.error ? <p className="ops-line ops-line--warn">The AI-model estimate was not updated on the last run: {models.error}</p> : null}
      {aws?.error ? <p className="ops-line ops-line--warn">The AWS cost was not updated on the last run: {aws.error}</p> : null}

      <div className="ops-stats">
        <Stat label={yDate ? `AI models ${yDate}, estimate` : 'AI models yesterday, estimate'} value={usd(models?.yesterday?.usd)} />
        <Stat label={`AI models ${models?.monthToDate?.month || 'month'} to date, estimate`} value={usd(models?.monthToDate?.usd)} sub={since(models?.monthToDate)} />
        <Stat label={aws?.yesterday?.date ? `AWS ${dayParts(aws.yesterday.date).long}` : 'AWS yesterday'} value={usd(aws?.yesterday?.usd)} />
        <Stat label={`AWS ${aws?.monthToDate?.month || 'month'} to date`} value={usd(aws?.monthToDate?.usd)} sub={since(aws?.monthToDate)} />
      </div>

      {bars.length ? <Bars bars={bars} /> : null}

      {lambdas.length ? (
        <div className="ops-scroll" tabIndex={0} role="region" aria-label="AI models by Lambda">
          <table className="ops-table">
            <caption className="ops-caption">AI models by Lambda (estimate)</caption>
            <thead><tr><th scope="col">Lambda</th><th scope="col">Calls</th><th scope="col">Tokens in / out</th><th scope="col">Yesterday</th><th scope="col">Month to date</th></tr></thead>
            <tbody>
              {lambdas.map((l) => (
                <tr key={l.fn}>
                  <th scope="row">{l.fn}</th>
                  <td>{l.calls || ''}</td>
                  <td>{l.calls ? `${tokens(l.promptTokens)} / ${tokens(l.completionTokens)}` : ''}</td>
                  <td>{usd(l.yesterday) || (l.unpriced ? 'unpriced' : '')}</td>
                  <td>{usd(l.month) || (l.unpriced ? 'unpriced' : '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {models?.unpriced?.length ? <p className="ops-note">No price for {models.unpriced.join(', ')}: its calls add nothing to the totals.</p> : null}

      {units.length ? (
        <div className="ops-scroll" tabIndex={0} role="region" aria-label="Unit costs">
          <table className="ops-table">
            <caption className="ops-caption">Unit costs (a day&apos;s model spend divided by that day&apos;s count)</caption>
            <thead><tr><th scope="col">Unit</th><th scope="col">Day</th><th scope="col">Spend</th><th scope="col">Count</th><th scope="col">Each</th></tr></thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.id}>
                  <th scope="row">{u.label}</th>
                  <td>{dayParts(u.date).long}</td>
                  <td>{usd(u.usd)}</td>
                  <td>{u.count}</td>
                  <td>{usd(u.per)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {unitCosts?.weeklyReview?.length ? (
        <p className="ops-note">Weekly review spend: {unitCosts.weeklyReview.map((w) => `${w.week} ${usd(w.usd)}`).join(' · ')}</p>
      ) : null}
    </Card>
  );
}
