// Minimal, dependency-free Markdown → React renderer for our own LLM-generated briefs.
// Handles: ## / ### headings, - / * bullet lists, **bold**, *italic*, `code`, and
// paragraphs (soft line-breaks joined). React escapes all text nodes, so this is XSS-safe.
// Not a general Markdown engine — just the subset our prompt produces.

const INLINE_RE = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/;

function inline(text, kp) {
  const nodes = [];
  let rest = String(text);
  let k = 0;
  let m;
  while ((m = rest.match(INLINE_RE))) {
    if (m.index > 0) nodes.push(rest.slice(0, m.index));
    if (m[2] != null) nodes.push(<strong key={`${kp}-${k}`}>{m[2]}</strong>);
    else if (m[3] != null) nodes.push(<em key={`${kp}-${k}`}>{m[3]}</em>);
    else if (m[4] != null) nodes.push(<code key={`${kp}-${k}`}>{m[4]}</code>);
    rest = rest.slice(m.index + m[0].length);
    k++;
  }
  if (rest) nodes.push(rest);
  return nodes;
}

export default function Markdown({ text, className = 'gp-md' }) {
  const lines = String(text || '').split('\n');
  const out = [];
  let para = [];
  let list = [];
  let n = 0;

  const flushPara = () => {
    if (para.length) { out.push(<p key={`p${n++}`}>{inline(para.join(' '), `p${n}`)}</p>); para = []; }
  };
  const flushList = () => {
    if (list.length) {
      const items = list;
      out.push(<ul key={`u${n++}`}>{items.map((li, i) => <li key={i}>{inline(li, `u${n}-${i}`)}</li>)}</ul>);
      list = [];
    }
  };

  for (const raw of lines) {
    const t = raw.trim();
    if (!t) { flushPara(); flushList(); continue; }
    if (t.startsWith('### ')) { flushPara(); flushList(); out.push(<h3 key={`h${n++}`}>{inline(t.slice(4), `h${n}`)}</h3>); }
    else if (t.startsWith('## ')) { flushPara(); flushList(); out.push(<h2 key={`h${n++}`}>{inline(t.slice(3), `h${n}`)}</h2>); }
    else if (t.startsWith('# ')) { flushPara(); flushList(); out.push(<h2 key={`h${n++}`}>{inline(t.slice(2), `h${n}`)}</h2>); }
    else if (/^[-*]\s+/.test(t)) { flushPara(); list.push(t.replace(/^[-*]\s+/, '')); }
    else { flushList(); para.push(t); }
  }
  flushPara();
  flushList();

  return <div className={className}>{out}</div>;
}
