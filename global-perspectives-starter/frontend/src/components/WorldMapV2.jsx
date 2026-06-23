import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import SeverityBadge from './atoms/SeverityBadge';
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
import { useDisruptionsList } from '../hooks/useDisruptionsList';
import LedeBand from './atoms/LedeBand';
import { composeTopicsLede } from '../utils/composeTopicsLede';
import { findTopicForCountry, countryNameEq } from '../utils/topicMatch';
import { threadPath } from '../utils/threadPath';
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
const FLOW_COLOR  = { fx: '#1e6091', tech: '#5b3a91', geo: '#a2442e' };

const LAYERS = [
  { id: 'today',       label: "Today's pulse", sub: 'last 24h news + signal' },
  { id: 'connections', label: 'Connections',   sub: 'bilateral arcs'         },
  { id: 'editorial',   label: 'Editorial',     sub: "this week's top stories" },
  { id: 'economy',     label: 'Economy',       sub: 'active disruption exposure' },
];

const ECON_RING_COLOR = { severe: '#c94a33', moderate: '#c98510', minor: '#4fa07b' };
const ECON_RING_RADIUS = { severe: 12, moderate: 9, minor: 7 };

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

  const [layers, setLayers] = useState({ today: true, connections: false, editorial: false, economy: false });
  const [selectedISO, setSelectedISO] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [railOpen, setRailOpen] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [flowFilters, setFlowFilters] = useState({ fx: true, tech: true, geo: true });
  const [signalFilters, setSignalFilters] = useState({ H: true, E: true, L: true });
  const [timeWindow, setTimeWindow] = useState('30d');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  // Dynamic maps built after TopoJSON loads
  const [nameToISO, setNameToISO] = useState({});
  const [isoToName, setIsoToName] = useState({});
  const isoToCenterRef = useRef({});
  const nameToISORef   = useRef({});

  const { signal, loading: sigLoading, ready: sigReady } = useCountrySignal(nameToISO);
  const { analyses: pairAnalyses } = usePairAnalyses();
  const { topics, updatedAt: topicsUpdatedAt } = useGeminiTopics();
  const { dayMap } = useWeeklyArchive();

  // Derived: canonical name for selected country
  const selectedName = useMemo(
    () => (selectedISO ? (isoToName[selectedISO] || null) : null),
    [selectedISO, isoToName]
  );

  // Per-country backend hooks (fire only when a country is selected)
  const { intelligence, loading: intelLoading } = useCountryIntelligence(selectedName ? [selectedName] : []);
  const intel = intelligence?.[selectedName];
  const { snapshots } = useCountryHistory(selectedName);
  const { data: systemsData } = useSystemsAnalysis(selectedName);
  const { data: markets } = useMarketsCountry(selectedName);

  const signalRef = useRef({});
  signalRef.current = signal;

  // Ranked signal entries by |z| — shared by drawMap markers and leaderboard panel
  const rankedSignal = useMemo(() => {
    return Object.entries(signal)
      .filter(([, s]) => s.bucket !== 'L')
      .sort((a, b) => Math.abs(b[1].z || 0) - Math.abs(a[1].z || 0));
  }, [signal]);
  const rankedSignalRef = useRef([]);
  rankedSignalRef.current = rankedSignal;

  const topicsRef = useRef([]);
  topicsRef.current = topics;
  // Topics carry no per-item timestamp — expose the batch-level updatedAt to the
  // imperative drawMap so freshness gates fall back to it instead of 0 (which would
  // silently drop everything). Same fix as todaySignal.
  const topicsUpdatedAtRef = useRef(0);
  topicsUpdatedAtRef.current = topicsUpdatedAt ? new Date(topicsUpdatedAt).getTime() : 0;

  // Today's pulse — rolling 24h window of fresh news per country
  const todaySignal = useMemo(() => {
    if (!Array.isArray(topics) || topics.length === 0) return {};
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    // Topics carry no per-item timestamp; fall back to the batch-level updatedAt
    // so the pulse reflects "this batch is fresh" instead of silently rendering nothing.
    const batchMs = topicsUpdatedAt ? new Date(topicsUpdatedAt).getTime() : 0;
    const counts = {};
    for (const t of topics) {
      const ts = t.timestamp ? new Date(t.timestamp).getTime() : batchMs;
      if (!ts || ts < cutoff) continue;
      const seen = new Set();
      const regions = Array.isArray(t.regions) ? t.regions : [];
      for (const r of regions) {
        if (!r) continue;
        const iso = nameToISO[String(r).toLowerCase()] || EXTRA_ALIASES[String(r).toLowerCase()];
        if (iso && !seen.has(iso)) {
          seen.add(iso);
          counts[iso] = (counts[iso] || 0) + 1;
        }
      }
    }
    return counts;
  }, [topics, topicsUpdatedAt, nameToISO]);
  const todaySignalRef = useRef({});
  todaySignalRef.current = todaySignal;

  // Economic disruption exposure — country ISO → max severity from active disruptions
  const { data: allDisruptions = [] } = useDisruptionsList({ limit: 200 });

  // Today's lede — deterministic orientation band shared with Home
  const lede = useMemo(
    () => composeTopicsLede({ topics, disruptions: allDisruptions }),
    [topics, allDisruptions],
  );
  const econByISO = useMemo(() => {
    const out = {};
    const rank = { severe: 3, moderate: 2, minor: 1 };
    for (const d of allDisruptions) {
      const sev = d.severity;
      for (const e of [...(d.winners || []), ...(d.losers || [])]) {
        if (e.type !== 'country' || !e.name) continue;
        const iso = nameToISO[e.name];
        if (!iso) continue;
        if (!out[iso] || rank[sev] > rank[out[iso]]) out[iso] = sev;
      }
    }
    return out;
  }, [allDisruptions, nameToISO]);
  const econRef = useRef({});
  econRef.current = econByISO;

  // Selected-country disruptions — top 3 active records mentioning the country
  // by name in winners/losers. Used by the detail panel.
  const selectedCountryDisruptions = useMemo(() => {
    if (!selectedName) return [];
    const sevRank = { severe: 3, moderate: 2, minor: 1 };
    return allDisruptions
      .filter(d => {
        const inWinners = (d.winners || []).some(w => w.type === 'country' && w.name === selectedName);
        const inLosers  = (d.losers  || []).some(l => l.type === 'country' && l.name === selectedName);
        return inWinners || inLosers;
      })
      .sort((a, b) => (sevRank[b.severity] || 0) - (sevRank[a.severity] || 0))
      .slice(0, 3);
  }, [allDisruptions, selectedName]);

  // Keep nameToISO ref in sync for drawMap (imperative context)
  useEffect(() => { nameToISORef.current = nameToISO; }, [nameToISO]);

  // Build real flow arcs from pair analyses
  // The list API returns only {slug, pairTitle, ...} — country names live in slug
  // (format: "country1-and-country2"). Parse slug to recover them.
  const realFlows = useMemo(() => {
    if (!Array.isArray(pairAnalyses) || pairAnalyses.length === 0) return [];
    if (Object.keys(nameToISO).length === 0) return [];

    // Time-window cutoff
    const cutoffDays = timeWindow === '7d' ? 7 : 30;
    const cutoffMs = Date.now() - cutoffDays * 24 * 60 * 60 * 1000;

    const out = [];
    for (const p of pairAnalyses) {
      // Time filter — don't hard-drop older pairs (that leaves the layer near-empty);
      // show them faded + dashed and tag as stale.
      let stale = false;
      if (p.generatedAt) {
        const genMs = new Date(p.generatedAt).getTime();
        if (!isNaN(genMs) && genMs < cutoffMs) stale = true;
      }

      let c1, c2;
      if (Array.isArray(p.countries) && p.countries.length === 2) {
        [c1, c2] = p.countries.map(c => String(c).trim().toLowerCase());
      } else if (p.slug && p.slug.includes('-and-')) {
        const [s1, s2] = p.slug.split('-and-');
        c1 = s1.replace(/-/g, ' ').trim();
        c2 = s2.replace(/-/g, ' ').trim();
      } else {
        continue;
      }
      const a = nameToISO[c1] || EXTRA_ALIASES[c1];
      const b = nameToISO[c2] || EXTRA_ALIASES[c2];
      if (!a || !b || !isoToCenterRef.current[a] || !isoToCenterRef.current[b]) continue;
      const sA = signal[a]?.bucket || 'L';
      const sB = signal[b]?.bucket || 'L';
      // Active if at least one country has elevated or high signal this week
      const isActive = (s) => s === 'H' || s === 'E';
      const w = (isActive(sA) || isActive(sB)) ? 'strong' : 'mod';
      const title = String(p.pairTitle || '').toLowerCase();
      let g = 'geo';
      if (/trade|tariff|export|import|peso|yen|lira|imf|fx|capital/.test(title)) g = 'fx';
      else if (/chip|semi|fab|ai|tech|cloud|data/.test(title)) g = 'tech';

      // Flow-type filter
      if (!flowFilters[g]) continue;

      out.push({ a, b, w, g, label: p.pairTitle || `${a}×${b}`, slug: p.slug, stale });
    }
    return out;
  }, [pairAnalyses, signal, nameToISO, flowFilters, timeWindow]);

  // Build editorial picks from top-signal countries
  const editorialPicks = useMemo(() => {
    const ranked = Object.entries(signal)
      .filter(([iso, s]) => s.bucket !== 'L' && isoToCenterRef.current[iso])
      .sort((a, b) => (b[1].z || 0) - (a[1].z || 0))
      .slice(0, 5);
    return ranked.map(([iso, s], i) => {
      const name = isoToName[iso];
      const topic = findTopicForCountry(topics, name);
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
        if (regions.some(r => countryNameEq(r, selectedName))) {
          entries.push({ ...e, _date: date });
        }
      }
    }
    const recent = entries.slice(-6).reverse();
    const leadEntry = recent[0];

    const pairCountries = p => {
      if (Array.isArray(p.countries) && p.countries.length === 2) return p.countries.map(c => String(c).toLowerCase());
      if (p.slug && p.slug.includes('-and-')) {
        const [s1, s2] = p.slug.split('-and-');
        return [s1.replace(/-/g, ' ').trim(), s2.replace(/-/g, ' ').trim()];
      }
      return [];
    };

    const links = (pairAnalyses || [])
      .filter(p => pairCountries(p).some(c => c === lc))
      .slice(0, 5)
      .map(p => {
        const parts = pairCountries(p);
        const other = parts.find(c => c !== lc) || '';
        const otherISO = nameToISO[other.toLowerCase()] || EXTRA_ALIASES[other.toLowerCase()] || other;
        return {
          pair: `${selectedISO.slice(0, 2)} ↔ ${otherISO.slice(0, 2).toUpperCase()}`,
          desc: p.pairTitle || p.leadSentence || 'Bilateral',
          w: 'strong',
          slug: p.slug,
          otherName: other,
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
        drawMap(layers, selectedISO, zoom);
      });
  }, []); // eslint-disable-line

  const flowsRef = useRef([]);
  const picksRef = useRef([]);
  flowsRef.current = realFlows;
  picksRef.current = editorialPicks;

  // Redraw on container resize so map fills the correct dimensions
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (worldRef.current) drawMap(layers, selectedISO, zoom);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [layers, selectedISO, zoom]); // eslint-disable-line

  // Redraw when layers/selection/zoom/data changes
  useEffect(() => {
    if (!worldRef.current) return;
    const t = setTimeout(() => drawMap(layers, selectedISO, zoom), 240);
    return () => clearTimeout(t);
  }, [layers, selectedISO, zoom, railOpen, panelOpen, sigReady, realFlows, editorialPicks, flowFilters, signalFilters, timeWindow, todaySignal, econByISO]); // eslint-disable-line

  function drawMap(currentLayers, currentISO, currentZoom) {
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

    // Country fills — z-score buckets always shown as the base layer
    world.features.forEach(f => {
      const iso = f.id;
      const bucket = sig[iso]?.bucket || 'L';
      const fill = signalFilters[bucket] ? RISK_FILL[bucket] : '#f2efe8';
      const p = el('path', {
        class: `country${iso === currentISO ? ' selected' : ''}`,
        d: path(f), fill, 'data-iso': iso,
      });
      p.addEventListener('click', () => handleCountryClick(iso));
      svg.appendChild(p);
    });

    // Today's pulse layer — fresh-news rings around countries with topics in last 24h
    if (currentLayers.today) {
      Object.entries(todaySignalRef.current).forEach(([iso, count]) => {
        const center = isoToCenterRef.current[iso];
        if (!center) return;
        const pt = projection(center);
        if (!pt) return;
        const [x, y] = pt;
        const r = Math.min(7 + Math.sqrt(count) * 1.6, 14);
        const ring = el('circle', {
          cx: x, cy: y, r,
          fill: 'none',
          stroke: '#0d9488',
          'stroke-width': 1.4,
          'stroke-opacity': 0.55,
          class: 'today-ring',
        });
        svg.appendChild(ring);
      });
    }

    // Economy lens — disruption exposure rings (severity-colored)
    if (currentLayers.economy) {
      Object.entries(econRef.current).forEach(([iso, severity]) => {
        const center = isoToCenterRef.current[iso];
        if (!center) return;
        const pt = projection(center);
        if (!pt) return;
        const [x, y] = pt;
        const color = ECON_RING_COLOR[severity] || ECON_RING_COLOR.moderate;
        const r = ECON_RING_RADIUS[severity] || ECON_RING_RADIUS.moderate;
        const ring = el('circle', {
          cx: x, cy: y, r,
          fill: color,
          'fill-opacity': severity === 'severe' ? 0.22 : 0.12,
          stroke: color,
          'stroke-width': severity === 'severe' ? 2 : 1.4,
          'stroke-opacity': 0.85,
          class: 'econ-ring',
        });
        svg.appendChild(ring);
      });
    }

    // Signal markers — always shown (top-5 headline, ambient, tail)
    {
      // Two-tier signal markers: top 5 = headline, rest = ambient/tail
      const ranked = rankedSignalRef.current;
      ranked.forEach(([iso, s], rank) => {
        if (!signalFilters[s.bucket]) return;
        const center = isoToCenterRef.current[iso];
        if (!center) return;
        const pt = projection(center);
        if (!pt) return;
        const [x, y] = pt;
        const color = RISK_MARKER[s.bucket];
        const sign = s.z > 0 ? '+' : '';
        const label = `${iso.slice(0, 3)}  z${sign}${s.z}`;

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'sig-marker');
        g.addEventListener('click', () => handleCountryClick(iso));

        if (rank < 5) {
          // Headline: large dot + halo + full label always visible
          g.appendChild(el('circle', { cx: x, cy: y, r: 14, fill: color, 'fill-opacity': 0.15 }));
          g.appendChild(el('circle', { cx: x, cy: y, r: 8, fill: color, stroke: '#fff', 'stroke-width': 1.5 }));
          const lbl = el('text', { class: 'lbl-headline', x: x + 11, y: y + 4, fill: color });
          lbl.textContent = label;
          g.appendChild(lbl);
        } else if (rank < 15) {
          // Ambient: small dot, ISO-only label, hover reveals full label
          g.appendChild(el('circle', { cx: x, cy: y, r: 14, fill: 'transparent' })); // hit area
          g.appendChild(el('circle', { cx: x, cy: y, r: 4, fill: color, stroke: '#fff', 'stroke-width': 1, 'fill-opacity': 0.65 }));
          const shortLbl = el('text', { class: 'lbl-ambient', x: x + 7, y: y + 3, fill: color });
          shortLbl.textContent = iso.slice(0, 3);
          g.appendChild(shortLbl);
          const hoverLbl = el('text', { class: 'lbl-hover', x: x + 7, y: y + 3, fill: color });
          hoverLbl.textContent = label;
          g.appendChild(hoverLbl);
        } else {
          // Tail: tiny dot, no label, invisible hit area
          g.appendChild(el('circle', { cx: x, cy: y, r: 14, fill: 'transparent' }));
          g.appendChild(el('circle', { cx: x, cy: y, r: 2.5, fill: color, 'fill-opacity': 0.35 }));
        }
        svg.appendChild(g);
      });

      // Urgency halo for high-urgency topics from last 24h
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const haloISOs = new Set();
      for (const topic of topicsRef.current) {
        if (topic.urgency !== 'high') continue;
        const ts = topic.timestamp ? new Date(topic.timestamp).getTime() : topicsUpdatedAtRef.current;
        if (!ts || now - ts > dayMs) continue;
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

    if (currentLayers.connections) {
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
          'stroke-opacity': (fl.w === 'strong' ? 0.75 : 0.35) * (fl.stale ? 0.45 : 1),
          'stroke-width': fl.w === 'strong' ? 1.8 : 1.0,
          'stroke-dasharray': (fl.stale || fl.w !== 'strong') ? '3 3' : '',
          style: fl.slug ? 'cursor: pointer' : '',
        });
        // /weekly/pair has no route — send the arc to one end's country page instead of NotFound.
        if (fl.slug && fl.a) arc.addEventListener('click', () => navigate(`/weekly/country/${encodeURIComponent(isoToName[fl.a] || fl.a)}`));
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

    if (currentLayers.editorial) {
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
          if (p.threadId) navigate(threadPath(p.threadId));
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

  const showCaption = layers.editorial;
  const activeLayerLabels = LAYERS.filter(l => layers[l.id]).map(l => l.label.toLowerCase());
  const subtitleText = activeLayerLabels.length === 0
    ? 'Country fills only · click any country for details'
    : activeLayerLabels.join(' · ');

  const sigValues    = Object.values(signal);
  const hasRealSignal = sigValues.length > 0;
  const highCount = sigValues.filter(s => s.bucket === 'H').length;
  const elevCount = sigValues.filter(s => s.bucket === 'E').length;

  const riskColor = intel?.riskLevel === 'high' ? 'var(--risk-h)' : intel?.riskLevel === 'elevated' ? 'var(--risk-e)' : intel?.riskLevel === 'low' ? 'var(--risk-l)' : 'var(--ink-dim)';

  // Search matches across canonical names + extra aliases
  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 1) return [];
    const seen = new Set();
    const out = [];
    const tryAdd = (key, iso) => {
      if (!iso || seen.has(iso)) return;
      const display = isoToName[iso] || key;
      if (key.startsWith(q) || display.toLowerCase().startsWith(q)) {
        seen.add(iso);
        out.push({ key, iso, display, score: 0 });
      } else if (key.includes(q) || display.toLowerCase().includes(q)) {
        seen.add(iso);
        out.push({ key, iso, display, score: 1 });
      }
    };
    for (const [key, iso] of Object.entries(nameToISO)) tryAdd(key, iso);
    for (const [key, iso] of Object.entries(EXTRA_ALIASES)) tryAdd(key, iso);
    return out.sort((a, b) => a.score - b.score || a.display.localeCompare(b.display)).slice(0, 8);
  }, [searchQuery, nameToISO, isoToName]);

  const handleSearchSelect = (iso) => {
    setSearchQuery('');
    setSearchFocused(false);
    handleCountryClick(iso);
    setPanelOpen(true);
  };

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
            <h5>Layers</h5>
            {LAYERS.map(l => (
              <div
                key={l.id}
                className={`opt${layers[l.id] ? ' on' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setLayers(prev => ({ ...prev, [l.id]: !prev[l.id] }))}
              >
                <span className="box" />
                {l.label}
                <span className="c">{l.sub}</span>
              </div>
            ))}
          </div>

          {/* Signal level — always shown (drives base country fills) */}
          <div className="grp">
            <h5>Signal level</h5>
              <div
                className={`chk${signalFilters.H ? ' on' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setSignalFilters(f => ({ ...f, H: !f.H }))}
              >
                <span className="box" />
                <span className="pill" style={{ background: '#fbe9e3', color: '#c94a33', opacity: signalFilters.H ? 1 : 0.4 }}>High</span>
                <span className="c">{highCount}</span>
              </div>
              <div
                className={`chk${signalFilters.E ? ' on' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setSignalFilters(f => ({ ...f, E: !f.E }))}
              >
                <span className="box" />
                <span className="pill" style={{ background: '#fbf0dc', color: '#d89540', opacity: signalFilters.E ? 1 : 0.4 }}>Elevated</span>
                <span className="c">{elevCount}</span>
              </div>
              <div
                className={`chk${signalFilters.L ? ' on' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setSignalFilters(f => ({ ...f, L: !f.L }))}
              >
                <span className="box" />
                <span className="pill" style={{ background: '#e4f1e9', color: '#4fa07b', opacity: signalFilters.L ? 1 : 0.4 }}>Quiet</span>
                <span className="c">{sigValues.filter(s => s.bucket === 'L').length}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-dim)', marginTop: 10, lineHeight: 1.5 }}>
                Signal = how unusually active a country's coverage is vs its own 30-day baseline (z-score).
                <br />High ≥ 1.5σ · Elevated ≥ 0.5σ.
              </div>
            </div>

          {layers.connections && (
            <div className="grp">
              <h5>Flow type</h5>
              {['fx','tech','geo'].map(g => {
                const label = g === 'fx' ? 'FX / Capital' : g === 'tech' ? 'Technology' : 'Geopolitics';
                const color = FLOW_COLOR[g];
                const enabled = flowFilters[g];
                // Count within the current window but ignoring this filter (so unchecked types still show a count)
                const count = (pairAnalyses || []).filter(p => {
                  const title = String(p.pairTitle || '').toLowerCase();
                  let pg = 'geo';
                  if (/trade|tariff|export|import|peso|yen|lira|imf|fx|capital/.test(title)) pg = 'fx';
                  else if (/chip|semi|fab|ai|tech|cloud|data/.test(title)) pg = 'tech';
                  return pg === g;
                }).length;
                return (
                  <div
                    className={`chk${enabled ? ' on' : ''}`}
                    key={g}
                    onClick={() => setFlowFilters(f => ({ ...f, [g]: !f[g] }))}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="box" />
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 16, height: 2, background: color, display: 'inline-block', opacity: enabled ? 1 : 0.3 }} />
                      {label}
                    </span>
                    <span className="c">{count}</span>
                  </div>
                );
              })}
              {flowsRef.current.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--ink-dim)', marginTop: 8, fontStyle: 'italic' }}>
                  No pair relationships available yet.
                </div>
              )}
              {flowsRef.current.length > 0 && (
                <>
                  <div style={{ fontSize: 11, color: 'var(--ink-dim)', marginTop: 12, lineHeight: 1.5 }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: 6 }}>
                      Arc weight
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ width: 24, height: 2, background: 'var(--ink, #0a0a0a)', display: 'inline-block', flexShrink: 0 }} />
                      <span><b>Active</b> — at least one country in High or Elevated signal</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 24, borderTop: '1.5px dashed var(--ink-faint, #8a8a8e)', display: 'inline-block', flexShrink: 0 }} />
                      <span><b>On watch</b> — relationship exists but both sides quiet</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-dim)', marginTop: 12, fontStyle: 'italic' }}>
                    Click an arc to open the pair analysis.
                  </div>
                </>
              )}
            </div>
          )}

          {layers.editorial && (
            <div className="grp">
              <h5>Top stories this week</h5>
              {picksRef.current.map(p => (
                <div
                  key={p.iso + p.n}
                  className={`chk${selectedISO === p.iso ? ' on' : ''}`}
                  onClick={() => {
                    if (p.threadId) navigate(threadPath(p.threadId));
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

          {layers.connections && (
            <div className="grp">
              <h5>Time window</h5>
              <div className={`opt${timeWindow === '7d' ? ' on' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setTimeWindow('7d')}>
                <span className="box" />7 days<span className="c">{(pairAnalyses || []).filter(p => {
                  const t = new Date(p.generatedAt || 0).getTime();
                  return t > Date.now() - 7 * 86400000;
                }).length || '—'}</span>
              </div>
              <div className={`opt${timeWindow === '30d' ? ' on' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setTimeWindow('30d')}>
                <span className="box" />30 days<span className="c">{(pairAnalyses || []).filter(p => {
                  const t = new Date(p.generatedAt || 0).getTime();
                  return t > Date.now() - 30 * 86400000;
                }).length || '—'}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-dim)', marginTop: 8, lineHeight: 1.5 }}>
                Count = relationships refreshed in this window. Older ones still show, <span style={{ opacity: 0.55 }}>faded</span>.
              </div>
            </div>
          )}
        </aside>

        {/* Map */}
        <div className="mv2-mapwrap">
          <div className="title">
            <div>
              <div className="kicker">GLOBAL SIGNAL MAP</div>
              <h1>{subtitleText}</h1>
            </div>
            <div className="legend">
              {/* Always-shown signal swatches */}
              <span className="cell"><span className="sw" style={{ background: '#eab2a6' }} />High</span>
              <span className="cell"><span className="sw" style={{ background: '#eed4a3' }} />Elevated</span>
              <span className="cell"><span className="sw" style={{ background: '#f2efe8' }} />Quiet</span>
              {layers.today && (
                <span className="cell" style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>◯ news 24h</span>
              )}
              {layers.connections && (
                <>
                  <span className="cell"><span className="sw" style={{ background: FLOW_COLOR.fx, height: 3 }} />FX</span>
                  <span className="cell"><span className="sw" style={{ background: FLOW_COLOR.tech, height: 3 }} />Tech</span>
                  <span className="cell"><span className="sw" style={{ background: FLOW_COLOR.geo, height: 3 }} />Geo</span>
                  <span className="cell" style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>— active · ┄ on watch</span>
                </>
              )}
              {layers.editorial && (
                <span className="cell" style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>① top stories</span>
              )}
            </div>
          </div>

          {/* Today's lede — deterministic orientation band (composeTopicsLede) */}
          <LedeBand {...lede} />

          {/* Country search — in document flow, above the map */}
          <div className={`mv2-search${searchFocused ? ' focused' : ''}`}>
            <div className="mv2-search-row">
              <span className="mv2-search-icon" aria-hidden>⌕</span>
              <input
                className="mv2-search-input"
                type="text"
                placeholder="Search country…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && searchMatches[0]) handleSearchSelect(searchMatches[0].iso);
                  else if (e.key === 'Escape') { setSearchQuery(''); e.currentTarget.blur(); }
                }}
              />
              {searchQuery && (
                <button className="mv2-search-clear" onClick={() => setSearchQuery('')} aria-label="Clear">×</button>
              )}
            </div>
            {searchFocused && searchMatches.length > 0 && (
              <div className="mv2-search-dropdown">
                {searchMatches.map(m => (
                  <div
                    key={m.iso + m.key}
                    className="mv2-search-match"
                    onMouseDown={() => handleSearchSelect(m.iso)}
                  >
                    <span className="mv2-search-name">{m.display}</span>
                    <span className="mv2-search-iso">{m.iso}</span>
                  </div>
                ))}
              </div>
            )}
            {searchFocused && searchQuery.trim().length >= 1 && searchMatches.length === 0 && (
              <div className="mv2-search-dropdown">
                <div className="mv2-search-empty">No country matches "{searchQuery}"</div>
              </div>
            )}
          </div>

          <div className="mv2-map" ref={wrapRef}>
            <svg className="map-svg" ref={svgRef} />

            {/* Map loading overlay — shown until TopoJSON resolves */}
            {Object.keys(nameToISO).length === 0 && (
              <div className="mv2-map-loading">
                <div className="mv2-map-loading-inner">
                  <div className="mv2-spinner" />
                  <span className="mv2-loading-text">Loading world topology…</span>
                </div>
              </div>
            )}

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

              {/* Back link — deselects the country and returns to the leaderboard view */}
              <button
                className="mv2-back-btn"
                onClick={() => setSelectedISO(null)}
                aria-label="Back to top signals"
              >
                ← Back to top signals
              </button>

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

              {/* Intel loading spinner */}
              {intelLoading && !intel && (
                <div className="mv2-panel-loading">
                  <div className="mv2-spinner" />
                </div>
              )}

              {/* No-intel hint */}
              {!intelLoading && !intel && (
                <div className="mv2-no-intel">NO AI BRIEFING YET — NEEDS MORE COVERAGE</div>
              )}

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

              {/* Economic Disruption — top-3 active records mentioning this country */}
              {selectedCountryDisruptions.length > 0 && (
                <div className="section">
                  <h4 style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--ink-dim)', margin: '0 0 8px 0' }}>
                    ECONOMIC DISRUPTION
                    <span style={{ float: 'right', color: 'var(--ink-faint)' }}>{selectedCountryDisruptions.length} active</span>
                  </h4>
                  {selectedCountryDisruptions.map((d, i) => (
                    <Link
                      key={d.scopeId || i}
                      to={threadPath(d.scopeId, { tab: 'economy' })}
                      style={{
                        display: 'block',
                        padding: '6px 0',
                        borderBottom: i < selectedCountryDisruptions.length - 1 ? '1px dotted var(--line)' : 'none',
                        textDecoration: 'none',
                        color: 'inherit',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <SeverityBadge level={d.severity} size="sm" />
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-faint)', letterSpacing: '0.04em' }}>
                          {(d.winners || []).some(w => w.name === selectedName) ? 'WINNER' : 'LOSER'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12.5, lineHeight: 1.35, color: 'var(--ink)' }}>{d.headline}</div>
                    </Link>
                  ))}
                </div>
              )}

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
                        onClick={r.threadId ? () => navigate(threadPath(r.threadId)) : undefined}
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
                        style={l.otherName ? { cursor: 'pointer' } : undefined}
                        onClick={l.otherName ? () => navigate(`/weekly/country/${encodeURIComponent(l.otherName)}`) : undefined}
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
              {systemsData?.edges?.length > 0 && (() => {
                const nodeMap = (systemsData.nodes || []).reduce((m, n) => {
                  if (n?.threadId) m[n.threadId] = n;
                  return m;
                }, {});
                const titleFor = (id) => nodeMap[id]?.summary || (id || '').replace(/^thread-/, '').replace(/-[a-f0-9]{6}$/, '').replace(/-/g, ' ');
                const confColor = (c) => c === 'strong' ? 'var(--risk-h, #c0392b)' : c === 'medium' ? 'var(--risk-e, #d97706)' : 'var(--ink-faint)';
                return (
                  <div className="section">
                    <h4>Causal Graph</h4>
                    {systemsData.edges.slice(0, 3).map((e, i) => (
                      <div key={i} className="mv2-causal-edge">
                        <div className="mv2-causal-from">{titleFor(e.from)}</div>
                        <div className="mv2-causal-arrow">
                          <span className="mv2-causal-arrow-line" />
                          <span className="mv2-causal-meta">
                            {e.lagDays != null && <span>{e.lagDays}d lag</span>}
                            {e.confidence && (
                              <span style={{ color: confColor(e.confidence) }}>· {e.confidence}</span>
                            )}
                          </span>
                        </div>
                        <div className="mv2-causal-to">{titleFor(e.to)}</div>
                        {e.mechanism && (
                          <div className="mv2-causal-mech">{e.mechanism}</div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}

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
                    {(() => {
                      const mv = f => (f != null && typeof f === 'object' ? f.value : f);
                      const m = markets.macro;
                      return [
                        ['GDP', mv(m.gdp) != null ? `$${(+mv(m.gdp) / 1e12).toFixed(1)}T` : null],
                        ['CPI YoY', mv(m.cpi_yoy) != null ? `${(+mv(m.cpi_yoy)).toFixed(1)}%` : null],
                        ['Unemployment', mv(m.unemployment) != null ? `${(+mv(m.unemployment)).toFixed(1)}%` : null],
                        ['Debt/GDP', mv(m.debt_to_gdp) != null ? `${(+mv(m.debt_to_gdp)).toFixed(0)}%` : null],
                      ].filter(([, v]) => v && !isNaN(parseFloat(v))).map(([label, val]) => (
                        <div key={label} style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 6, padding: '6px 10px' }}>
                          <div style={{ fontSize: 9, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-dim)', marginBottom: 2 }}>{label}</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{val}</div>
                        </div>
                      ));
                    })()}
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
            <div style={{ padding: '20px 18px' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-dim)', marginBottom: 14 }}>
                Top signal this week
              </div>
              {rankedSignal.filter(([, s]) => signalFilters[s.bucket]).slice(0, 5).map(([iso, s], i) => {
                const name = isoToName[iso] || iso;
                const color = RISK_MARKER[s.bucket];
                const sign = s.z > 0 ? '+' : '';
                const topic = findTopicForCountry(topics, name);
                return (
                  <div
                    key={iso}
                    onClick={() => handleCountryClick(iso)}
                    style={{
                      display: 'flex', gap: 12, alignItems: 'flex-start',
                      padding: '10px 0', borderBottom: '1px solid var(--line)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--paper-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <span style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: color, color: '#fff',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
                      flexShrink: 0, marginTop: 1,
                    }}>{i + 1}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.2 }}>{name}</div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color, marginTop: 2 }}>z{sign}{s.z} · {s.last7 ?? '—'} articles</div>
                      {topic && (
                        <div
                          onClick={topic.threadId ? (e) => { e.stopPropagation(); navigate(threadPath(topic.threadId)); } : undefined}
                          title={topic.threadId ? 'Open story arc' : undefined}
                          style={{
                            fontSize: 11, color: 'var(--ink-mid)', marginTop: 4, lineHeight: 1.4,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            cursor: topic.threadId ? 'pointer' : 'inherit',
                            textDecoration: topic.threadId ? 'underline dotted' : 'none',
                            textUnderlineOffset: 2,
                          }}
                        >
                          {topic.title?.slice(0, 52)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {rankedSignal.length === 0 && (
                <div style={{ color: 'var(--ink-dim)', fontSize: 12, fontStyle: 'italic' }}>Loading signal data…</div>
              )}
              <div style={{ marginTop: 16, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-faint)', letterSpacing: '0.06em' }}>
                Click any row or country on the map for full detail.
              </div>
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
