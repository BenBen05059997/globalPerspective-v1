import { useState, useRef, useEffect, useMemo } from 'react';
import { useGeminiTopics } from '../hooks/useGeminiTopics';
import { regionToCountryCode } from '../utils/countryMapping';
import './IntelligenceLoader.css';

// ── Shared graph utilities ────────────────────────────────────────

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

// ── Typewriter → Constellation ─────────────────────────────────────

function AnimTypewriter({ topics, graph }) {
  const ref = useRef(null);
  const [phase, setPhase] = useState(0);
  const [typed, setTyped] = useState('');
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [hovered, setHovered] = useState(null);

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
  }, [sentence]);

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
        parts.push(<span key={idx++} className={`il-c-hl ${phase >= 1 ? 'active' : ''}`}
          style={{ color: RISK_DOT[graph.nodes.find(n => n.name === name)?.risk] || '#3b82f6' }}>{name}</span>);
        remaining = remaining.slice(p + name.length);
      }
    }
    if (remaining) parts.push(<span key={idx++}>{remaining}</span>);
    return parts;
  };

  return (
    <div ref={ref} className="il-anim">
      <div className={`il-c-text ${phase >= 2 ? 'fade-out' : ''}`}>
        {renderTyped()}
        {phase < 1 && <span className="il-c-cursor">|</span>}
      </div>
      {phase >= 3 && dims.w > 0 && (
        <svg className="il-svg">
          {graph.edges.map((e, i) => {
            const f = positions[e.from], t = positions[e.to];
            if (!f || !t) return null;
            const isHi = hovered && (e.from === hovered || e.to === hovered);
            return (<line key={i} x1={f.x} y1={f.y} x2={t.x} y2={t.y}
              className={`il-edge ${hovered && !isHi ? 'dim' : ''} ${isHi ? 'hi' : ''}`}
              style={{ strokeWidth: Math.max(1.5, e.weight * 2), animationDelay: `${i * 80}ms` }} />);
          })}
        </svg>
      )}
      {phase >= 2 && graph.nodes.map(n => {
        const tgt = positions[n.code] || { x: dims.w / 2, y: dims.h / 2 };
        const isDim = hovered && hovered !== n.code && !graph.edges.some(e =>
          (e.from === hovered && e.to === n.code) || (e.to === hovered && e.from === n.code));
        return (
          <div key={n.code} className={`il-node placed ${isDim ? 'dim' : ''}`}
            style={{ left: tgt.x, top: tgt.y }}
            onMouseEnter={() => phase >= 4 && setHovered(n.code)} onMouseLeave={() => setHovered(null)}>
            <span className="il-node-dot" style={{ background: RISK_DOT[n.risk] }} />
            <span className="il-node-flag">{n.flag}</span>
            <span className="il-node-name">{n.name}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Exploding Paragraph → Network ──────────────────────────────────

function AnimExplode({ topics, graph }) {
  const ref = useRef(null);
  const [phase, setPhase] = useState(0);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [hovered, setHovered] = useState(null);

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
  }, []);

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
    <div ref={ref} className="il-anim">
      {phase >= 1 && phase <= 2 && (
        <div className={`il-d-para ${phase >= 2 ? 'shake' : ''}`}>
          {headlines.map((h, i) => (<p key={i} className="il-d-line" style={{ animationDelay: `${i * 100}ms` }}>{h}</p>))}
        </div>
      )}
      {phase >= 3 && headlines.map((h, i) => {
        const pos = phase >= 4 ? (clusterPositions[h] || explodePositions[h]) : (explodePositions[h] || { x: dims.w / 2, y: dims.h / 2 });
        const isDim = hovered && headlineCountry[h] !== hovered;
        return (
          <div key={i} className={`il-d-word ${phase >= 4 ? 'clustered' : 'scattered'} ${isDim ? 'dim' : ''}`}
            style={{ left: pos.x, top: pos.y, animationDelay: `${i * 60}ms` }}>{h}</div>
        );
      })}
      {phase >= 4 && dims.w > 0 && (
        <svg className="il-svg">
          {graph.edges.map((e, i) => {
            const f = positions[e.from], t = positions[e.to];
            if (!f || !t) return null;
            const isHi = hovered && (e.from === hovered || e.to === hovered);
            return (<line key={i} x1={f.x} y1={f.y} x2={t.x} y2={t.y}
              className={`il-edge ${hovered && !isHi ? 'dim' : ''} ${isHi ? 'hi' : ''}`}
              style={{ strokeWidth: Math.max(1.5, e.weight * 2), animationDelay: `${i * 80}ms` }} />);
          })}
        </svg>
      )}
      {phase >= 4 && graph.nodes.map(n => {
        const tgt = positions[n.code] || { x: dims.w / 2, y: dims.h / 2 };
        const isDim = hovered && hovered !== n.code && !graph.edges.some(e =>
          (e.from === hovered && e.to === n.code) || (e.to === hovered && e.from === n.code));
        return (
          <div key={n.code} className={`il-node placed ${isDim ? 'dim' : ''}`}
            style={{ left: tgt.x, top: tgt.y }}
            onMouseEnter={() => phase >= 5 && setHovered(n.code)} onMouseLeave={() => setHovered(null)}>
            <span className="il-node-dot" style={{ background: RISK_DOT[n.risk] }} />
            <span className="il-node-flag">{n.flag}</span>
            <span className="il-node-name">{n.name}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Exported loader component ─────────────────────────────────────

export default function IntelligenceLoader({ type = 'typewriter' }) {
  const { topics } = useGeminiTopics();
  const graph = useMemo(() => buildGraph(topics), [topics]);

  if (!graph.nodes.length) {
    return (
      <div className="il-root">
        <div className="il-simple">
          <div className="il-spinner" />
          <div className="il-simple-text">Loading intelligence…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="il-root">
      {type === 'explode'
        ? <AnimExplode topics={topics} graph={graph} />
        : <AnimTypewriter topics={topics} graph={graph} />
      }
    </div>
  );
}

export { buildGraph, AnimTypewriter, AnimExplode };
