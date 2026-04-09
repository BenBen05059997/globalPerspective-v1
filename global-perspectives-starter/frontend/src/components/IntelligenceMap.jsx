import { useState, useRef, useEffect, useMemo } from 'react';
import { useGeminiTopics } from '../hooks/useGeminiTopics';
import { regionToCountryCode } from '../utils/countryMapping';
import './IntelligenceMap.css';

// ── Shared utilities ──────────────────────────────────────────────

function countryFlag(nameOrCode) {
  let code = nameOrCode.length > 2 ? regionToCountryCode(nameOrCode) : nameOrCode;
  if (!code || code.length !== 2) return '🌍';
  return String.fromCodePoint(0x1F1E6 + code.charCodeAt(0) - 65, 0x1F1E6 + code.charCodeAt(1) - 65);
}

const RISK_DOT = { low: '#10b981', moderate: '#eab308', elevated: '#f97316', high: '#ef4444' };

function buildGraph(topics) {
  const nodeMap = {}, edgeMap = {};
  for (const topic of (topics || [])) {
    const codes = [];
    for (const region of (topic.regions || [])) {
      const code = regionToCountryCode(region);
      if (code && code.length === 2 && !codes.includes(code)) {
        codes.push(code);
        if (!nodeMap[code]) nodeMap[code] = { code, name: region, flag: countryFlag(region), count: 0, headlines: [] };
        nodeMap[code].count++;
        if (nodeMap[code].headlines.length < 3 && !nodeMap[code].headlines.includes(topic.title))
          nodeMap[code].headlines.push(topic.title);
      }
    }
    for (let i = 0; i < codes.length; i++)
      for (let j = i + 1; j < codes.length; j++) {
        const key = [codes[i], codes[j]].sort().join('-');
        if (!edgeMap[key]) edgeMap[key] = { from: codes[i], to: codes[j], weight: 0 };
        edgeMap[key].weight++;
      }
  }
  const nodes = Object.values(nodeMap).sort((a, b) => b.count - a.count).slice(0, 8);
  const nodeCodes = new Set(nodes.map(n => n.code));
  const edges = Object.values(edgeMap).filter(e => nodeCodes.has(e.from) && nodeCodes.has(e.to));
  for (const n of nodes) n.risk = n.count >= 4 ? 'high' : n.count >= 3 ? 'elevated' : n.count >= 2 ? 'moderate' : 'low';
  return { nodes, edges };
}

function circleLayout(nodes, cx, cy, radius) {
  const pos = {};
  nodes.forEach((n, i) => {
    const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
    pos[n.code] = { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius };
  });
  return pos;
}

// ── A: Headlines → Network ────────────────────────────────────────

function AnimHeadlines({ graph }) {
  const ref = useRef(null);
  const [phase, setPhase] = useState(0);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [hovered, setHovered] = useState(null);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setDims({ w: r.width, h: r.height });
    setPhase(0);
    const t = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 2800),
      setTimeout(() => setPhase(3), 3600),
      setTimeout(() => setPhase(4), 5200),
      setTimeout(() => setPhase(5), 6800),
    ];
    return () => t.forEach(clearTimeout);
  }, [key]);

  const headlines = useMemo(() => [...new Set(graph.nodes.flatMap(n => n.headlines))].slice(0, 5), [graph]);
  const positions = useMemo(() => {
    if (!dims.w) return {};
    return circleLayout(graph.nodes, dims.w / 2, dims.h / 2, Math.min(dims.w, dims.h) * 0.32);
  }, [dims, graph.nodes]);

  return (
    <div ref={ref} className="im-anim" key={key}>
      {phase >= 1 && phase <= 2 && (
        <div className="im-a-center">
          {headlines.map((h, i) => (
            <div key={i} className={`im-a-headline ${phase >= 2 ? 'fade-out' : ''}`}
              style={{ animationDelay: `${i * 350}ms` }}>{h}</div>
          ))}
        </div>
      )}
      {phase >= 4 && dims.w > 0 && (
        <svg className="im-svg">
          {graph.edges.map((e, i) => {
            const f = positions[e.from], t = positions[e.to];
            if (!f || !t) return null;
            const isHi = hovered && (e.from === hovered || e.to === hovered);
            return (
              <line key={i} x1={f.x} y1={f.y} x2={t.x} y2={t.y}
                className={`im-edge ${hovered && !isHi ? 'dim' : ''} ${isHi ? 'hi' : ''}`}
                style={{ strokeWidth: Math.max(1.5, e.weight * 2), animationDelay: `${i * 80}ms` }} />
            );
          })}
        </svg>
      )}
      {phase >= 2 && graph.nodes.map(n => {
        const tgt = positions[n.code] || { x: dims.w / 2, y: dims.h / 2 };
        const placed = phase >= 3;
        const isDim = hovered && hovered !== n.code && !graph.edges.some(e =>
          (e.from === hovered && e.to === n.code) || (e.to === hovered && e.from === n.code));
        return (
          <div key={n.code} className={`im-node ${placed ? 'placed' : 'entering'} ${isDim ? 'dim' : ''}`}
            style={{ left: placed ? tgt.x : dims.w / 2, top: placed ? tgt.y : dims.h / 2 }}
            onMouseEnter={() => phase >= 5 && setHovered(n.code)}
            onMouseLeave={() => setHovered(null)}>
            <span className="im-node-dot" style={{ background: RISK_DOT[n.risk] }} />
            <span className="im-node-flag">{n.flag}</span>
            <span className="im-node-name">{n.name}</span>
          </div>
        );
      })}
      <button className="im-replay" onClick={() => { setPhase(0); setHovered(null); setKey(k => k + 1); }}>↻ Replay</button>
    </div>
  );
}

// ── B: Force-Directed Graph ────────────────────────────────────────

function AnimForce({ graph }) {
  const ref = useRef(null);
  const rafRef = useRef(null);
  const [hovered, setHovered] = useState(null);
  const [settled, setSettled] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (!ref.current || !graph.nodes.length) return;
    const r = ref.current.getBoundingClientRect();
    const w = r.width, h = r.height, cx = w / 2, cy = h / 2;
    setSettled(false);
    const sim = graph.nodes.map(n => ({ ...n, x: cx + (Math.random() - 0.5) * 30, y: cy + (Math.random() - 0.5) * 30, vx: 0, vy: 0 }));
    const nodeEls = ref.current.querySelectorAll('.im-b-node');
    const svg = ref.current.querySelector('.im-b-svg');
    let frame = 0;

    function tick() {
      for (let i = 0; i < sim.length; i++)
        for (let j = i + 1; j < sim.length; j++) {
          const dx = sim[j].x - sim[i].x, dy = sim[j].y - sim[i].y;
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const f = 1200 / (dist * dist), fx = (dx / dist) * f, fy = (dy / dist) * f;
          sim[i].vx -= fx; sim[i].vy -= fy; sim[j].vx += fx; sim[j].vy += fy;
        }
      for (const edge of graph.edges) {
        const a = sim.find(n => n.code === edge.from), b = sim.find(n => n.code === edge.to);
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y, dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const f = (dist - 140) * 0.008 * edge.weight;
        a.vx += (dx / dist) * f; a.vy += (dy / dist) * f;
        b.vx -= (dx / dist) * f; b.vy -= (dy / dist) * f;
      }
      for (const n of sim) {
        n.vx += (cx - n.x) * 0.003; n.vy += (cy - n.y) * 0.003;
        n.vx *= 0.82; n.vy *= 0.82;
        n.x += n.vx; n.y += n.vy;
        n.x = Math.max(70, Math.min(w - 70, n.x));
        n.y = Math.max(50, Math.min(h - 50, n.y));
      }
      nodeEls.forEach((el, i) => { if (sim[i]) { el.style.left = `${sim[i].x}px`; el.style.top = `${sim[i].y}px`; } });
      if (svg) svg.querySelectorAll('line').forEach((line, i) => {
        const edge = graph.edges[i]; if (!edge) return;
        const a = sim.find(n => n.code === edge.from), b = sim.find(n => n.code === edge.to);
        if (a && b) { line.setAttribute('x1', a.x); line.setAttribute('y1', a.y); line.setAttribute('x2', b.x); line.setAttribute('y2', b.y); }
      });
      frame++;
      if (frame > 300) { setSettled(true); return; }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [graph, key]);

  return (
    <div ref={ref} className="im-anim" key={key}>
      <svg className="im-b-svg im-svg">
        {graph.edges.map((e, i) => {
          const isHi = hovered && (e.from === hovered || e.to === hovered);
          return (<line key={i} className={`im-edge-instant ${hovered && !isHi ? 'dim' : ''} ${isHi ? 'hi' : ''}`}
            style={{ strokeWidth: Math.max(1.5, e.weight * 2) }} />);
        })}
      </svg>
      {graph.nodes.map(n => {
        const isDim = hovered && hovered !== n.code && !graph.edges.some(e =>
          (e.from === hovered && e.to === n.code) || (e.to === hovered && e.from === n.code));
        return (
          <div key={n.code} className={`im-node im-b-node ${isDim ? 'dim' : ''}`}
            onMouseEnter={() => settled && setHovered(n.code)} onMouseLeave={() => setHovered(null)}>
            <span className="im-node-dot" style={{ background: RISK_DOT[n.risk] }} />
            <span className="im-node-flag">{n.flag}</span>
            <span className="im-node-name">{n.name}</span>
          </div>
        );
      })}
      <button className="im-replay" onClick={() => { setHovered(null); setKey(k => k + 1); }}>↻ Replay</button>
    </div>
  );
}

// ── C: Typewriter → Constellation ──────────────────────────────────

function AnimTypewriter({ topics, graph }) {
  const ref = useRef(null);
  const [phase, setPhase] = useState(0);
  const [typed, setTyped] = useState('');
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [hovered, setHovered] = useState(null);
  const [key, setKey] = useState(0);

  const sentence = useMemo(() => {
    const names = graph.nodes.slice(0, 5).map(n => n.name);
    const hl = topics.slice(0, 3).map(t => t.title).filter(Boolean);
    return `Today's intelligence: ${hl.join('. ')}. Countries in focus: ${names.join(', ')}.`;
  }, [topics, graph]);

  useEffect(() => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setDims({ w: r.width, h: r.height });
    setPhase(0); setTyped('');
    let i = 0;
    const iv = setInterval(() => { i++; if (i <= sentence.length) setTyped(sentence.slice(0, i)); else clearInterval(iv); }, 28);
    const dur = sentence.length * 28 + 400;
    const t = [
      setTimeout(() => setPhase(1), dur),
      setTimeout(() => setPhase(2), dur + 1000),
      setTimeout(() => setPhase(3), dur + 2200),
      setTimeout(() => setPhase(4), dur + 3500),
    ];
    return () => { clearInterval(iv); t.forEach(clearTimeout); };
  }, [sentence, key]);

  const positions = useMemo(() => {
    if (!dims.w) return {};
    return circleLayout(graph.nodes, dims.w / 2, dims.h / 2, Math.min(dims.w, dims.h) * 0.3);
  }, [dims, graph.nodes]);

  const countryNames = useMemo(() => graph.nodes.map(n => n.name), [graph]);

  const renderTyped = () => {
    if (phase >= 2) return null;
    let remaining = typed;
    const parts = [];
    let idx = 0;
    for (const name of countryNames) {
      const p = remaining.indexOf(name);
      if (p >= 0) {
        if (p > 0) parts.push(<span key={idx++}>{remaining.slice(0, p)}</span>);
        parts.push(<span key={idx++} className={`im-c-hl ${phase >= 1 ? 'active' : ''}`}
          style={{ color: RISK_DOT[graph.nodes.find(n => n.name === name)?.risk] || '#3b82f6' }}>{name}</span>);
        remaining = remaining.slice(p + name.length);
      }
    }
    if (remaining) parts.push(<span key={idx++}>{remaining}</span>);
    return parts;
  };

  return (
    <div ref={ref} className="im-anim" key={key}>
      <div className={`im-c-text ${phase >= 2 ? 'fade-out' : ''}`}>
        {renderTyped()}
        {phase < 1 && <span className="im-c-cursor">|</span>}
      </div>
      {phase >= 3 && dims.w > 0 && (
        <svg className="im-svg">
          {graph.edges.map((e, i) => {
            const f = positions[e.from], t = positions[e.to];
            if (!f || !t) return null;
            const isHi = hovered && (e.from === hovered || e.to === hovered);
            return (<line key={i} x1={f.x} y1={f.y} x2={t.x} y2={t.y}
              className={`im-edge ${hovered && !isHi ? 'dim' : ''} ${isHi ? 'hi' : ''}`}
              style={{ strokeWidth: Math.max(1.5, e.weight * 2), animationDelay: `${i * 80}ms` }} />);
          })}
        </svg>
      )}
      {phase >= 2 && graph.nodes.map(n => {
        const tgt = positions[n.code] || { x: dims.w / 2, y: dims.h / 2 };
        const isDim = hovered && hovered !== n.code && !graph.edges.some(e =>
          (e.from === hovered && e.to === n.code) || (e.to === hovered && e.from === n.code));
        return (
          <div key={n.code} className={`im-node placed ${isDim ? 'dim' : ''}`}
            style={{ left: tgt.x, top: tgt.y }}
            onMouseEnter={() => phase >= 4 && setHovered(n.code)} onMouseLeave={() => setHovered(null)}>
            <span className="im-node-dot" style={{ background: RISK_DOT[n.risk] }} />
            <span className="im-node-flag">{n.flag}</span>
            <span className="im-node-name">{n.name}</span>
          </div>
        );
      })}
      <button className="im-replay" onClick={() => { setHovered(null); setKey(k => k + 1); }}>↻ Replay</button>
    </div>
  );
}

// ── D: Exploding Paragraph → Network ──────────────────────────────

function AnimExplode({ topics, graph }) {
  const ref = useRef(null);
  const [phase, setPhase] = useState(0);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [hovered, setHovered] = useState(null);
  const [key, setKey] = useState(0);

  const headlines = useMemo(() => (topics || []).slice(0, 6).map(t => t.title).filter(Boolean), [topics]);

  const headlineCountry = useMemo(() => {
    const map = {};
    for (const topic of (topics || []).slice(0, 6)) {
      if (!topic.title) continue;
      for (const region of (topic.regions || [])) {
        const code = regionToCountryCode(region);
        if (code && code.length === 2 && graph.nodes.find(n => n.code === code)) { map[topic.title] = code; break; }
      }
    }
    return map;
  }, [topics, graph]);

  useEffect(() => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setDims({ w: r.width, h: r.height });
    setPhase(0);
    const t = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 2000),
      setTimeout(() => setPhase(3), 2600),
      setTimeout(() => setPhase(4), 4200),
      setTimeout(() => setPhase(5), 5800),
    ];
    return () => t.forEach(clearTimeout);
  }, [key]);

  const positions = useMemo(() => {
    if (!dims.w) return {};
    return circleLayout(graph.nodes, dims.w / 2, dims.h / 2, Math.min(dims.w, dims.h) * 0.3);
  }, [dims, graph.nodes]);

  const explodePositions = useMemo(() => {
    if (!dims.w) return {};
    const cx = dims.w / 2, cy = dims.h / 2, map = {};
    headlines.forEach((h, i) => {
      const angle = (i / headlines.length) * Math.PI * 2 + Math.PI * 0.1;
      map[h] = { x: cx + Math.cos(angle) * Math.min(dims.w, dims.h) * 0.35, y: cy + Math.sin(angle) * Math.min(dims.w, dims.h) * 0.35 };
    });
    return map;
  }, [headlines, dims]);

  const clusterPositions = useMemo(() => {
    const map = {}, offsets = {};
    for (const h of headlines) {
      const code = headlineCountry[h], pos = code ? positions[code] : null;
      if (pos) { if (!offsets[code]) offsets[code] = 0; map[h] = { x: pos.x, y: pos.y + 32 + offsets[code]++ * 22 }; }
      else map[h] = explodePositions[h] || { x: dims.w / 2, y: dims.h / 2 };
    }
    return map;
  }, [headlines, headlineCountry, positions, explodePositions, dims]);

  return (
    <div ref={ref} className="im-anim" key={key}>
      {phase >= 1 && phase <= 2 && (
        <div className={`im-d-para ${phase >= 2 ? 'shake' : ''}`}>
          {headlines.map((h, i) => (<p key={i} className="im-d-line" style={{ animationDelay: `${i * 100}ms` }}>{h}</p>))}
        </div>
      )}
      {phase >= 3 && headlines.map((h, i) => {
        const pos = phase >= 4 ? (clusterPositions[h] || explodePositions[h]) : (explodePositions[h] || { x: dims.w / 2, y: dims.h / 2 });
        const isDim = hovered && headlineCountry[h] !== hovered;
        return (
          <div key={i} className={`im-d-word ${phase >= 4 ? 'clustered' : 'scattered'} ${isDim ? 'dim' : ''}`}
            style={{ left: pos.x, top: pos.y, animationDelay: `${i * 60}ms` }}>{h}</div>
        );
      })}
      {phase >= 4 && dims.w > 0 && (
        <svg className="im-svg">
          {graph.edges.map((e, i) => {
            const f = positions[e.from], t = positions[e.to];
            if (!f || !t) return null;
            const isHi = hovered && (e.from === hovered || e.to === hovered);
            return (<line key={i} x1={f.x} y1={f.y} x2={t.x} y2={t.y}
              className={`im-edge ${hovered && !isHi ? 'dim' : ''} ${isHi ? 'hi' : ''}`}
              style={{ strokeWidth: Math.max(1.5, e.weight * 2), animationDelay: `${i * 80}ms` }} />);
          })}
        </svg>
      )}
      {phase >= 4 && graph.nodes.map(n => {
        const tgt = positions[n.code] || { x: dims.w / 2, y: dims.h / 2 };
        const isDim = hovered && hovered !== n.code && !graph.edges.some(e =>
          (e.from === hovered && e.to === n.code) || (e.to === hovered && e.from === n.code));
        return (
          <div key={n.code} className={`im-node placed ${isDim ? 'dim' : ''}`}
            style={{ left: tgt.x, top: tgt.y }}
            onMouseEnter={() => phase >= 5 && setHovered(n.code)} onMouseLeave={() => setHovered(null)}>
            <span className="im-node-dot" style={{ background: RISK_DOT[n.risk] }} />
            <span className="im-node-flag">{n.flag}</span>
            <span className="im-node-name">{n.name}</span>
          </div>
        );
      })}
      <button className="im-replay" onClick={() => { setHovered(null); setKey(k => k + 1); }}>↻ Replay</button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────

const TABS = [
  { id: 'A', label: 'Headlines → Network' },
  { id: 'B', label: 'Force Graph' },
  { id: 'C', label: 'Typewriter → Constellation' },
  { id: 'D', label: 'Exploding Paragraph' },
];

export default function IntelligenceMap() {
  const { topics } = useGeminiTopics();
  const graph = useMemo(() => buildGraph(topics), [topics]);
  const noData = !graph.nodes.length;
  const [tab, setTab] = useState('A');

  return (
    <div className="im-root">
      <div className="im-header">
        <div>
          <div className="im-header-title">🌍 Intelligence Network</div>
          <div className="im-header-sub">
            {noData ? 'Loading topics…' : `${graph.nodes.length} countries · ${graph.edges.length} connections`}
          </div>
        </div>
        <div className="im-tabs">
          {TABS.map(t => (
            <button key={t.id} className={`im-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="im-stage-wrap">
        {noData ? (
          <div className="im-loading">Loading intelligence data…</div>
        ) : (
          <>
            {tab === 'A' && <AnimHeadlines graph={graph} key="A" />}
            {tab === 'B' && <AnimForce graph={graph} key="B" />}
            {tab === 'C' && <AnimTypewriter topics={topics} graph={graph} key="C" />}
            {tab === 'D' && <AnimExplode topics={topics} graph={graph} key="D" />}
          </>
        )}
      </div>
    </div>
  );
}
