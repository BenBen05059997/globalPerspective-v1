import { useState } from 'react';
import { Link } from 'react-router-dom';
import { threadPath } from '../utils/threadPath';
import './SystemsGraph.css';

// SystemsGraph — the cited, lag-aware causal graph made first-class (the "why-engine").
// Each edge is a validated cause→effect link: every node is a real story thread (so it
// links to its arc), every edge carries a named transmission mechanism, a day lag, a
// calibrated confidence, and a count of the archive entries that cite it. Uncited edges
// are already dropped backend-side (newsSystemsAnalysis), so everything shown is grounded.
//
// Honesty contract: render nothing when there are no nodes/edges. `citedEntries` are
// topicIds with no standalone route, so they're shown as an evidence COUNT, not a fake link.

const DEFAULT_SHOWN = 6;

function confColor(c) {
  return c === 'strong' ? 'var(--risk-h, #c0392b)'
    : c === 'medium' ? 'var(--risk-e, #d97706)'
    : 'var(--ink-faint)';
}

export default function SystemsGraph({ data, countryName }) {
  const [showAll, setShowAll] = useState(false);
  const nodes = data?.nodes || [];
  const edges = data?.edges || [];
  if (!nodes.length || !edges.length) return null;

  const nodeMap = nodes.reduce((m, n) => { if (n?.threadId) m[n.threadId] = n; return m; }, {});
  const titleFor = (id) => nodeMap[id]?.summary
    || (id || '').replace(/^thread-/, '').replace(/-[a-f0-9]{6}$/, '').replace(/-/g, ' ');

  // Send the reader to the node's full arc; carry the country breadcrumb so the
  // thread page can route back here (mirrors the arc-link convention).
  const threadHref = (id) =>
    threadPath(id, countryName ? { from: 'country', country: countryName } : {});

  const NodeRef = ({ id }) => {
    const label = titleFor(id);
    return nodeMap[id]?.threadId
      ? <Link className="sysg-node sysg-node-link" to={threadHref(id)}>{label}</Link>
      : <span className="sysg-node">{label}</span>;
  };

  const shown = showAll ? edges : edges.slice(0, DEFAULT_SHOWN);

  return (
    <div className="sysg">
      {shown.map((e, i) => (
        <div className="sysg-edge" key={`${e.from}-${e.to}-${i}`}>
          <div className="sysg-node-row"><NodeRef id={e.from} /></div>
          <div className="sysg-mid">
            <span className="sysg-bar" />
            {e.lagDays != null && <span>{e.lagDays}d lag</span>}
            {e.confidence && <span style={{ color: confColor(e.confidence) }}>· {e.confidence}</span>}
            {Array.isArray(e.citedEntries) && e.citedEntries.length > 0 && (
              <span title="Archive entries citing this link">· {e.citedEntries.length} cited</span>
            )}
          </div>
          <div className="sysg-node-row"><NodeRef id={e.to} /></div>
          {e.mechanism && <div className="sysg-mech">{e.mechanism}</div>}
        </div>
      ))}
      {edges.length > DEFAULT_SHOWN && (
        <button className="sysg-more" onClick={() => setShowAll((s) => !s)}>
          {showAll ? 'Show fewer' : `Show all ${edges.length} links`}
        </button>
      )}
    </div>
  );
}
