import ClaimTag from '@/shared/ui/ClaimTag.jsx';
import { dayMonth } from '@/shared/lib/branchWording.js';
import { branchLine, branchScenario, branchPercent } from '@/features/board/lib/branchView.js';
import { isLate } from '@/features/board/lib/storyTree.js';
import '@/features/board/storyTree.css';

// The drawn tree (artboard 6): the dated trunk, the present line, and one future line per open branch whose thickness is its
// percentage. Dashed = our judgment (every future line), solid = reported (the trunk). Branches that were scored are not drawn:
// they stay in the lists, worded by branchWording ("not reported by ..."), never as dead stubs (decision 0038).
// The drawing is aria-hidden; the trunk and fork lists beside it in StoryTree are its text equivalent.
const STEP = 112;       // trunk node spacing
const LEFT = 60;       // first node x
const ROW = 64;         // height of one branch row
const REACH = 96;       // branch reach from the present line to its label
const LABEL = 250;      // branch label width
const WEIGHT = 0.4;     // line thickness per percent
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const lines = (s, n) => { // two lines of at most n characters, broken at a space
  const first = s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, '') || s.slice(0, n);
  return [first, clip(s.slice(first.length).trim(), n)].filter(Boolean);
};

export default function StoryTreeDrawing({ shown, branches, present }) {
  if (!shown.length && !branches.length) return null;
  const n = shown.length;
  const presentX = LEFT + Math.max(n, 1) * STEP;
  const height = Math.max(150, branches.length * ROW + 64);
  const mid = height / 2 + 8;
  const labelX = presentX + REACH + 8;
  const width = labelX + LABEL;
  const anyLate = branches.some((b) => isLate(b, present));
  return <div className="story-tree__draw">
    {branches.length ? <p className="story-tree__ours"><ClaimTag kind="judgment" /> OURS · PROVISIONAL</p> : null}
    <div className="story-tree__scroll" tabIndex={0} role="group" aria-label="Story tree drawing">
    <svg className="story-tree__svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
      {n ? <line className="st-trunk" x1={LEFT} y1={mid} x2={presentX} y2={mid} /> : null}
      {shown.map((e, i) => {
        const x = LEFT + i * STEP;
        return <g key={e.eventId}>
          <circle className="st-node" cx={x} cy={mid} r="7" />
          <text className="st-date" x={x} y={mid + 26}>{dayMonth(e.date)}</text>
          {lines(e.title || dayMonth(e.date), 17).map((l, k) => <text className="st-label" key={k} x={x} y={mid + 40 + k * 13}>{l}</text>)}
        </g>;
      })}
      {present ? <>
        <line className="st-present" x1={presentX} y1="22" x2={presentX} y2={height - 8} />
        <text className="st-now" x={presentX + 8} y="14">{`PRESENT · ${dayMonth(present).toUpperCase()}`}</text>
      </> : null}
      {branches.map((b, i) => {
        const ty = mid + (i - (branches.length - 1) / 2) * ROW;
        const ex = presentX + REACH;
        const late = isLate(b, present);
        const w = Math.max(2, (branchPercent(b) ?? 0) * WEIGHT);
        return <g key={b.branchId}>
          <path className={late ? 'st-branch st-branch--late' : 'st-branch'} strokeWidth={w}
            d={`M${presentX} ${mid} C ${presentX + 56} ${mid}, ${ex - 56} ${ty}, ${ex} ${ty}`} />
          <text className="st-label st-label--head" x={labelX} y={ty - 6}>{clip(`${branchLine(b)}${branchPercent(b) != null ? ` · ${branchPercent(b)}%` : ''}`, 40)}</text>
          {branchScenario(b) ? <text className="st-label st-label--dim" x={labelX} y={ty + 8}>{clip(branchScenario(b), 44)}</text> : null}
          {late ? <text className="st-label st-label--late" x={labelX} y={ty + 22}>{`▸ late · past ${dayMonth(b.due)}`}</text> : null}
        </g>;
      })}
    </svg>
    </div>
    {branches.length ? <ul className="story-tree__legend" aria-label="Key">
      <li><span className="story-tree__swatch story-tree__swatch--thick" />thicker line = higher chance we gave it</li>
      <li><span className="story-tree__swatch story-tree__swatch--dash" />dashed = our judgment, solid = reported</li>
      {anyLate ? <li>▸ late = past its date, no verdict yet</li> : null}
    </ul> : null}
  </div>;
}
