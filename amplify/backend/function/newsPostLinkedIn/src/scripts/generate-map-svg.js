'use strict';

/**
 * One-time dev script: generates world-map-template.svg
 * Run: node scripts/generate-map-svg.js
 * Output: ../world-map-template.svg
 *
 * Uses world-atlas (TopoJSON 110m) + topojson-client to get country polygons,
 * then projects them to equirectangular SVG paths.
 */

const fs = require('fs');
const path = require('path');
const { feature } = require('topojson-client');

const WIDTH = 1200;
const HEIGHT = 630;

// Equirectangular projection: lng [-180,180] -> x [0,WIDTH], lat [90,-90] -> y [0,HEIGHT]
function project([lng, lat]) {
  const x = ((lng + 180) / 360) * WIDTH;
  const y = ((90 - lat) / 180) * HEIGHT;
  return [x, y];
}

function ringToPath(ring) {
  return ring
    .map((coord, i) => {
      const [x, y] = project(coord);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ') + ' Z';
}

function geometryToPath(geometry) {
  if (!geometry) return '';

  const { type, coordinates } = geometry;

  if (type === 'Polygon') {
    return coordinates.map(ring => ringToPath(ring)).join(' ');
  }

  if (type === 'MultiPolygon') {
    return coordinates
      .map(polygon => polygon.map(ring => ringToPath(ring)).join(' '))
      .join(' ');
  }

  return '';
}

async function main() {
  // Load world-atlas countries-110m
  const topoPath = path.join(__dirname, '../node_modules/world-atlas/countries-110m.json');
  if (!fs.existsSync(topoPath)) {
    console.error('world-atlas not found. Run: npm install --save-dev world-atlas topojson-client');
    process.exit(1);
  }

  const topo = JSON.parse(fs.readFileSync(topoPath, 'utf8'));
  const countries = feature(topo, topo.objects.countries);

  // world-atlas uses numeric ISO 3166-1 codes — map to alpha-2
  // We'll use a lookup table for the most common ones
  const numericToAlpha2 = getNumericToAlpha2Map();

  const paths = [];

  for (const country of countries.features) {
    const numericId = String(country.id);
    const isoCode = numericToAlpha2[numericId] || null;
    const d = geometryToPath(country.geometry);
    if (!d) continue;

    const id = isoCode ? ` id="${isoCode}"` : ` data-numeric="${numericId}"`;
    paths.push(`  <path${id} d="${d}" fill="#334155" stroke="#475569" stroke-width="0.5"/>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#0f172a"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#1e3a5f" opacity="0.3"/>
${paths.join('\n')}
</svg>`;

  const outPath = path.join(__dirname, '../world-map-template.svg');
  fs.writeFileSync(outPath, svg, 'utf8');
  console.log(`Generated: ${outPath} (${(svg.length / 1024).toFixed(1)} KB, ${paths.length} countries)`);
}

function getNumericToAlpha2Map() {
  return {
    '4':'AF','8':'AL','12':'DZ','20':'AD','24':'AO','28':'AG','32':'AR','36':'AU',
    '40':'AT','31':'AZ','44':'BS','48':'BH','50':'BD','52':'BB','112':'BY','56':'BE',
    '84':'BZ','204':'BJ','64':'BT','68':'BO','70':'BA','72':'BW','76':'BR','96':'BN',
    '100':'BG','854':'BF','108':'BI','132':'CV','116':'KH','120':'CM','124':'CA',
    '140':'CF','148':'TD','152':'CL','156':'CN','170':'CO','174':'KM','178':'CG',
    '180':'CD','188':'CR','384':'CI','191':'HR','192':'CU','196':'CY','203':'CZ',
    '208':'DK','262':'DJ','212':'DM','214':'DO','218':'EC','818':'EG','222':'SV',
    '226':'GQ','232':'ER','233':'EE','748':'SZ','231':'ET','242':'FJ','246':'FI',
    '250':'FR','266':'GA','270':'GM','268':'GE','276':'DE','288':'GH','300':'GR',
    '308':'GD','320':'GT','324':'GN','624':'GW','328':'GY','332':'HT','340':'HN',
    '348':'HU','352':'IS','356':'IN','360':'ID','364':'IR','368':'IQ','372':'IE',
    '376':'IL','380':'IT','388':'JM','392':'JP','400':'JO','398':'KZ','404':'KE',
    '296':'KI','408':'KP','410':'KR','414':'KW','417':'KG','418':'LA','428':'LV',
    '422':'LB','426':'LS','430':'LR','434':'LY','438':'LI','440':'LT','442':'LU',
    '450':'MG','454':'MW','458':'MY','462':'MV','466':'ML','470':'MT','584':'MH',
    '478':'MR','480':'MU','484':'MX','583':'FM','498':'MD','492':'MC','496':'MN',
    '499':'ME','504':'MA','508':'MZ','104':'MM','516':'NA','520':'NR','524':'NP',
    '528':'NL','554':'NZ','558':'NI','562':'NE','566':'NG','807':'MK','578':'NO',
    '512':'OM','586':'PK','585':'PW','275':'PS','591':'PA','598':'PG','600':'PY',
    '604':'PE','608':'PH','616':'PL','620':'PT','634':'QA','642':'RO','643':'RU',
    '646':'RW','659':'KN','662':'LC','670':'VC','882':'WS','674':'SM','678':'ST',
    '682':'SA','686':'SN','688':'RS','690':'SC','694':'SL','702':'SG','703':'SK',
    '705':'SI','90':'SB','706':'SO','710':'ZA','728':'SS','724':'ES','144':'LK',
    '729':'SD','740':'SR','752':'SE','756':'CH','760':'SY','158':'TW','762':'TJ',
    '834':'TZ','764':'TH','626':'TL','768':'TG','776':'TO','780':'TT','788':'TN',
    '792':'TR','795':'TM','798':'TV','800':'UG','804':'UA','784':'AE','826':'GB',
    '840':'US','858':'UY','860':'UZ','548':'VU','862':'VE','704':'VN','887':'YE',
    '894':'ZM','716':'ZW',
  };
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
