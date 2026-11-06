import Card from '@/shared/ui/Card.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import AsOf from '@/shared/ui/AsOf.jsx';
import { usd } from '@/features/ops/lib/money.js';
import { dayParts } from '@/features/ops/lib/pipeline.js';
import { count, familyBars, recent, storyLabel } from '@/features/ops/lib/readers.js';

function Stat({ label, value, sub }) {
  if (value == null) return null;
  return (
    <Card level={2} pad="sm" className="ops-stat">
      <div className="ops-stat__label">{label}</div>
      <div className="ops-stat__value">{value}</div>
      {sub ? <div className="ops-stat__sub">{sub}</div> : null}
    </Card>
  );
}

function NotConnected() {
  return (
    <div className="ops-detail" role="note">
      <p className="ops-detail__head"><strong>Not connected.</strong> Page views come from Cloudflare Web Analytics, which needs an API token.</p>
      <ol className="ops-steps">
        <li>Cloudflare dashboard, My Profile, API Tokens, Create Token: custom token, permission Account, Account Analytics, Read, for this account only.</li>
        <li>Set it on the <code>newsHealth</code> Lambda as <code>CF_ANALYTICS_TOKEN</code> (recipe in the newsHealth README; the value never goes in chat or a file).</li>
        <li>The next hourly run reads the page views of this site from the account&apos;s Web Analytics.</li>
      </ol>
    </div>
  );
}

function FamilyBars({ cf }) {
  const rows = familyBars(cf);
  return (
    <div className="ops-scroll" tabIndex={0} role="region" aria-label="Views per page family">
      <table className="ops-table">
        <caption className="ops-caption">Views per page family, 14 days (each row scaled to its own tallest day)</caption>
        <thead><tr><th scope="col">Family</th><th scope="col">Views</th><th scope="col">Per day</th></tr></thead>
        <tbody>
          {rows.map((f) => (
            <tr key={f.id}>
              <th scope="row">{f.label}</th>
              <td>{count(f.views)}</td>
              <td>
                <span className="ops-spark" role="img" aria-label={`${f.label}, 14 days: ${f.days.map((d) => d.views).join(', ')}`}>
                  {f.days.map((d) => (
                    <span key={d.date} className="ops-spark__day" title={`${dayParts(d.date).long}: ${count(d.views)} views`}>
                      <span className="ops-spark__bar" style={{ height: !f.max || !d.views ? '0%' : `${Math.max(4, Math.round((d.views / f.max) * 100))}%` }} />
                    </span>
                  ))}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopTable({ caption, head, rows, cell }) {
  if (!rows?.length) return null;
  return (
    <div className="ops-scroll" tabIndex={0} role="region" aria-label={caption}>
      <table className="ops-table">
        <caption className="ops-caption">{caption}</caption>
        <thead><tr><th scope="col">{head}</th><th scope="col">Views</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={cell(r)}><th scope="row" className="ops-table__wrap">{cell(r)}</th><td>{count(r.views)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function Cloudflare({ cf }) {
  if (!cf || cf.status === 'not_connected') return <NotConnected />;
  if (cf.status === 'error') return <p className="ops-line ops-line--warn">Cloudflare could not be read on the last run: {cf.error}</p>;
  return (
    <>
      <div className="ops-stats">
        <Stat label={`Page views, ${cf.days.length} days`} value={count(cf.totals?.views)} sub={`${dayParts(cf.from).long} to ${dayParts(cf.to).long}, without /ops`} />
        <Stat label="Views of /ops, left out" value={count(cf.totals?.opsViews)} />
        <Stat label="No referrer (direct)" value={count(cf.directViews)} />
      </div>
      <FamilyBars cf={cf} />
      <TopTable caption="Top stories" head="Story" rows={cf.topStories} cell={storyLabel} />
      <TopTable caption="Top country pages" head="Country" rows={cf.topCountryPages} cell={(r) => r.country} />
      <TopTable caption="Where readers are (visitor country)" head="Country" rows={cf.visitorCountries} cell={(r) => r.country} />
      <TopTable caption="Top referrers" head="Referrer" rows={cf.referrers} cell={(r) => r.host} />
    </>
  );
}

function Own({ own }) {
  if (!own) return null;
  if (own.status !== 'ok') return <p className="ops-line ops-line--warn">Our own tables could not be counted on the last run: {own.error || 'no answer'}</p>;
  const withDate = (c) => (c.undated ? `${c.undated} without a date` : null);
  return (
    <div className="ops-stats" aria-label="Our own data">
      <Stat label="Accounts" value={count(own.users?.total)} sub={[`${count(recent(own.users))} created in the last 14 days`, withDate(own.users)].filter(Boolean).join(' · ')} />
      <Stat label="Boards" value={count(own.boards?.total)} />
      <Stat label="Saved items" value={count(own.saved?.total)} sub={Object.entries(own.saved?.byType || {}).map(([k, v]) => `${k} ${v}`).join(' · ') || null} />
      <Stat label="Shares" value={count(own.shares?.total)} sub={`${count(recent(own.shares))} in the last 14 days`} />
    </div>
  );
}

function Attention({ rows, connected }) {
  if (!rows?.length) return null;
  return (
    <div className="ops-scroll" tabIndex={0} role="region" aria-label="Attention versus effort">
      <table className="ops-table">
        <caption className="ops-caption">Attention vs effort, 14 days (views next to estimated model spend)</caption>
        <thead><tr><th scope="col">Family</th><th scope="col">Views</th><th scope="col">Model spend</th><th scope="col">Spend by Lambda</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <th scope="row">{r.label}</th>
              <td>{count(r.views) ?? (connected ? '' : 'not connected')}</td>
              <td>{usd(r.usd) ?? 'no data'}</td>
              <td className="ops-table__wrap">{r.lambdas.map((l) => `${l.fn} ${usd(l.usd)}`).join(' · ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ReadersPanel({ readers }) {
  if (!readers) {
    return (
      <Card as="section" aria-label="Readers">
        <SectionHeader label="Readers" as="h2" />
        <p className="ops-line">The readers section has not been written yet.</p>
      </Card>
    );
  }
  return (
    <Card as="section" aria-label="Readers" className="ops-panel">
      <SectionHeader label="Readers" as="h2" hint="Cloudflare Web Analytics page loads and our own tables, refreshed once a UTC day.">
        <AsOf generatedAt={readers.pulledAt || readers.asOf} source="newsHealth" />
      </SectionHeader>
      <Cloudflare cf={readers.cloudflare} />
      <Own own={readers.own} />
      <Attention rows={readers.attention} connected={readers.cloudflare?.status === 'ok'} />
      {readers.note ? <p className="ops-note">{readers.note}</p> : null}
    </Card>
  );
}
