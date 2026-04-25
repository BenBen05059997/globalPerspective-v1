import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { useCountrySignal } from '../hooks/useCountrySignal';
import { usePairAnalyses } from '../hooks/usePairAnalyses';
import { useGeminiTopics } from '../hooks/useGeminiTopics';
import { useWeeklyArchive } from '../hooks/useWeeklyArchive';
import './WorldMapV2.css';

// Country data: risk level, delta, thread count
const COUNTRY_DATA = {
  ARG: { n: 'Argentina',     r: 'H', d: +0.6, t: 3, region: 'South America', category: 'Economy' },
  TUR: { n: 'Turkey',        r: 'E', d: +0.3, t: 2, region: 'Middle East',   category: 'Economy' },
  TWN: { n: 'Taiwan',        r: 'E', d: +0.2, t: 2, region: 'Asia',          category: 'Technology' },
  MLI: { n: 'Mali',          r: 'H', d: +0.8, t: 1, region: 'Africa',        category: 'Geopolitics' },
  BFA: { n: 'Burkina Faso',  r: 'H', d: +0.7, t: 1, region: 'Africa',        category: 'Geopolitics' },
  NER: { n: 'Niger',         r: 'H', d: +0.6, t: 1, region: 'Africa',        category: 'Geopolitics' },
  JPN: { n: 'Japan',         r: 'L', d: -0.1, t: 1, region: 'Asia',          category: 'Economy' },
  UKR: { n: 'Ukraine',       r: 'E', d: +0.4, t: 2, region: 'Europe',        category: 'Geopolitics' },
  RUS: { n: 'Russia',        r: 'H', d: +0.1, t: 4, region: 'Europe',        category: 'Geopolitics' },
  USA: { n: 'United States', r: 'L', d:  0.0, t: 6, region: 'Americas',      category: 'Economy' },
  CHN: { n: 'China',         r: 'E', d: +0.2, t: 5, region: 'Asia',          category: 'Technology' },
  IRN: { n: 'Iran',          r: 'H', d: +0.3, t: 2, region: 'Middle East',   category: 'Geopolitics' },
  ISR: { n: 'Israel',        r: 'H', d: +0.2, t: 2, region: 'Middle East',   category: 'Geopolitics' },
  VEN: { n: 'Venezuela',     r: 'H', d: +0.1, t: 1, region: 'South America', category: 'Economy' },
  PAK: { n: 'Pakistan',      r: 'E', d: +0.1, t: 1, region: 'Asia',          category: 'Geopolitics' },
  IND: { n: 'India',         r: 'L', d:  0.0, t: 2, region: 'Asia',          category: 'Economy' },
  BRA: { n: 'Brazil',        r: 'L', d: -0.1, t: 1, region: 'South America', category: 'Economy' },
  DEU: { n: 'Germany',       r: 'L', d: +0.1, t: 2, region: 'Europe',        category: 'Economy' },
  FRA: { n: 'France',        r: 'L', d:  0.0, t: 1, region: 'Europe',        category: 'Economy' },
  GBR: { n: 'UK',            r: 'L', d:  0.0, t: 1, region: 'Europe',        category: 'Economy' },
  KOR: { n: 'South Korea',   r: 'L', d:  0.0, t: 1, region: 'Asia',          category: 'Technology' },
  NLD: { n: 'Netherlands',   r: 'L', d:  0.0, t: 1, region: 'Europe',        category: 'Technology' },
};

const COORDS = {
  ARG: [-63.6,-38.4], TUR: [35.2,38.9],  TWN: [121.0,23.7], MLI: [-4.0,17.5],
  BFA: [-1.5,12.3],   NER: [8.1,17.6],   JPN: [138.0,36.2], UKR: [31.1,48.3],
  RUS: [90.0,60.0],   USA: [-98.5,39.8], CHN: [104.1,35.8], IRN: [53.7,32.4],
  ISR: [34.8,31.0],   VEN: [-66.5,6.4],  PAK: [69.3,30.3],  IND: [78.9,20.5],
  BRA: [-51.9,-14.2], DEU: [10.4,51.1],  FRA: [1.8,46.6],   GBR: [-3.4,55.3],
  KOR: [127.7,35.9],  NLD: [5.2,52.1],
};

const FLOWS = [
  { a: 'ARG', b: 'USA', w: 'strong', label: 'IMF program',   g: 'fx'   },
  { a: 'ARG', b: 'BRA', w: 'mod',    label: 'Mercosur FX',   g: 'fx'   },
  { a: 'ARG', b: 'CHN', w: 'mod',    label: 'Soy channel',   g: 'fx'   },
  { a: 'TUR', b: 'DEU', w: 'mod',    label: 'Trade',         g: 'fx'   },
  { a: 'TUR', b: 'GBR', w: 'mod',    label: 'FX flows',      g: 'fx'   },
  { a: 'TWN', b: 'USA', w: 'strong', label: 'Fab 2 AZ',      g: 'tech' },
  { a: 'TWN', b: 'JPN', w: 'strong', label: 'Kumamoto 3',    g: 'tech' },
  { a: 'TWN', b: 'NLD', w: 'mod',    label: 'ASML tools',    g: 'tech' },
  { a: 'MLI', b: 'BFA', w: 'strong', label: 'AES customs',   g: 'geo'  },
  { a: 'MLI', b: 'NER', w: 'strong', label: 'AES customs',   g: 'geo'  },
  { a: 'MLI', b: 'RUS', w: 'mod',    label: 'Security',      g: 'geo'  },
  { a: 'UKR', b: 'DEU', w: 'strong', label: 'EU facility',   g: 'geo'  },
  { a: 'UKR', b: 'FRA', w: 'mod',    label: 'EU facility',   g: 'geo'  },
  { a: 'JPN', b: 'USA', w: 'strong', label: 'Carry trade',   g: 'fx'   },
  { a: 'IRN', b: 'ISR', w: 'strong', label: 'Proxy conflict',g: 'geo'  },
  { a: 'CHN', b: 'TWN', w: 'strong', label: 'Strait tension',g: 'geo'  },
];

// Country detail cards keyed by ISO
const DETAIL = {
  ARG: {
    subtitle: 'AR · South America · Economy',
    risk: 'H', delta: '+0.6', threads: 3, sources: 47, sentiment: '−0.42',
    sentDelta: '↑ 0.08', sentClass: 'e',
    leadTitle: 'Argentina signals new IMF agreement as peso volatility intensifies',
    thread: [
      { d: 'Apr 12', h: 'Economy Ministry confirms "technical mission" in Buenos Aires' },
      { d: 'Apr 14', h: 'Caputo rules out overnight devaluation on TV' },
      { d: 'Apr 16', h: 'Blue-dollar gap hits 38%, widest since January' },
      { d: 'Apr 18', h: 'IMF spokesperson: "constructive discussions ongoing"' },
    ],
    links: [
      { pair: 'AR ↔ US', desc: 'IMF program mechanics', w: 'strong' },
      { pair: 'AR ↔ BR', desc: 'Mercosur FX spillover',  w: 'mod'    },
      { pair: 'AR ↔ CN', desc: 'Soybean export channel', w: 'mod'    },
    ],
  },
  TWN: {
    subtitle: 'TW · Asia · Technology',
    risk: 'E', delta: '+0.2', threads: 2, sources: 31, sentiment: '−0.18',
    sentDelta: '↑ 0.04', sentClass: 'e',
    leadTitle: 'TSMC accelerates overseas fab push as US export controls tighten',
    thread: [
      { d: 'Apr 10', h: 'Arizona fab 2 construction milestone announced' },
      { d: 'Apr 13', h: 'Kumamoto plant 3 groundbreaking confirmed' },
      { d: 'Apr 17', h: 'ASML tool delivery window extended by 8 weeks' },
      { d: 'Apr 19', h: 'US Commerce reviews advanced-node export licensing' },
    ],
    links: [
      { pair: 'TW ↔ US', desc: 'Fab 2 AZ investment',   w: 'strong' },
      { pair: 'TW ↔ JP', desc: 'Kumamoto 3 joint stake', w: 'strong' },
      { pair: 'TW ↔ NL', desc: 'ASML tooling pipeline',  w: 'mod'    },
    ],
  },
  MLI: {
    subtitle: 'ML · Africa · Geopolitics',
    risk: 'H', delta: '+0.8', threads: 1, sources: 19, sentiment: '−0.61',
    sentDelta: '↑ 0.12', sentClass: 'h',
    leadTitle: 'AES customs union advances as Sahel states deepen ties with Russia',
    thread: [
      { d: 'Apr 11', h: 'Mali, Burkina Faso, Niger sign customs framework' },
      { d: 'Apr 14', h: 'CFA franc exit timeline discussed at Bamako summit' },
      { d: 'Apr 16', h: 'Wagner-linked forces deploy to border zone' },
      { d: 'Apr 18', h: 'ECOWAS calls emergency session on regional security' },
    ],
    links: [
      { pair: 'ML ↔ BF', desc: 'AES customs framework', w: 'strong' },
      { pair: 'ML ↔ NE', desc: 'AES customs framework', w: 'strong' },
      { pair: 'ML ↔ RU', desc: 'Security & mercenaries', w: 'mod'   },
    ],
  },
};

// Map region names (as they appear in archive entry.regions[]) to ISO3 keys in COUNTRY_DATA
const NAME_TO_A3 = Object.entries(COUNTRY_DATA).reduce((acc, [iso, c]) => {
  acc[c.n.toLowerCase()] = iso;
  return acc;
}, {
  'united states of america': 'USA', 'us': 'USA', 'u.s.': 'USA', 'u.s.a.': 'USA',
  'united kingdom': 'GBR', 'u.k.': 'GBR', 'britain': 'GBR',
  'south korea': 'KOR', 'republic of korea': 'KOR',
  'russian federation': 'RUS',
  'iran (islamic republic of)': 'IRN',
});

const RISK_FILL = { H: '#eab2a6', E: '#eed4a3', L: '#f2efe8' };
const RISK_MARKER = { H: '#c94a33', E: '#c98510', L: '#4fa07b' };
const FLOW_COLOR = { fx: '#0a0a0a', tech: '#3a3a3c', geo: '#6a6a6e' };

const NUM_TO_A3 = {
  '032':'ARG','076':'BRA','156':'CHN','276':'DEU','250':'FRA',
  '826':'GBR','356':'IND','360':'IDN','364':'IRN','376':'ISR',
  '392':'JPN','410':'KOR','484':'MEX','528':'NLD','562':'NER',
  '586':'PAK','643':'RUS','704':'VNM','792':'TUR','158':'TWN',
  '804':'UKR','840':'USA','862':'VEN','854':'BFA','466':'MLI',
};

const LENSES = [
  { id: 'risk',      label: 'News Signal',     sub: 'activity' },
  { id: 'flows',     label: 'Flows & Links',   sub: 'arcs'     },
  { id: 'editorial', label: 'Editorial Atlas', sub: 'top 5'    },
];

const LENS_TITLE = {
  risk:      { kicker: 'LENS · NEWS SIGNAL',      title: 'Where the world is loudest this week' },
  flows:     { kicker: 'LENS · NARRATIVE FLOWS',  title: 'Who is connected to whom' },
  editorial: { kicker: 'LENS · EDITORIAL ATLAS',  title: "This week's top stories, one map" },
};

const DEFAULT_DETAIL = DETAIL.ARG;
const DEFAULT_ISO = 'ARG';

export default function WorldMapV2() {
  const navigate = useNavigate();
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const d3Ref = useRef(null);   // { d3, topojson, projection, path }
  const worldRef = useRef(null);

  const [lens, setLens] = useState('risk');
  const [selectedISO, setSelectedISO] = useState(DEFAULT_ISO);
  const [detail, setDetail] = useState(DEFAULT_DETAIL);
  const [zoom, setZoom] = useState(1);
  const [railOpen, setRailOpen] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);

  const { signal, loading: sigLoading, ready: sigReady } = useCountrySignal(NAME_TO_A3);
  const { analyses: pairAnalyses } = usePairAnalyses();
  const { topics } = useGeminiTopics();
  const { dayMap } = useWeeklyArchive();

  const signalRef = useRef({});
  signalRef.current = signal;

  // Build real flow arcs from pair analyses
  const realFlows = useMemo(() => {
    if (!Array.isArray(pairAnalyses) || pairAnalyses.length === 0) return [];
    const out = [];
    for (const p of pairAnalyses) {
      const [c1, c2] = (p.countries || []).map(c => String(c).trim().toLowerCase());
      const a = NAME_TO_A3[c1];
      const b = NAME_TO_A3[c2];
      if (!a || !b || !COORDS[a] || !COORDS[b]) continue;
      const sA = signal[a]?.bucket || 'L';
      const sB = signal[b]?.bucket || 'L';
      const w = (sA === 'H' || sB === 'H') ? 'strong' : 'mod';
      // Infer group from pair title (fx/tech/geo) — fallback to geo
      const title = String(p.pairTitle || '').toLowerCase();
      let g = 'geo';
      if (/trade|tariff|export|import|peso|yen|lira|imf|fx|capital/.test(title)) g = 'fx';
      else if (/chip|semi|fab|ai|tech|cloud|data/.test(title)) g = 'tech';
      out.push({ a, b, w, g, label: p.pairTitle || `${a}×${b}`, slug: p.slug });
    }
    return out;
  }, [pairAnalyses, signal]);

  // Build editorial picks from top signal countries crossed with topics
  const editorialPicks = useMemo(() => {
    const ranked = Object.entries(signal)
      .filter(([iso, s]) => s.bucket !== 'L' && COORDS[iso])
      .sort((a, b) => (b[1].z || 0) - (a[1].z || 0))
      .slice(0, 5);
    return ranked.map(([iso, s], i) => {
      // Find a topic mentioning this country
      const name = COUNTRY_DATA[iso]?.n;
      const topic = topics.find(t =>
        Array.isArray(t.regions) && t.regions.some(r => r && String(r).toLowerCase() === name?.toLowerCase())
      );
      return {
        iso,
        n: String(i + 1),
        t: topic?.title?.slice(0, 48) || `${name} · signal z${s.z > 0 ? '+' : ''}${s.z}`,
        threadId: topic?.threadId,
      };
    });
  }, [signal, topics]);

  // Build detail for currently selected country from real data
  const liveDetail = useMemo(() => {
    if (!selectedISO) return null;
    const name = COUNTRY_DATA[selectedISO]?.n;
    if (!name) return null;
    const lc = name.toLowerCase();

    // Gather entries touching this country across archive
    const entries = [];
    const dates = Object.keys(dayMap).sort();
    for (const date of dates) {
      const day = dayMap[date];
      const items = Array.isArray(day) ? day : (day?.entries || []);
      for (const e of items) {
        const regions = Array.isArray(e.regions) ? e.regions : [];
        if (regions.some(r => r && String(r).toLowerCase() === lc)) {
          entries.push({ ...e, _date: date });
        }
      }
    }
    const recent = entries.slice(-6).reverse();
    const leadEntry = recent[0];

    // Pair links that include this country
    const links = (pairAnalyses || [])
      .filter(p => (p.countries || []).some(c => String(c).toLowerCase() === lc))
      .slice(0, 5)
      .map(p => {
        const other = (p.countries || []).find(c => String(c).toLowerCase() !== lc) || '';
        return {
          pair: `${selectedISO.slice(0, 2)} ↔ ${(NAME_TO_A3[other.toLowerCase()] || other).slice(0, 2).toUpperCase()}`,
          desc: p.pairTitle || p.leadSentence || 'Bilateral',
          w: 'strong',
          slug: p.slug,
        };
      });

    const region = COUNTRY_DATA[selectedISO]?.region || '';
    const category = COUNTRY_DATA[selectedISO]?.category || '';
    return {
      subtitle: `${selectedISO} · ${region}${category ? ` · ${category}` : ''}`,
      leadTitle: leadEntry?.title || (entries.length === 0 ? 'No recent coverage in window' : 'Recent coverage'),
      thread: recent.map(e => ({
        d: (e._date || '').slice(5),
        h: e.title,
        threadId: e.threadId,
      })),
      links,
    };
  }, [selectedISO, dayMap, pairAnalyses]);

  // Load Google Fonts once
  useEffect(() => {
    if (document.querySelector('link[data-mv2fonts]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.setAttribute('data-mv2fonts', '1');
    l.href = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap';
    document.head.appendChild(l);
  }, []);

  // Fetch world topo on mount
  useEffect(() => {
    const proj = d3.geoEqualEarth();
    const pathGen = d3.geoPath(proj);
    d3Ref.current = { d3, topojson, projection: proj, path: pathGen };

    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(r => r.json())
      .then(topo => {
        const world = topojson.feature(topo, topo.objects.countries);
        world.features.forEach(f => {
          const key = String(f.id).padStart(3, '0');
          f.id = NUM_TO_A3[key] || key;
        });
        worldRef.current = world;
        drawMap(lens, selectedISO, zoom);
      });
  }, []); // eslint-disable-line

  // Keep refs to real data for imperative drawMap
  const flowsRef = useRef([]);
  const picksRef = useRef([]);
  flowsRef.current = realFlows.length > 0 ? realFlows : FLOWS;
  picksRef.current = editorialPicks.length > 0 ? editorialPicks : [
    { iso: 'ARG', n: '1', t: 'Argentina · IMF' },
    { iso: 'TUR', n: '2', t: 'Turkey · lira' },
    { iso: 'TWN', n: '3', t: 'Taiwan · fabs' },
    { iso: 'MLI', n: '4', t: 'Sahel · AES' },
    { iso: 'UKR', n: '5', t: 'Ukraine · EU' },
  ];

  // Redraw when lens/selection/zoom/panel state changes or data arrives
  useEffect(() => {
    if (!worldRef.current) return;
    const t = setTimeout(() => drawMap(lens, selectedISO, zoom), 240);
    return () => clearTimeout(t);
  }, [lens, selectedISO, zoom, railOpen, panelOpen, sigReady, realFlows, editorialPicks]); // eslint-disable-line

  function drawMap(currentLens, currentISO, currentZoom) {
    const svg = svgRef.current;
    const wrap = wrapRef.current;
    if (!svg || !wrap || !d3Ref.current || !worldRef.current) return;

    const { projection, path } = d3Ref.current;
    const world = worldRef.current;
    const W = wrap.offsetWidth || wrap.getBoundingClientRect().width || 600;
    const H = wrap.offsetHeight || wrap.getBoundingClientRect().height || 480;

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);

    // Clear
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    // Update projection
    projection.fitSize([W - 20, H - 20], { type: 'Sphere' });
    projection.translate([W / 2, H / 2 + 10]);
    if (currentZoom !== 1) {
      const cx = W / 2, cy = H / 2;
      const cur = projection.translate();
      projection.scale(projection.scale() * currentZoom);
      projection.translate([
        cx + (cur[0] - cx) * currentZoom,
        cy + (cur[1] - cy) * currentZoom,
      ]);
    }

    const ns = 'http://www.w3.org/2000/svg';
    const el = (tag, attrs = {}) => {
      const e = document.createElementNS(ns, tag);
      Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
      return e;
    };

    // Sphere
    const sphere = el('path', { class: 'sphere', d: path({ type: 'Sphere' }) });
    svg.appendChild(sphere);

    // Graticule
    const grat = d3.geoGraticule10();
    const gratPath = el('path', { class: 'graticule', d: path(grat) });
    svg.appendChild(gratPath);

    const sig = signalRef.current;

    // Countries
    world.features.forEach(f => {
      const iso = f.id;
      let fill = '#f2efe8';
      if (currentLens === 'risk') {
        const s = sig[iso];
        const fallback = COUNTRY_DATA[iso];
        const bucket = s ? s.bucket : (fallback ? fallback.r : 'L');
        fill = RISK_FILL[bucket];
      } else if (currentLens === 'flows') {
        const hot = new Set(flowsRef.current.flatMap(fl => [fl.a, fl.b]));
        fill = hot.has(iso) ? '#e6e2d8' : '#f0ede6';
      }

      const p = el('path', {
        class: `country${iso === currentISO ? ' selected' : ''}`,
        d: path(f),
        fill,
        'data-iso': iso,
      });
      p.addEventListener('click', () => handleCountryClick(iso));
      svg.appendChild(p);
    });

    // Overlay layer
    if (currentLens === 'risk') {
      const sigEntries = Object.keys(sig).length > 0 ? sig : null;
      Object.entries(COUNTRY_DATA).forEach(([iso, c]) => {
        if (!COORDS[iso]) return;
        const s = sigEntries ? sig[iso] : null;
        const bucket = s ? s.bucket : c.r;
        if (bucket === 'L') return;
        const pt = projection(COORDS[iso]);
        if (!pt) return;
        const [x, y] = pt;
        const r = bucket === 'H' ? 6 : 4;
        const color = RISK_MARKER[bucket];

        const halo = el('circle', { cx: x, cy: y, r: r + 6, fill: color, 'fill-opacity': 0.15 });
        const dot = el('circle', { cx: x, cy: y, r, fill: color, stroke: '#fff', 'stroke-width': 1.5 });

        let deltaLabel;
        if (s) {
          const sign = s.z > 0 ? '+' : '';
          deltaLabel = `${iso.slice(0, 2)}  z${sign}${s.z}`;
        } else {
          const deltaSign = c.d > 0 ? '+' : '';
          deltaLabel = `${iso.slice(0, 2)}  ${deltaSign}${c.d.toFixed(1)}`;
        }
        const lbl = el('text', { class: 'label', x: x + r + 5, y: y + 3, fill: color });
        lbl.textContent = deltaLabel;
        svg.appendChild(halo);
        svg.appendChild(dot);
        svg.appendChild(lbl);
      });
    }

    if (currentLens === 'flows') {
      flowsRef.current.forEach(fl => {
        if (!COORDS[fl.a] || !COORDS[fl.b]) return;
        const pA = projection(COORDS[fl.a]);
        const pB = projection(COORDS[fl.b]);
        if (!pA || !pB) return;
        const [x1, y1] = pA, [x2, y2] = pB;
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        const dx = x2 - x1, dy = y2 - y1;
        const dist = Math.hypot(dx, dy);
        const nx = -dy / dist, ny = dx / dist;
        const cx = mx + nx * dist * 0.22, cy = my + ny * dist * 0.22;

        const arc = el('path', {
          class: 'flow',
          d: `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`,
          'data-slug': fl.slug || '',
          stroke: FLOW_COLOR[fl.g],
          'stroke-opacity': fl.w === 'strong' ? 0.75 : 0.35,
          'stroke-width': fl.w === 'strong' ? 1.8 : 1.0,
          'stroke-dasharray': fl.w === 'strong' ? '' : '3 3',
          style: fl.slug ? 'cursor: pointer' : '',
        });
        if (fl.slug) {
          arc.addEventListener('click', () => navigate(`/weekly/pair/${fl.slug}`));
        }
        svg.appendChild(arc);
      });

      // Nodes
      const nodes = new Set(flowsRef.current.flatMap(fl => [fl.a, fl.b]));
      nodes.forEach(iso => {
        if (!COORDS[iso]) return;
        const pt = projection(COORDS[iso]);
        if (!pt) return;
        const [x, y] = pt;
        const c = COUNTRY_DATA[iso];
        const color = c ? (c.r === 'H' ? '#c94a33' : c.r === 'E' ? '#c98510' : '#45454a') : '#45454a';
        const node = el('circle', { class: 'node', cx: x, cy: y, r: 4.5, fill: color });
        node.addEventListener('click', () => handleCountryClick(iso));
        const lbl = el('text', { class: 'label', x: x + 7, y: y + 3, fill: '#45454a' });
        lbl.textContent = iso;
        svg.appendChild(node);
        svg.appendChild(lbl);
      });
    }

    if (currentLens === 'editorial') {
      picksRef.current.forEach(p => {
        if (!COORDS[p.iso]) return;
        const pt = projection(COORDS[p.iso]);
        if (!pt) return;
        const [x, y] = pt;
        const circle = el('circle', { cx: x, cy: y, r: 11, fill: '#fff', stroke: '#0a0a0a', 'stroke-width': 1.4, style: 'cursor: pointer' });
        const num = el('text', {
          x, y: y + 4,
          'font-family': "'Fraunces',serif", 'font-size': 11,
          'font-weight': 600, 'text-anchor': 'middle', fill: '#0a0a0a',
          style: 'pointer-events: none',
        });
        num.textContent = p.n;
        const lbl = el('text', { class: 'label', x: x + 17, y: y + 3, fill: '#3a3a3c' });
        lbl.textContent = p.t;
        const handler = () => {
          if (p.threadId) navigate(`/weekly/thread/${p.threadId}`);
          else handleCountryClick(p.iso);
        };
        circle.addEventListener('click', handler);
        svg.appendChild(circle);
        svg.appendChild(num);
        svg.appendChild(lbl);
      });
    }
  }

  function handleCountryClick(iso) {
    setSelectedISO(iso);
    setDetail(DETAIL[iso] || null); // fallback; liveDetail takes precedence if present
  }

  const effectiveDetail = liveDetail || detail;

  const lensInfo = LENS_TITLE[lens];
  const showCaption = lens === 'editorial';

  const sigValues = Object.values(signal);
  const hasRealSignal = sigValues.length > 0;
  const highCount = hasRealSignal
    ? sigValues.filter(s => s.bucket === 'H').length
    : Object.values(COUNTRY_DATA).filter(c => c.r === 'H').length;
  const elevCount = hasRealSignal
    ? sigValues.filter(s => s.bucket === 'E').length
    : Object.values(COUNTRY_DATA).filter(c => c.r === 'E').length;

  return (
    <>
      {/* Preview banner */}
      <div className="mv2-preview-banner">
        <b>PREVIEW</b> · Map redesign v2 — new D3 three-lens design.
        Existing map at <a href="/map">/map →</a>
      </div>

      <div className="mv2">

        {/* Status strip */}
        <div className="mv2-status">
          <span><span className="dot" />{sigLoading ? 'LOADING…' : 'LIVE'}</span>
          <span><b>{highCount}</b> HIGH SIGNAL</span>
          <span className="amb">⚑ {highCount} HIGH · {elevCount} ELEVATED · 7d</span>
          <span className="sp" />
          <span>PROJECTION <b>EQUAL-EARTH</b></span>
          <span>SIGNAL <b>{hasRealSignal ? 'LIVE · 30D Z-SCORE' : 'MOCK'}</b></span>
        </div>

        <div className={`mv2-body${!railOpen && !panelOpen ? ' both-collapsed' : !railOpen ? ' rail-collapsed' : !panelOpen ? ' panel-collapsed' : ''}`}>

          {/* Left rail */}
          <aside className="mv2-rail">
            <div className="grp">
              <h5>Lens</h5>
              {LENSES.map(l => (
                <div
                  key={l.id}
                  className={`opt${lens === l.id ? ' on' : ''}`}
                  onClick={() => setLens(l.id)}
                >
                  <span className="box" />
                  {l.label}
                  <span className="c">{l.sub}</span>
                </div>
              ))}
            </div>

            {lens === 'risk' && (
              <div className="grp">
                <h5>Signal level</h5>
                <div className="chk on">
                  <span className="box" />
                  <span className="pill" style={{ background: '#fbe9e3', color: '#c94a33' }}>High</span>
                  <span className="c">{highCount}</span>
                </div>
                <div className="chk on">
                  <span className="box" />
                  <span className="pill" style={{ background: '#fbf0dc', color: '#d89540' }}>Elevated</span>
                  <span className="c">{elevCount}</span>
                </div>
                <div className="chk on">
                  <span className="box" />
                  <span className="pill" style={{ background: '#e4f1e9', color: '#4fa07b' }}>Quiet</span>
                  <span className="c">{hasRealSignal ? sigValues.filter(s => s.bucket === 'L').length : Object.values(COUNTRY_DATA).filter(c => c.r === 'L').length}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-dim)', marginTop: 10, lineHeight: 1.5 }}>
                  Signal = how unusually active a country's coverage is this week vs its own 30-day baseline (z-score).
                  <br />High ≥ 1.5σ · Elevated ≥ 0.5σ.
                </div>
              </div>
            )}

            {lens === 'flows' && (
              <div className="grp">
                <h5>Flow type</h5>
                {['fx','tech','geo'].map(g => {
                  const count = flowsRef.current.filter(fl => fl.g === g).length;
                  const label = g === 'fx' ? 'FX / Capital' : g === 'tech' ? 'Technology' : 'Geopolitics';
                  const color = FLOW_COLOR[g];
                  return (
                    <div className="chk on" key={g}>
                      <span className="box" />
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 16, height: 2, background: color, display: 'inline-block' }} />
                        {label}
                      </span>
                      <span className="c">{count}</span>
                    </div>
                  );
                })}
                <div style={{ fontSize: 11, color: 'var(--ink-dim)', marginTop: 8, fontStyle: 'italic' }}>
                  Click an arc to open the pair analysis.
                </div>
              </div>
            )}

            {lens === 'editorial' && (
              <div className="grp">
                <h5>Top stories this week</h5>
                {picksRef.current.map(p => (
                  <div
                    key={p.iso + p.n}
                    className={`chk${selectedISO === p.iso ? ' on' : ''}`}
                    onClick={() => {
                      if (p.threadId) navigate(`/weekly/thread/${p.threadId}`);
                      else handleCountryClick(p.iso);
                    }}
                    style={{ alignItems: 'center', cursor: 'pointer' }}
                  >
                    <span style={{
                      width: 18, height: 18, border: '1.5px solid #0a0a0a',
                      borderRadius: '50%', display: 'inline-flex',
                      alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--mono, monospace)', fontSize: 10, fontWeight: 700,
                      flexShrink: 0,
                    }}>{p.n}</span>
                    {p.t}
                  </div>
                ))}
                {picksRef.current.length === 0 && (
                  <div style={{ color: 'var(--ink-dim)', fontSize: 12 }}>Loading top signals…</div>
                )}
              </div>
            )}

            <div className="grp">
              <h5>Time window</h5>
              <div className="opt on"><span className="box" />Today<span className="c">6</span></div>
              <div className="opt"><span className="box" />7 days<span className="c">41</span></div>
              <div className="opt"><span className="box" />30 days<span className="c">142</span></div>
            </div>
          </aside>

          {/* Map */}
          <div className="mv2-mapwrap">
            <div className="title">
              <div>
                <div className="kicker">{lensInfo.kicker}</div>
                <h1>{lensInfo.title}</h1>
              </div>
              <div className="legend">
                {lens === 'risk' && (
                  <>
                    <span className="cell"><span className="sw" style={{ background: '#eab2a6' }} />High signal</span>
                    <span className="cell"><span className="sw" style={{ background: '#eed4a3' }} />Elevated</span>
                    <span className="cell"><span className="sw" style={{ background: '#f2efe8' }} />Quiet</span>
                  </>
                )}
                {lens === 'flows' && (
                  <>
                    <span className="cell"><span className="sw" style={{ background: '#0a0a0a', height: 3 }} />FX</span>
                    <span className="cell"><span className="sw" style={{ background: '#3a3a3c', height: 3 }} />Tech</span>
                    <span className="cell"><span className="sw" style={{ background: '#6a6a6e', height: 3 }} />Geo</span>
                    <span className="cell" style={{ fontFamily: 'var(--mono, monospace)', fontSize: 10 }}>— strong · ┄ moderate</span>
                  </>
                )}
                {lens === 'editorial' && (
                  <span className="cell">Numbered stories · tap to read</span>
                )}
              </div>
            </div>

            <div className="mv2-map" ref={wrapRef}>
              <svg className="map-svg" ref={svgRef} />

              <button
                className="mv2-corner-toggle left"
                onClick={() => setRailOpen(o => !o)}
                title={railOpen ? 'Hide filters' : 'Show filters'}
              >
                <span className="chev">{railOpen ? '‹' : '›'}</span>
                Filters
              </button>

              <button
                className="mv2-corner-toggle right"
                onClick={() => setPanelOpen(o => !o)}
                title={panelOpen ? 'Hide detail' : 'Show detail'}
              >
                Detail
                <span className="chev">{panelOpen ? '›' : '‹'}</span>
              </button>

              {showCaption && picksRef.current.length > 0 && (
                <div className="mv2-caption">
                  <div className="ey">EDITORIAL · TOP {picksRef.current.length} BY SIGNAL</div>
                  <h3>Where the week's story is loudest</h3>
                  <p>Ranked by 7-day z-score against each country's own 30-day baseline. {picksRef.current.slice(0,3).map(p => COUNTRY_DATA[p.iso]?.n || p.iso).join(', ')} lead the list — click any numbered pin to open the story.</p>
                </div>
              )}

              <div className="mv2-mapctl">
                <button title="Zoom in" onClick={() => setZoom(z => Math.min(z * 1.4, 6))}>+</button>
                <button title="Zoom out" onClick={() => setZoom(z => Math.max(z / 1.4, 0.5))}>−</button>
                <button title="Reset" onClick={() => setZoom(1)}>◯</button>
              </div>
            </div>
          </div>

          {/* Right panel */}
          <aside className="mv2-panel">
            {effectiveDetail ? (
              <>
                <div className="hd">
                  <div>
                    <div className="cc">{effectiveDetail.subtitle}</div>
                    <h2>{COUNTRY_DATA[selectedISO]?.n || selectedISO}</h2>
                  </div>
                  <span className="flag">{selectedISO?.slice(0, 2)}</span>
                </div>

                {(() => {
                  const s = signal[selectedISO];
                  const fallback = COUNTRY_DATA[selectedISO] || {};
                  const bucket = s ? s.bucket : (effectiveDetail.risk || 'L');
                  const bucketLabel = bucket === 'H' ? 'High' : bucket === 'E' ? 'Elevated' : 'Low';
                  const bucketClass = bucket === 'H' ? 'h' : bucket === 'E' ? 'e' : '';
                  return (
                    <div className="stats">
                      <div className="stat">
                        <div className="k">Signal</div>
                        <div className={`v ${bucketClass}`}>{bucketLabel}</div>
                        {s ? (
                          <div className={`d ${s.z > 0 ? 'up' : s.z < 0 ? 'dn' : ''}`} title="z-score vs 30d baseline">
                            z {s.z > 0 ? '+' : ''}{s.z} · 7d
                          </div>
                        ) : (
                          <div className="d">—</div>
                        )}
                      </div>
                      <div className="stat">
                        <div className="k">Articles</div>
                        <div className="v">{s ? s.last7 : (fallback.t || '—')}</div>
                        <div className="d">{s ? `vs ~${s.prior7} baseline` : 'last 7d'}</div>
                      </div>
                      <div className="stat">
                        <div className="k">Threads</div>
                        <div className="v">{s ? s.last7Threads : (fallback.t || '—')}</div>
                        <div className="d">last 7d</div>
                      </div>
                    </div>
                  );
                })()}

                <div className="section">
                  <h4>Recent coverage <span className="n">{effectiveDetail.thread?.length || 0}</span></h4>
                  <div className="lead-title">{effectiveDetail.leadTitle}</div>
                  <div className="thread">
                    {(effectiveDetail.thread || []).map((r, i) => (
                      <div
                        className="r"
                        key={i}
                        style={r.threadId ? { cursor: 'pointer' } : undefined}
                        onClick={r.threadId ? () => navigate(`/weekly/thread/${r.threadId}`) : undefined}
                      >
                        <span className="d">{r.d}</span>
                        <span>{r.h}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {effectiveDetail.links && effectiveDetail.links.length > 0 && (
                  <div className="section">
                    <h4>Cross-country links <span className="n">{effectiveDetail.links.length}</span></h4>
                    <div className="links">
                      {effectiveDetail.links.map((l, i) => (
                        <div
                          className="link"
                          key={i}
                          style={l.slug ? { cursor: 'pointer' } : undefined}
                          onClick={l.slug ? () => navigate(`/weekly/pair/${l.slug}`) : undefined}
                        >
                          <span className="pair">{l.pair}</span>
                          <span className="desc">{l.desc}</span>
                          <span className={`w ${l.w}`}>{l.w}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="actions-row">
                  <button className="btn">Add to watchlist</button>
                  <button
                    className="btn primary"
                    onClick={() => navigate(`/weekly/country/${encodeURIComponent(COUNTRY_DATA[selectedISO]?.n || selectedISO)}`)}
                  >
                    Open country →
                  </button>
                </div>
              </>
            ) : (
              <div style={{ padding: '24px 20px', color: 'var(--ink-dim)', fontSize: 13, fontFamily: 'var(--sans)' }}>
                Click any country on the map to see details.
              </div>
            )}
          </aside>

        </div>

        {/* Footer */}
        <div className="mv2-foot">
          <span>BASE <b>NATURAL EARTH 1:110M</b></span>
          <span>D3 EQUAL-EARTH</span>
          <span className="sp" />
          <span>GLOBAL PERSPECTIVES™ · MAP V2 PREVIEW</span>
        </div>

      </div>
    </>
  );
}
