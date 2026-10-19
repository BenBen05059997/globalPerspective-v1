'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// ── Install TTF fonts to /tmp for librsvg/fontconfig ────────────────────────
// librsvg ignores @font-face/woff2. It only uses system TTF/OTF via fontconfig.
// Lambda has no /usr/share/fonts, so we bundle TTFs and configure fontconfig.
(function setupFonts() {
  try {
    const fontDir = '/tmp/fonts';
    const configDir = '/tmp/fontconfig';
    fs.mkdirSync(fontDir, { recursive: true });
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync('/tmp/fontconfig-cache', { recursive: true });

    // Copy bundled TTF fonts to /tmp
    const srcFonts = path.join(__dirname, 'fonts');
    if (fs.existsSync(srcFonts)) {
      for (const file of fs.readdirSync(srcFonts)) {
        if (file.endsWith('.ttf') || file.endsWith('.otf')) {
          const dest = path.join(fontDir, file);
          if (!fs.existsSync(dest)) {
            fs.copyFileSync(path.join(srcFonts, file), dest);
          }
        }
      }
    }

    // Write fontconfig pointing to /tmp/fonts
    const fontsConf = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>/tmp/fonts</dir>
  <cachedir>/tmp/fontconfig-cache</cachedir>
  <config><rescan><int>0</int></rescan></config>
</fontconfig>`;
    fs.writeFileSync(path.join(configDir, 'fonts.conf'), fontsConf);

    // Must be set BEFORE sharp renders anything
    process.env.FONTCONFIG_PATH = configDir;
    process.env.FONTCONFIG_FILE = path.join(configDir, 'fonts.conf');

    const installed = fs.readdirSync(fontDir).filter(f => f.endsWith('.ttf'));
    console.log(`mapImageGenerator: ${installed.length} fonts installed in /tmp/fonts: ${installed.join(', ')}`);
  } catch (e) {
    console.error('mapImageGenerator: font setup failed:', e.message);
  }
})();

const SVG_PATH = path.join(__dirname, 'world-map-template.svg');
const LOGO_PATH = path.join(__dirname, 'logo_small.png');

const LOGO_BASE64 = (() => {
  try { return fs.readFileSync(LOGO_PATH).toString('base64'); }
  catch { return ''; }
})();

const SVG_TEMPLATE = (() => {
  try { return fs.readFileSync(SVG_PATH, 'utf8'); }
  catch { return null; }
})();

const CATEGORY_COLORS = {
  conflict: '#ef4444',
  military: '#ef4444',
  politics: '#3b82f6',
  economy: '#22c55e',
  technology: '#8b5cf6',
  disaster: '#f97316',
  health: '#14b8a6',
};

const COUNTRY_TO_ISO = {
  'afghanistan': 'AF', 'albania': 'AL', 'algeria': 'DZ', 'argentina': 'AR',
  'australia': 'AU', 'austria': 'AT', 'bangladesh': 'BD', 'belgium': 'BE',
  'brazil': 'BR', 'burkina faso': 'BF', 'cambodia': 'KH', 'cameroon': 'CM',
  'canada': 'CA', 'chile': 'CL', 'china': 'CN', 'colombia': 'CO',
  'cuba': 'CU', 'czech republic': 'CZ', 'czechia': 'CZ',
  'denmark': 'DK', 'egypt': 'EG', 'ethiopia': 'ET',
  'finland': 'FI', 'france': 'FR', 'germany': 'DE', 'ghana': 'GH',
  'greece': 'GR', 'hungary': 'HU', 'india': 'IN', 'indonesia': 'ID',
  'iran': 'IR', 'iraq': 'IQ', 'ireland': 'IE', 'israel': 'IL',
  'italy': 'IT', 'japan': 'JP', 'jordan': 'JO', 'kazakhstan': 'KZ',
  'kenya': 'KE', 'kuwait': 'KW', 'laos': 'LA', 'lebanon': 'LB',
  'libya': 'LY', 'malaysia': 'MY', 'mexico': 'MX', 'mongolia': 'MN',
  'morocco': 'MA', 'myanmar': 'MM', 'nepal': 'NP', 'netherlands': 'NL',
  'new zealand': 'NZ', 'nigeria': 'NG', 'north korea': 'KP', 'norway': 'NO',
  'oman': 'OM', 'pakistan': 'PK', 'palestine': 'PS', 'panama': 'PA',
  'peru': 'PE', 'philippines': 'PH', 'poland': 'PL', 'portugal': 'PT',
  'qatar': 'QA', 'romania': 'RO', 'russia': 'RU', 'saudi arabia': 'SA',
  'serbia': 'RS', 'south africa': 'ZA', 'south korea': 'KR',
  'south sudan': 'SS', 'spain': 'ES', 'sri lanka': 'LK', 'sudan': 'SD',
  'sweden': 'SE', 'switzerland': 'CH', 'syria': 'SY', 'taiwan': 'TW',
  'thailand': 'TH', 'turkey': 'TR', 'turkmenistan': 'TM',
  'uganda': 'UG', 'ukraine': 'UA', 'united arab emirates': 'AE',
  'uae': 'AE', 'united kingdom': 'GB', 'uk': 'GB', 'britain': 'GB',
  'united states': 'US', 'usa': 'US', 'us': 'US', 'america': 'US',
  'uzbekistan': 'UZ', 'venezuela': 'VE', 'vietnam': 'VN', 'yemen': 'YE',
  'zambia': 'ZM', 'zimbabwe': 'ZW',
};

const COUNTRY_CENTROIDS = {
  'AF': [810, 230], 'AL': [660, 195], 'DZ': [576, 228], 'AR': [368, 450],
  'AU': [1065, 430], 'AT': [643, 180], 'BD': [880, 260], 'BE': [600, 170],
  'BR': [395, 380], 'BF': [553, 288], 'CA': [280, 120], 'CD': [682, 340],
  'CL': [350, 430], 'CN': [940, 225], 'CO': [340, 315], 'CU': [315, 265],
  'CZ': [645, 175], 'DK': [626, 150], 'EG': [695, 245], 'ET': [720, 300],
  'FI': [670, 120], 'FR': [592, 185], 'DE': [630, 170], 'GH': [543, 300],
  'GR': [668, 200], 'HU': [658, 182], 'IN': [855, 270], 'ID': [975, 340],
  'IR': [780, 230], 'IQ': [748, 225], 'IE': [566, 160], 'IL': [718, 232],
  'IT': [640, 195], 'JP': [1040, 200], 'JO': [722, 235], 'KZ': [810, 170],
  'KE': [720, 330], 'KW': [755, 240], 'LA': [935, 275], 'LB': [718, 225],
  'LY': [645, 240], 'MY': [940, 310], 'MX': [265, 265], 'MN': [940, 175],
  'MA': [555, 230], 'MM': [910, 270], 'NP': [865, 250], 'NL': [610, 165],
  'NZ': [1145, 470], 'NG': [575, 300], 'KP': [1005, 195], 'NO': [630, 125],
  'OM': [775, 260], 'PK': [830, 245], 'PS': [717, 233], 'PA': [330, 300],
  'PE': [340, 370], 'PH': [990, 290], 'PL': [655, 170], 'PT': [560, 200],
  'QA': [760, 252], 'RO': [672, 185], 'RU': [850, 130], 'SA': [745, 255],
  'RS': [660, 190], 'ZA': [688, 430], 'KR': [1015, 205], 'SS': [705, 315],
  'ES': [570, 205], 'LK': [860, 300], 'SD': [700, 280], 'SE': [645, 130],
  'CH': [618, 182], 'SY': [728, 220], 'TW': [985, 260], 'TH': [930, 290],
  'TR': [715, 205], 'TM': [790, 210], 'UA': [700, 170], 'UG': [705, 330],
  'AE': [770, 255], 'GB': [582, 160], 'US': [230, 210], 'UZ': [800, 195],
  'VE': [360, 300], 'VN': [950, 280], 'YE': [755, 275], 'ZM': [695, 385],
  'ZW': [700, 400],
};

function regionToIso(region) {
  return COUNTRY_TO_ISO[(region || '').toLowerCase().trim()] || null;
}

function escapeXml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Generate a PNG map image for a topic.
 * @param {object} topic - { title, category, regions[], sources[] }
 * @returns {Promise<Buffer|null>} PNG buffer (1200x630) or null on failure
 */
async function generateTopicMapImage(topic) {
  if (!SVG_TEMPLATE) {
    console.warn('mapImageGenerator: SVG template not found');
    return null;
  }

  let svg = SVG_TEMPLATE;
  const category = (topic.category || '').toLowerCase();
  const color = CATEGORY_COLORS[category] || '#3b82f6';
  const regions = topic.regions || [];
  const isoCodes = regions.map(regionToIso).filter(Boolean);
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const sourceCount = (topic.sources || []).length;

  // ── Highlight countries ──
  for (const iso of isoCodes) {
    const fillRegex = new RegExp(`(id="${iso}"[^>]*?)fill="[^"]*"`, 'g');
    svg = svg.replace(fillRegex, `$1fill="${color}" filter="url(#countryGlow)"`);
    const strokeRegex = new RegExp(`(id="${iso}"[^>]*?)stroke="[^"]*"`, 'g');
    svg = svg.replace(strokeRegex, `$1stroke="${color}"`);
  }

  // ── Connection lines ──
  const centroids = isoCodes.map(iso => ({ iso, pos: COUNTRY_CENTROIDS[iso] })).filter(c => c.pos);
  let connectionLines = '';
  if (centroids.length >= 2) {
    for (let i = 0; i < centroids.length; i++) {
      for (let j = i + 1; j < centroids.length; j++) {
        const [x1, y1] = centroids[i].pos;
        const [x2, y2] = centroids[j].pos;
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2 - Math.abs(x2 - x1) * 0.15;
        connectionLines += `  <path d="M${x1},${y1} Q${midX},${midY} ${x2},${y2}" fill="none" stroke="${color}" stroke-width="1.5" stroke-opacity="0.45" stroke-dasharray="6,4"/>\n`;
      }
    }
    // Endpoint dots on connection lines
    for (const { pos } of centroids) {
      connectionLines += `  <circle cx="${pos[0]}" cy="${pos[1]}" r="5" fill="${color}" fill-opacity="0.6" stroke="${color}" stroke-width="1" stroke-opacity="0.8"/>\n`;
      connectionLines += `  <circle cx="${pos[0]}" cy="${pos[1]}" r="2" fill="#ffffff"/>\n`;
    }
  }

  // ── Country labels ──
  let countryLabels = '';
  for (const { iso, pos } of centroids) {
    const [cx, cy] = pos;
    const regionName = regions.find(r => regionToIso(r) === iso) || iso;
    const label = regionName.length > 12 ? iso : regionName.toUpperCase();
    const labelWidth = label.length * 6.5 + 12;
    countryLabels += `  <rect x="${cx - labelWidth / 2}" y="${cy - 22}" width="${labelWidth}" height="16" rx="3" fill="#0f172a" fill-opacity="0.8"/>\n`;
    countryLabels += `  <text x="${cx}" y="${cy - 10}" font-family="Inter, sans-serif" font-size="9" font-weight="600" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">${escapeXml(label)}</text>\n`;
    countryLabels += `  <circle cx="${cx}" cy="${cy}" r="4" fill="${color}" stroke="#ffffff" stroke-width="1"/>\n`;
  }

  // ── Text elements ──
  const titleText = (topic.title || '').length > 65 ? topic.title.substring(0, 62) + '...' : (topic.title || '');
  const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);
  const regionText = regions.slice(0, 4).join(' \u00B7 ');
  const sourceLabel = sourceCount > 0 ? `${sourceCount} source${sourceCount !== 1 ? 's' : ''}` : '';
  const metaParts = [regionText, sourceLabel, date].filter(Boolean).join('  \u00B7  ');

  // ── Logo ──
  const logoElement = LOGO_BASE64
    ? `<image x="1105" y="555" width="28" height="28" href="data:image/png;base64,${LOGO_BASE64}"/>`
    : '';

  // ── Compose overlay ──
  const overlay = `
  <defs>
    <filter id="countryGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>
      <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.6 0" result="glow"/>
      <feMerge>
        <feMergeNode in="glow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <linearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0f172a" stop-opacity="0"/>
      <stop offset="30%" stop-color="#0f172a" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#0f172a" stop-opacity="0.97"/>
    </linearGradient>
  </defs>
${connectionLines}
${countryLabels}
  <rect x="0" y="470" width="1200" height="160" fill="url(#bottomFade)"/>
  <rect x="40" y="530" width="${categoryLabel.length * 8 + 16}" height="20" rx="4" fill="${color}" fill-opacity="0.2"/>
  <text x="${40 + (categoryLabel.length * 8 + 16) / 2}" y="544" font-family="Inter, sans-serif" font-size="11" font-weight="600" fill="${color}" text-anchor="middle" letter-spacing="0.5">${escapeXml(categoryLabel.toUpperCase())}</text>
  <text x="40" y="572" font-family="Inter, sans-serif" font-size="22" font-weight="700" fill="#ffffff">${escapeXml(titleText)}</text>
  <text x="40" y="594" font-family="Inter, sans-serif" font-size="12" fill="#94a3b8">${escapeXml(metaParts)}</text>
  ${logoElement}
  <text x="1098" y="575" font-family="Inter, sans-serif" font-size="11" font-weight="500" fill="#94a3b8" text-anchor="end">Global Perspectives</text>
`;

  svg = svg.replace('</svg>', `${overlay}\n</svg>`);

  // ── Convert SVG → PNG via sharp ──
  const pngBuffer = await sharp(Buffer.from(svg))
    .resize(1200, 630)
    .png({ quality: 90 })
    .toBuffer();

  return pngBuffer;
}

module.exports = { generateTopicMapImage };
