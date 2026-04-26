import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { useCountrySignal } from '../hooks/useCountrySignal';
import { usePairAnalyses } from '../hooks/usePairAnalyses';
import { useGeminiTopics } from '../hooks/useGeminiTopics';
import { useWeeklyArchive } from '../hooks/useWeeklyArchive';
import { useCountryIntelligence } from '../hooks/useCountryIntelligence';
import { useCountryHistory } from '../hooks/useCountryHistory';
import { useSystemsAnalysis } from '../hooks/useSystemsAnalysis';
import { useMarketsCountry } from '../hooks/useMarketsCountry';
import './WorldMapV2.css';

// UN M.49 numeric → ISO 3166-1 alpha-3
const NUM_TO_A3 = {
  '004':'AFG','008':'ALB','012':'DZA','024':'AGO','028':'ATG','031':'AZE',
  '032':'ARG','036':'AUS','040':'AUT','044':'BHS','048':'BHR','050':'BGD',
  '052':'BRB','056':'BEL','064':'BTN','068':'BOL','070':'BIH','072':'BWA',
  '076':'BRA','084':'BLZ','096':'BRN','100':'BGR','104':'MMR','108':'BDI',
  '112':'BLR','116':'KHM','120':'CMR','124':'CAN','132':'CPV','140':'CAF',
  '144':'LKA','148':'TCD','152':'CHL','156':'CHN','158':'TWN','170':'COL',
  '174':'COM','178':'COG','180':'COD','188':'CRI','191':'HRV','192':'CUB',
  '196':'CYP','203':'CZE','204':'BEN','208':'DNK','214':'DOM','218':'ECU',
  '222':'SLV','226':'GNQ','231':'ETH','232':'ERI','233':'EST','238':'FLK',
  '242':'FJI','246':'FIN','250':'FRA','262':'DJI','266':'GAB','268':'GEO',
  '270':'GMB','276':'DEU','288':'GHA','296':'KIR','300':'GRC','320':'GTM',
  '324':'GIN','328':'GUY','332':'HTI','340':'HND','348':'HUN','356':'IND',
  '360':'IDN','364':'IRN','368':'IRQ','372':'IRL','376':'ISR','380':'ITA',
  '388':'JAM','392':'JPN','398':'KAZ','400':'JOR','404':'KEN','408':'PRK',
  '410':'KOR','414':'KWT','417':'KGZ','418':'LAO','422':'LBN','426':'LSO',
  '428':'LVA','430':'LBR','434':'LBY','440':'LTU','442':'LUX','450':'MDG',
  '454':'MWI','458':'MYS','462':'MDV','466':'MLI','470':'MLT','478':'MRT',
  '480':'MUS','484':'MEX','496':'MNG','498':'MDA','499':'MNE','504':'MAR',
  '508':'MOZ','516':'NAM','520':'NRU','524':'NPL','528':'NLD','554':'NZL',
  '558':'NIC','562':'NER','566':'NGA','578':'NOR','583':'FSM','585':'PLW',
  '586':'PAK','591':'PAN','598':'PNG','600':'PRY','604':'PER','608':'PHL',
  '616':'POL','620':'PRT','624':'GNB','626':'TLS','634':'QAT','642':'ROU',
  '643':'RUS','646':'RWA','659':'KNA','662':'LCA','670':'VCT','678':'STP',
  '682':'SAU','686':'SEN','688':'SRB','694':'SLE','703':'SVK','704':'VNM',
  '705':'SVN','706':'SOM','710':'ZAF','716':'ZWE','724':'ESP','728':'SSD',
  '729':'SDN','740':'SUR','748':'SWZ','752':'SWE','756':'CHE','760':'SYR',
  '762':'TJK','764':'THA','768':'TGO','776':'TON','780':'TTO','784':'ARE',
  '788':'TUN','792':'TUR','795':'TKM','800':'UGA','804':'UKR','807':'MKD',
  '818':'EGY','826':'GBR','840':'USA','854':'BFA','858':'URY','860':'UZB',
  '862':'VEN','882':'WSM','887':'YEM','894':'ZMB',
};

// Normalize TopoJSON feature names to canonical news-archive names
const TOPO_NAME_FIXES = {
  'united states of america': 'United States',
  'russian federation': 'Russia',
  "dem. rep. korea": 'North Korea',
  "democratic people's republic of korea": 'North Korea',
  'republic of korea': 'South Korea',
  'korea, republic of': 'South Korea',
  'viet nam': 'Vietnam',
  'iran, islamic republic of': 'Iran',
  'iran (islamic republic of)': 'Iran',
  'united republic of tanzania': 'Tanzania',
  'dem. rep. congo': 'DR Congo',
  'democratic republic of the congo': 'DR Congo',
  "congo, the democratic republic of the": 'DR Congo',
  'republic of moldova': 'Moldova',
  'moldova, republic of': 'Moldova',
  'taiwan, province of china': 'Taiwan',
  'venezuela, bolivarian republic of': 'Venezuela',
  'bolivia, plurinational state of': 'Bolivia',
  "lao pdr": 'Laos',
  "lao people's democratic republic": 'Laos',
  'central african rep.': 'Central African Republic',
  'eq. guinea': 'Equatorial Guinea',
  's. sudan': 'South Sudan',
  'czech rep.': 'Czech Republic',
  'czechia': 'Czech Republic',
  "côte d'ivoire": 'Ivory Coast',
  'cote d\'ivoire': 'Ivory Coast',
  'w. sahara': 'Western Sahara',
  'eswatini': 'Eswatini',
  'north korea': 'North Korea',
  'south korea': 'South Korea',
};

// Extra aliases that archive entries may use
const EXTRA_ALIASES = {
  'us': 'USA', 'u.s.': 'USA', 'u.s.a.': 'USA', 'america': 'USA',
  'united states': 'USA', 'united states of america': 'USA',
  'uk': 'GBR', 'u.k.': 'GBR', 'britain': 'GBR', 'england': 'GBR',
  'russia': 'RUS', 'south korea': 'KOR', 'north korea': 'PRK',
  'taiwan': 'TWN', 'iran': 'IRN', 'vietnam': 'VNM',
  'dr congo': 'COD', 'drc': 'COD', 'czech republic': 'CZE',
  'syria': 'SYR', 'laos': 'LAO', 'moldova': 'MDA',
  'venezuela': 'VEN', 'bolivia': 'BOL', 'tanzania': 'TZA',
  'burma': 'MMR', 'myanmar': 'MMR',
  'ivory coast': 'CIV', 'cote divoire': 'CIV',
  'south africa': 'ZAF', 'uae': 'ARE', 'united arab emirates': 'ARE',
  'saudi arabia': 'SAU', 'new zealand': 'NZL',
  'north macedonia': 'MKD', 'macedonia': 'MKD',
  'east timor': 'TLS', 'timor-leste': 'TLS',
};

const RISK_FILL   = { H: '#eab2a6', E: '#eed4a3', L: '#f2efe8' };
const RISK_MARKER = { H: '#c94a33', E: '#c98510', L: '#4fa07b' };
const FLOW_COLOR  = { fx: '#0a0a0a', tech: '#3a3a3c', geo: '#6a6a6e' };

const LENSES = [
  { id: 'risk',      label: 'News Signal',    sub: 'activity' },
  { id: 'flows',     label: 'Flows & Links',  sub: 'arcs'     },
  { id: 'editorial', label: 'Editorial Atlas',sub: 'top 5'    },
];

const LENS_TITLE = {
  risk:      { kicker: 'LENS · NEWS SIGNAL',     title: 'Where the world is loudest this week' },
  flows:     { kicker: 'LENS · NARRATIVE FLOWS', title: 'Who is connected to whom' },
  editorial: { kicker: 'LENS · EDITORIAL ATLAS', title: "This week's top stories, one map" },
};

function Sparkline({ snapshots }) {
  if (!snapshots || snapshots.length < 2) return null;
  const scores = snapshots.map(s => s.riskScore ?? null).filter(v => v != null);
  if (scores.length < 2) return null;
  const min = Math.min(...scores), max = Math.max(...scores);
  const range = max - min || 1;
  const w = 52, h = 16;
  const pts = scores.map((v, i) => {
    const x = (i / (scores.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 2) - 1;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: 4 }}>
      <polyline points={pts} fill="none" stroke="var(--risk-h)" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export default function WorldMapV2() {
  const navigate = useNavigate();
  const svgRef  = useRef(null);
  const wrapRef = useRef(null);
  const d3Ref   = useRef(null);
  const worldRef = useRef(null);

  const [lens, setLens] = useState('risk');
  const [selectedISO, setSelectedISO] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [railOpen, setRailOpen] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);

  // Dynamic maps built after TopoJSON loads
  const [nameToISO, setNameToISO] = useState({});
  const [isoToName, setIsoToName] = useState({});
  const isoToCenterRef = useRef({});
  const nameToISORef   = useRef({});

  const { signal, loading: sigLoading, ready: sigReady } = useCountrySignal(nameToISO);
  const { analyses: pairAnalyses } = usePairAnalyses();
  const { topics } = useGeminiTopics();
  const { dayMap } = useWeeklyArchive();

  // Derived: canonical name for selected country
  const selectedName = useMemo(
    () => (selectedISO ? (isoToName[selectedISO] || null) : null),
    [selectedISO, isoToName]
  );

  // Per-country backend hooks (fire only when a country is selected)
  const { intelligence } = useCountryIntelligence(selectedName ? [selectedName] : []);
  const intel = intelligence?.[selectedName];
  const { snapshots } = useCountryHistory(selectedName);
  const { data: systemsData } = useSystemsAnalysis(selectedName);
  const { data: markets } = useMarketsCountry(selectedName);

  const signalRef = useRef({});
  signalRef.current = signal;

  const topicsRef = useRef([]);
  topicsRef.current = topics;

  // Keep nameToISO ref in sync for drawMap (imperative context)
  useEffect(() => { nameToISORef.current = nameToISO; }, [nameToISO]);

  // Build real flow arcs from pair analyses
  const realFlows = useMemo(() => {
    if (!Array.isArray(pairAnalyses) || pairAnalyses.length === 0) return [];
    const out = [];
    for (const p of pairAnalyses) {
      const [c1, c2] = (p.countries || []).map(c => String(c).trim().toLowerCase());
      const a = nameToISO[c1] || EXTRA_ALIASES[c1];
      const b = nameToISO[c2] || EXTRA_ALIASES[c2];
      if (!a || !b || !isoToCenterRef.current[a] || !isoToCenterRef.current[b]) continue;
      const sA = signal[a]?.bucket || 'L';
      const sB = signal[b]?.bucket || 'L';
      const w = (sA === 'H' || sB === 'H') ? 'strong' : 'mod';
      const title = String(p.pairTitle || '').toLowerCase();
      let g = 'geo';
      if (/trade|tariff|export|import|peso|yen|lira|imf|fx|capital/.test(title)) g = 'fx';
      else if (/chip|semi|fab|ai|tech|cloud|data/.test(title)) g = 'tech';
      out.push({ a, b, w, g, label: p.pairTitle || `${a}×${b}`, slug: p.slug });
    }
    return out;
  }, [pairAnalyses, signal, nameToISO]);

  // Build editorial picks from top-signal countries
  const editorialPicks = useMemo(() => {
    const ranked = Object.entries(signal)
      .filter(([iso, s]) => s.bucket !== 'L' && isoToCenterRef.current[iso])
      .sort((a, b) => (b[1].z || 0) - (a[1].z || 0))
      .slice(0, 5);
    return ranked.map(([iso, s], i) => {
      const name = isoToName[iso];
      const topic = topics.find(t =>
        Array.isArray(t.regions) && t.regions.some(r => r && String(r).toLowerCase() === name?.toLowerCase())
      );
      return {
        iso,
        n: String(i + 1),
        t: topic?.title?.slice(0, 48) || `${name || iso} · z${s.z > 0 ? '+' : ''}${s.z}`,
        threadId: topic?.threadId,
      };
    });
  }, [signal, topics, isoToName]);

  // Build detail panel from archive data for selected country
  const liveDetail = useMemo(() => {
    if (!selectedISO || !selectedName) return null;
    const lc = selectedName.toLowerCase();

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

    const links = (pairAnalyses || [])
      .filter(p => (p.countries || []).some(c => String(c).toLowerCase() === lc))
      .slice(0, 5)
      .map(p => {
        const other = (p.countries || []).find(c => String(c).toLowerCase() !== lc) || '';
        const otherISO = nameToISO[other.toLowerCase()] || EXTRA_ALIASES[other.toLowerCase()] || other;
        return {
          pair: `${selectedISO.slice(0, 2)} ↔ ${otherISO.slice(0, 2).toUpperCase()}`,
          desc: p.pairTitle || p.leadSentence || 'Bilateral',
          w: 'strong',
          slug: p.slug,
        };
      });

    return {
      leadTitle: leadEntry?.title || null,
      thread: recent.map(e => ({ d: (e._date || '').slice(5), h: e.title, threadId: e.threadId })),
      links,
      hasData: entries.length > 0,
    };
  }, [selectedISO, selectedName, dayMap, pairAnalyses, nameToISO]);

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
        const nISO = {};
        const nName = {};

        world.features.forEach(f => {
          const key = String(f.id).padStart(3, '0');
          const iso = NUM_TO_A3[key] || key;
          f.id = iso;

          const rawName = f.properties?.name || '';
          const fixed = TOPO_NAME_FIXES[rawName.toLowerCase()] || rawName;
          nISO[rawName.toLowerCase()] = iso;
          nISO[fixed.toLowerCase()] = iso;
          nName[iso] = fixed;
          isoToCenterRef.current[iso] = d3.geoCentroid(f);
        });

        // Overlay extra aliases so archive-style names always resolve
        Object.entries(EXTRA_ALIASES).forEach(([alias, iso]) => {
          if (!nISO[alias]) nISO[alias] = iso;
        });

        worldRef.current = world;
        setNameToISO(nISO);
        setIsoToName(nName);
        drawMap(lens, selectedISO, zoom);
      });
  }, []); // eslint-disable-line

  const flowsRef = useRef([]);
  const picksRef = useRef([]);
  flowsRef.current = realFlows;
  picksRef.current = editorialPicks;

  // Redraw when lens/selection/zoom/data changes
  useEffect(() => {
    if (!worldRef.current) return;
    const t = setTimeout(() => drawMap(lens, selectedISO, zoom), 240);
    return () => clearTimeout(t);
  }, [lens, selectedISO, zoom, railOpen, panelOpen, sigReady, realFlows, editorialPicks]); // eslint-disable-line

  function drawMap(currentLens, currentISO, currentZoom) {
    const svg  = svgRef.current;
    const wrap = wrapRef.current;
    if (!svg || !wrap || !d3Ref.current || !worldRef.current) return;

    const { projection, path } = d3Ref.current;
    const world = worldRef.current;
    const W = wrap.offsetWidth  || wrap.getBoundingClientRect().width  || 600;
    const H = wrap.offsetHeight || wrap.getBoundingClientRect().height || 480;

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width',  W);
    svg.setAttribute('height', H);

    while (svg.firstChild) svg.removeChild(svg.firstChild);

    projection.fitSize([W - 20, H - 20], { type: 'Sphere' });
    projection.translate([W / 2, H / 2 + 10]);
    if (currentZoom !== 1) {
      const cx = W / 2, cy = H / 2;
      const cur = projection.translate();
      projection.scale(projection.scale() * currentZoom);
      projection.translate([cx + (cur[0] - cx) * currentZoom, cy + (cur[1] - cy) * currentZoom]);
    }

    const ns = 'http://www.w3.org/2000/svg';
    const el = (tag, attrs = {}) => {
      const e = document.createElementNS(ns, tag);
      Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
      return e;
    };

    svg.appendChild(el('path', { class: 'sphere', d: path({ type: 'Sphere' }) }));
    svg.appendChild(el('path', { class: 'graticule', d: path(d3.geoGraticule10()) }));

    const sig = signalRef.current;

    // Country fills
    world.features.forEach(f => {
      const iso = f.id;
      let fill = '#f2efe8';
      if (currentLens === 'risk') {
        const bucket = sig[iso]?.bucket || 'L';
        fill = RISK_FILL[bucket];
      } else if (currentLens === 'flows') {
        const hot = new Set(flowsRef.current.flatMap(fl => [fl.a, fl.b]));
        fill = hot.has(iso) ? '#e6e2d8' : '#f0ede6';
      }
      const p = el('path', {
        class: `country${iso === currentISO ? ' selected' : ''}`,
        d: path(f), fill, 'data-iso': iso,
      });
      p.addEventListener('click', () => handleCountryClick(iso));
      svg.appendChild(p);
    });

    if (currentLens === 'risk') {
      // Signal markers for elevated/high countries
      Object.entries(sig).forEach(([iso, s]) => {
        if (s.bucket === 'L') return;
        const center = isoToCenterRef.current[iso];
        if (!center) return;
        const pt = projection(center);
        if (!pt) return;
        const [x, y] = pt;
        const r = s.bucket === 'H' ? 6 : 4;
        const color = RISK_MARKER[s.bucket];
        const sign  = s.z > 0 ? '+' : '';

        svg.appendChild(el('circle', { cx: x, cy: y, r: r + 6, fill: color, 'fill-opacity': 0.15 }));
        svg.appendChild(el('circle', { cx: x, cy: y, r, fill: color, stroke: '#fff', 'stroke-width': 1.5 }));
        const lbl = el('text', { class: 'label', x: x + r + 5, y: y + 3, fill: color });
        lbl.textContent = `${iso.slice(0, 2)}  z${sign}${s.z}`;
        svg.appendChild(lbl);
      });

      // Urgency halo for high-urgency topics from last 24h
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const haloISOs = new Set();
      for (const topic of topicsRef.current) {
        if (topic.urgency !== 'high') continue;
        const ts = topic.timestamp ? new Date(topic.timestamp).getTime() : 0;
        if (now - ts > dayMs) continue;
        const pc = topic.primaryCountry || (Array.isArray(topic.regions) ? topic.regions[0] : null);
        if (!pc) continue;
        const iso = nameToISORef.current[pc.toLowerCase()] || EXTRA_ALIASES[pc.toLowerCase()];
        if (iso) haloISOs.add(iso);
      }
      haloISOs.forEach(iso => {
        const center = isoToCenterRef.current[iso];
        if (!center) return;
        const pt = projection(center);
        if (!pt) return;
        const [x, y] = pt;
        svg.appendChild(el('circle', { cx: x, cy: y, r: 14, class: 'urgency-halo', fill: 'none', stroke: '#c94a33', 'stroke-width': 1.5, 'stroke-opacity': 0.7 }));
      });
    }

    if (currentLens === 'flows') {
      flowsRef.current.forEach(fl => {
        const cA = isoToCenterRef.current[fl.a];
        const cB = isoToCenterRef.current[fl.b];
        if (!cA || !cB) return;
        const pA = projection(cA), pB = projection(cB);
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
        if (fl.slug) arc.addEventListener('click', () => navigate(`/weekly/pair/${fl.slug}`));
        svg.appendChild(arc);
      });

      const nodes = new Set(flowsRef.current.flatMap(fl => [fl.a, fl.b]));
      nodes.forEach(iso => {
        const center = isoToCenterRef.current[iso];
        if (!center) return;
        const pt = projection(center);
        if (!pt) return;
        const [x, y] = pt;
        const s = sig[iso];
        const color = s ? (s.bucket === 'H' ? '#c94a33' : s.bucket === 'E' ? '#c98510' : '#45454a') : '#45454a';
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
        const center = isoToCenterRef.current[p.iso];
        if (!center) return;
        const pt = projection(center);
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
    if (!panelOpen) setPanelOpen(true);
  }

  const lensInfo   = LENS_TITLE[lens];
  const showCaption = lens === 'editorial';

  const sigValues    = Object.values(signal);
  const hasRealSignal = sigValues.length > 0;
  const highCount = sigValues.filter(s => s.bucket === 'H').length;
  const elevCount = sigValues.filter(s => s.bucket === 'E').length;

  const riskColor = intel?.riskLevel === 'high' ? 'var(--risk-h)' : intel?.riskLevel === 'elevated' ? 'var(--risk-e)' : intel?.riskLevel === 'low' ? 'var(--risk-l)' : 'var(--ink-dim)';

  return (
    <div className="mv2">

      {/* Status strip */}
      <div className="mv2-status">
        <span><span className="dot" />{sigLoading ? 'LOADING…' : 'LIVE'}</span>
        <span><b>{highCount}</b> HIGH SIGNAL</span>
        <span className="amb">⚑ {highCount} HIGH · {elevCount} ELEVATED · 7d</span>
        <span className="sp" />
        <span>PROJECTION <b>EQUAL-EARTH</b></span>
        <span>SIGNAL <b>{hasRealSignal ? 'LIVE · 30D Z-SCORE' : 'LOADING'}</b></span>
      </div>

      <div className={`mv2-body${!railOpen && !panelOpen ? ' both-collapsed' : !railOpen ? ' rail-collapsed' : !panelOpen ? ' panel-collapsed' : ''}`}>

        {/* Left rail */}
        <aside className="mv2-rail">
          <div className="grp">
            <h5>Lens</h5>
            {LENSES.map(l => (
              <div key={l.id} className={`opt${lens === l.id ? ' on' : ''}`} onClick={() => setLens(l.id)}>
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
                <span className="c">{sigValues.filter(s => s.bucket === 'L').length}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-dim)', marginTop: 10, lineHeight: 1.5 }}>
                Signal = how unusually active a country's coverage is vs its own 30-day baseline (z-score).
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
              {flowsRef.current.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--ink-dim)', marginTop: 8, fontStyle: 'italic' }}>
                  No pair analyses in this window yet.
                </div>
              )}
              {flowsRef.current.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--ink-dim)', marginTop: 8, fontStyle: 'italic' }}>
                  Click an arc to open the pair analysis.
                </div>
              )}
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
                <div style={{ color: 'var(--ink-dim)', fontSize: 12, fontStyle: 'italic' }}>Loading signal data…</div>
              )}
            </div>
          )}

          <div className="grp">
            <h5>Time window</h5>
            <div className="opt on"><span className="box" />7 days<span className="c">{sigValues.reduce((a, s) => a + (s.last7 || 0), 0) || '—'}</span></div>
            <div className="opt"><span className="box" />30 days<span className="c">baseline</span></div>
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
                  <span className="cell" style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>◎ urgent (24h)</span>
                </>
              )}
              {lens === 'flows' && (
                <>
                  <span className="cell"><span className="sw" style={{ background: '#0a0a0a', height: 3 }} />FX</span>
                  <span className="cell"><span className="sw" style={{ background: '#3a3a3c', height: 3 }} />Tech</span>
                  <span className="cell"><span className="sw" style={{ background: '#6a6a6e', height: 3 }} />Geo</span>
                  <span className="cell" style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>— strong · ┄ moderate</span>
                </>
              )}
              {lens === 'editorial' && <span className="cell">Numbered stories · tap to read</span>}
            </div>
          </div>

          <div className="mv2-map" ref={wrapRef}>
            <svg className="map-svg" ref={svgRef} />

            <button className="mv2-corner-toggle left" onClick={() => setRailOpen(o => !o)} title={railOpen ? 'Hide filters' : 'Show filters'}>
              <span className="chev">{railOpen ? '‹' : '›'}</span>
              Filters
            </button>

            <button className="mv2-corner-toggle right" onClick={() => setPanelOpen(o => !o)} title={panelOpen ? 'Hide detail' : 'Show detail'}>
              Detail
              <span className="chev">{panelOpen ? '›' : '‹'}</span>
            </button>

            {showCaption && picksRef.current.length > 0 && (
              <div className="mv2-caption">
                <div className="ey">EDITORIAL · TOP {picksRef.current.length} BY SIGNAL</div>
                <h3>Where the week's story is loudest</h3>
                <p>
                  Ranked by 7-day z-score against each country's own 30-day baseline.{' '}
                  {picksRef.current.slice(0, 3).map(p => isoToName[p.iso] || p.iso).join(', ')} lead
                  the list — click any numbered pin to open the story.
                </p>
              </div>
            )}

            <div className="mv2-mapctl">
              <button title="Zoom in"  onClick={() => setZoom(z => Math.min(z * 1.4, 6))}>+</button>
              <button title="Zoom out" onClick={() => setZoom(z => Math.max(z / 1.4, 0.5))}>−</button>
              <button title="Reset"    onClick={() => setZoom(1)}>◯</button>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <aside className="mv2-panel">
          {selectedISO ? (
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>

              {/* Header */}
              <div className="hd">
                <div>
                  <div className="cc">
                    {selectedISO}
                    {intel?.riskLevel && (
                      <span style={{ marginLeft: 8, color: riskColor, fontWeight: 600 }}>
                        · {intel.riskLevel.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <h2>{selectedName || selectedISO}</h2>
                </div>
                <span className="flag">{selectedISO.slice(0, 2)}</span>
              </div>

              {/* Stat strip */}
              {(() => {
                const s = signal[selectedISO];
                const bucket = s?.bucket || 'L';
                const bucketLabel = bucket === 'H' ? 'High' : bucket === 'E' ? 'Elevated' : 'Low';
                const bucketClass = bucket === 'H' ? 'h' : bucket === 'E' ? 'e' : '';
                return (
                  <div className="stats">
                    <div className="stat">
                      <div className="k">Signal</div>
                      <div className={`v ${bucketClass}`}>{bucketLabel}</div>
                      {s ? (
                        <div className={`d ${s.z > 0 ? 'up' : s.z < 0 ? 'dn' : ''}`}>
                          z {s.z > 0 ? '+' : ''}{s.z} · 7d
                        </div>
                      ) : <div className="d">—</div>}
                    </div>
                    <div className="stat">
                      <div className="k">Articles</div>
                      <div className="v">{s?.last7 ?? '—'}</div>
                      <div className="d">{s ? `vs ~${s.prior7} baseline` : 'last 7d'}</div>
                    </div>
                    <div className="stat">
                      <div className="k">Risk Score</div>
                      <div className="v" style={intel?.riskScore != null ? { color: riskColor } : {}}>
                        {intel?.riskScore != null ? intel.riskScore : '—'}
                        {intel?.riskScore != null && snapshots?.length >= 2 && (
                          <Sparkline snapshots={snapshots} />
                        )}
                      </div>
                      <div className="d">/100</div>
                    </div>
                  </div>
                );
              })()}

              {/* Intel headline + trajectory */}
              {intel?.headline && (
                <div className="section">
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 14.5, lineHeight: 1.5, color: 'var(--ink)', fontWeight: 500 }}>
                    {intel.headline}
                  </div>
                  {intel.trajectory && (
                    <div style={{ marginTop: 6, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-dim)', letterSpacing: '0.08em' }}>
                      {intel.trajectory === 'escalating' ? '↗' : intel.trajectory === 'de-escalating' ? '↘' : '→'}{' '}
                      TRAJECTORY: {intel.trajectory.toUpperCase()}
                    </div>
                  )}
                </div>
              )}

              {/* Recent coverage */}
              <div className="section">
                <h4>
                  Recent coverage{' '}
                  {liveDetail && <span className="n">{liveDetail.thread?.length || 0}</span>}
                </h4>
                {liveDetail?.leadTitle && (
                  <div className="lead-title">{liveDetail.leadTitle}</div>
                )}
                {liveDetail?.thread?.length > 0 ? (
                  <div className="thread">
                    {liveDetail.thread.map((r, i) => (
                      <div
                        className="r" key={i}
                        style={r.threadId ? { cursor: 'pointer' } : undefined}
                        onClick={r.threadId ? () => navigate(`/weekly/thread/${r.threadId}`) : undefined}
                      >
                        <span className="d">{r.d}</span>
                        <span>{r.h}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: 'var(--ink-faint)', fontSize: 12.5, fontStyle: 'italic', paddingTop: 4 }}>
                    No coverage in this window.
                  </div>
                )}
              </div>

              {/* Cross-country links */}
              {liveDetail?.links?.length > 0 && (
                <div className="section">
                  <h4>Cross-country links <span className="n">{liveDetail.links.length}</span></h4>
                  <div className="links">
                    {liveDetail.links.map((l, i) => (
                      <div
                        className="link" key={i}
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

              {/* Risk Signals from intel */}
              {intel?.riskSignals?.length > 0 && (
                <div className="section">
                  <h4>Risk Signals <span className="n">{intel.riskSignals.length}</span></h4>
                  {intel.riskSignals.map((sig, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                      <span style={{ color: 'var(--risk-h)', fontSize: 12, flexShrink: 0, marginTop: 1 }}>▪</span>
                      <span style={{ fontSize: 12.5, color: 'var(--ink-mid)', lineHeight: 1.5 }}>{sig}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Causal Graph from systems analysis */}
              {systemsData?.edges?.length > 0 && (
                <div className="section">
                  <h4>Causal Graph</h4>
                  {systemsData.edges.slice(0, 3).map((e, i) => (
                    <div key={i} style={{ marginBottom: 8, padding: '7px 10px', background: '#fff', border: '1px solid var(--line)', borderRadius: 6 }}>
                      <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 600 }}>{e.from}</span>
                        <span style={{ color: 'var(--ink-dim)', margin: '0 5px', fontFamily: 'var(--mono)', fontSize: 10 }}>→ {e.mechanism} →</span>
                        <span style={{ fontWeight: 600 }}>{e.to}</span>
                      </div>
                      {(e.confidence || e.lagDays) && (
                        <div style={{ marginTop: 3, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-faint)' }}>
                          {e.confidence && `conf: ${e.confidence}`}{e.confidence && e.lagDays && ' · '}{e.lagDays && `lag: ${e.lagDays}d`}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Markets snapshot */}
              {markets?.macro && (
                <div className="section">
                  <h4>
                    Markets Snapshot
                    {markets.asOf && (
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-faint)', textTransform: 'none', letterSpacing: 0, fontWeight: 400, marginLeft: 6 }}>
                        {new Date(markets.asOf).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {[
                      ['GDP', markets.macro.gdp != null ? `$${(markets.macro.gdp / 1e12).toFixed(1)}T` : null],
                      ['CPI YoY', markets.macro.cpi_yoy != null ? `${markets.macro.cpi_yoy.toFixed(1)}%` : null],
                      ['Unemployment', markets.macro.unemployment != null ? `${markets.macro.unemployment.toFixed(1)}%` : null],
                      ['Debt/GDP', markets.macro.debt_to_gdp != null ? `${markets.macro.debt_to_gdp.toFixed(0)}%` : null],
                    ].filter(([, v]) => v).map(([label, val]) => (
                      <div key={label} style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 6, padding: '6px 10px' }}>
                        <div style={{ fontSize: 9, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-dim)', marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Grounding sources from intel */}
              {intel?.groundingSources?.length > 0 && (
                <div className="section">
                  <h4>Web Evidence <span className="n">{Math.min(intel.groundingSources.length, 4)}</span></h4>
                  {intel.groundingSources.slice(0, 4).map((src, i) => (
                    <div key={i} style={{ marginBottom: 8, padding: '7px 10px', background: '#fff', border: '1px solid var(--line)', borderRadius: 6 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{src.title || src.queryUsed}</div>
                      {src.snippet && (
                        <div style={{ fontSize: 12, color: 'var(--ink-mid)', lineHeight: 1.45 }}>{src.snippet.slice(0, 120)}{src.snippet.length > 120 ? '…' : ''}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="actions-row" style={{ marginTop: 'auto' }}>
                <button
                  className="btn primary"
                  onClick={() => navigate(`/weekly/country/${encodeURIComponent(selectedName || selectedISO)}`)}
                >
                  Open country →
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: '24px 20px', color: 'var(--ink-dim)', fontSize: 13, fontFamily: 'var(--sans)', lineHeight: 1.6 }}>
              Click any country on the map to see intelligence details.
            </div>
          )}
        </aside>

      </div>

      {/* Footer */}
      <div className="mv2-foot">
        <span>BASE <b>NATURAL EARTH 1:110M</b></span>
        <span>D3 EQUAL-EARTH</span>
        <span className="sp" />
        <span>GLOBAL PERSPECTIVES™</span>
      </div>

    </div>
  );
}
