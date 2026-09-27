// Minimal, dependency-free Markdown → React renderer for our own LLM-generated briefs.
// Handles: ## / ### headings, - / * bullet lists, **bold**, *italic*, `code`, and
// paragraphs (soft line-breaks joined). React escapes all text nodes, so this is XSS-safe.
// Not a general Markdown engine — just the subset our prompt produces.
//
// Optional `links` prop (Analysis Studio, D3): a { marker: href } map, e.g.
// { W1: 'https://example.com' }, turning a literal "[W1]" in the text into a real
// link to that URL. Only markers present in the map are ever linked — any other
// bracket text (including our own [n] story citations, which link separately in the
// sources list) renders as plain text, unchanged.

const INLINE_RE = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[(W\d{1,3})\])/;

function inline(text, kp, links) {
  const nodes = [];
  let rest = String(text);
  let k = 0;
  let m;
  while ((m = rest.match(INLINE_RE))) {
    if (m.index > 0) nodes.push(rest.slice(0, m.index));
    if (m[2] != null) nodes.push(<strong key={`${kp}-${k}`}>{m[2]}</strong>);
    else if (m[3] != null) nodes.push(<em key={`${kp}-${k}`}>{m[3]}</em>);
    else if (m[4] != null) nodes.push(<code key={`${kp}-${k}`}>{m[4]}</code>);
    else if (m[5] != null) {
      const href = links && links[m[5]];
      nodes.push(
        href
          ? (
            <a key={`${kp}-${k}`} className="gp-md-cite gp-md-cite-web" href={href} target="_blank" rel="noopener noreferrer">
              [{m[5]}]
            </a>
          )
          : `[${m[5]}]`
      );
    }
    rest = rest.slice(m.index + m[0].length);
    k++;
  }
  if (rest) nodes.push(rest);
  return nodes;
}

export default function Markdown({ text, className = 'gp-md', links }) {
  const lines = String(text || '').split('\n');
  const out = [];
  let para = [];
  let list = [];
  let n = 0;

  const flushPara = () => {
    if (para.length) { out.push(<p key={`p${n++}`}>{inline(para.join(' '), `p${n}`, links)}</p>); para = []; }
  };
  const flushList = () => {
    if (list.length) {
      const items = list;
      out.push(<ul key={`u${n++}`}>{items.map((li, i) => <li key={i}>{inline(li, `u${n}-${i}`, links)}</li>)}</ul>);
      list = [];
    }
  };

  // A heading marker followed by a long sentence is a model formatting slip, not a real
  // heading — render it as a paragraph (strip the marker) so we never show a giant heading.
  const isRealHeading = (txt) => txt.length <= 80 && !/[.!?]$/.test(txt);

  for (const raw of lines) {
    const t = raw.trim();
    if (!t) { flushPara(); flushList(); continue; }
    const h = t.startsWith('### ') ? t.slice(4) : t.startsWith('## ') ? t.slice(3) : t.startsWith('# ') ? t.slice(2) : null;
    if (h !== null && isRealHeading(h)) {
      flushPara(); flushList();
      const Tag = t.startsWith('### ') ? 'h3' : 'h2';
      out.push(<Tag key={`h${n++}`}>{inline(h, `h${n}`, links)}</Tag>);
    } else if (/^[-*]\s+/.test(t)) {
      flushPara(); list.push(t.replace(/^[-*]\s+/, ''));
    } else {
      flushList();
      para.push(h !== null ? h : t); // strip a stray heading marker off a long line
    }
  }
  flushPara();
  flushList();

  return <div className={className}>{out}</div>;
}
