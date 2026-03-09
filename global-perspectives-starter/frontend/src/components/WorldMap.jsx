import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Wrapper } from '@googlemaps/react-wrapper';
import { useGeminiTopics } from '../hooks/useGeminiTopics';
import { useTodayArchive } from '../hooks/useTodayArchive';
import { getTopicCountryCodes } from '../utils/countryMapping';
import MapSidePanel from './MapSidePanel';
import TodayArchiveSidebar from './TodayArchiveSidebar';
import './WorldMap.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS = {
  conflict:   '#ef4444',
  military:   '#ef4444',
  disaster:   '#f97316',
  politics:   '#3b82f6',
  economy:    '#22c55e',
  technology: '#8b5cf6',
  health:     '#14b8a6',
  other:      '#6b7280',
};

const CATEGORY_DISPLAY_ORDER = ['conflict', 'military', 'disaster', 'politics', 'economy', 'technology', 'health', 'other'];

const getFlagEmoji = (code) => {
  if (!code || code === 'Unknown' || code.length !== 2) return '🌍';
  const codePoints = code.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

const getCategoryColor = (category) => CATEGORY_COLORS[(category || '').toLowerCase()] || CATEGORY_COLORS.other;

function getMutedColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const gr = 0x94, gg = 0xa3, gb = 0xb8;
  const mr = Math.round(r * 0.35 + gr * 0.65);
  const mg = Math.round(g * 0.35 + gg * 0.65);
  const mb = Math.round(b * 0.35 + gb * 0.65);
  return `#${mr.toString(16).padStart(2,'0')}${mg.toString(16).padStart(2,'0')}${mb.toString(16).padStart(2,'0')}`;
}

// Hardcoded country coordinates for all 195 countries
const COUNTRY_COORDINATES = {
  'AF': { lat: 33.9391, lng: 67.7100, name: 'Afghanistan' },
  'AL': { lat: 41.1533, lng: 20.1683, name: 'Albania' },
  'DZ': { lat: 28.0339, lng: 1.6596, name: 'Algeria' },
  'AD': { lat: 42.5063, lng: 1.5218, name: 'Andorra' },
  'AO': { lat: -11.2027, lng: 17.8739, name: 'Angola' },
  'AG': { lat: 17.0608, lng: -61.7964, name: 'Antigua and Barbuda' },
  'AR': { lat: -38.4161, lng: -63.6167, name: 'Argentina' },
  'AM': { lat: 40.0691, lng: 45.0382, name: 'Armenia' },
  'AU': { lat: -25.2744, lng: 133.7751, name: 'Australia' },
  'AT': { lat: 47.5162, lng: 14.5501, name: 'Austria' },
  'AZ': { lat: 40.1431, lng: 47.5769, name: 'Azerbaijan' },
  'BS': { lat: 25.0343, lng: -77.3963, name: 'Bahamas' },
  'BH': { lat: 26.0667, lng: 50.5577, name: 'Bahrain' },
  'BD': { lat: 23.6850, lng: 90.3563, name: 'Bangladesh' },
  'BB': { lat: 13.1939, lng: -59.5432, name: 'Barbados' },
  'BY': { lat: 53.7098, lng: 27.9534, name: 'Belarus' },
  'BE': { lat: 50.5039, lng: 4.4699, name: 'Belgium' },
  'BZ': { lat: 17.1899, lng: -88.4976, name: 'Belize' },
  'BJ': { lat: 9.3077, lng: 2.3158, name: 'Benin' },
  'BT': { lat: 27.5142, lng: 90.4336, name: 'Bhutan' },
  'BO': { lat: -16.2902, lng: -63.5887, name: 'Bolivia' },
  'BA': { lat: 43.9159, lng: 17.6791, name: 'Bosnia and Herzegovina' },
  'BW': { lat: -22.3285, lng: 24.6849, name: 'Botswana' },
  'BR': { lat: -14.2350, lng: -51.9253, name: 'Brazil' },
  'BN': { lat: 4.5353, lng: 114.7277, name: 'Brunei' },
  'BG': { lat: 42.7339, lng: 25.4858, name: 'Bulgaria' },
  'BF': { lat: 12.2383, lng: -1.5616, name: 'Burkina Faso' },
  'BI': { lat: -3.3731, lng: 29.9189, name: 'Burundi' },
  'KH': { lat: 12.5657, lng: 104.9910, name: 'Cambodia' },
  'CM': { lat: 7.3697, lng: 12.3547, name: 'Cameroon' },
  'CA': { lat: 56.1304, lng: -106.3468, name: 'Canada' },
  'CV': { lat: 16.5388, lng: -23.0418, name: 'Cape Verde' },
  'CF': { lat: 6.6111, lng: 20.9394, name: 'Central African Republic' },
  'TD': { lat: 15.4542, lng: 18.7322, name: 'Chad' },
  'CL': { lat: -35.6751, lng: -71.5430, name: 'Chile' },
  'CN': { lat: 35.8617, lng: 104.1954, name: 'China' },
  'CO': { lat: 4.5709, lng: -74.2973, name: 'Colombia' },
  'KM': { lat: -11.6455, lng: 43.3333, name: 'Comoros' },
  'CG': { lat: -0.2280, lng: 15.8277, name: 'Congo' },
  'CD': { lat: -4.0383, lng: 21.7587, name: 'DR Congo' },
  'CR': { lat: 9.7489, lng: -83.7534, name: 'Costa Rica' },
  'HR': { lat: 45.1000, lng: 15.2000, name: 'Croatia' },
  'CU': { lat: 21.5218, lng: -77.7812, name: 'Cuba' },
  'CY': { lat: 35.1264, lng: 33.4299, name: 'Cyprus' },
  'CZ': { lat: 49.8175, lng: 15.4730, name: 'Czech Republic' },
  'DK': { lat: 56.2639, lng: 9.5018, name: 'Denmark' },
  'DJ': { lat: 11.8251, lng: 42.5903, name: 'Djibouti' },
  'DM': { lat: 15.4150, lng: -61.3710, name: 'Dominica' },
  'DO': { lat: 18.7357, lng: -70.1627, name: 'Dominican Republic' },
  'EC': { lat: -1.8312, lng: -78.1834, name: 'Ecuador' },
  'EG': { lat: 26.8206, lng: 30.8025, name: 'Egypt' },
  'SV': { lat: 13.7942, lng: -88.8965, name: 'El Salvador' },
  'GQ': { lat: 1.6508, lng: 10.2679, name: 'Equatorial Guinea' },
  'ER': { lat: 15.1794, lng: 39.7823, name: 'Eritrea' },
  'EE': { lat: 58.5953, lng: 25.0136, name: 'Estonia' },
  'SZ': { lat: -26.5225, lng: 31.4659, name: 'Eswatini' },
  'ET': { lat: 9.1450, lng: 40.4897, name: 'Ethiopia' },
  'FJ': { lat: -17.7134, lng: 178.0650, name: 'Fiji' },
  'FI': { lat: 61.9241, lng: 25.7482, name: 'Finland' },
  'FR': { lat: 46.6034, lng: 1.8883, name: 'France' },
  'GA': { lat: -0.8037, lng: 11.6094, name: 'Gabon' },
  'GM': { lat: 13.4432, lng: -15.3101, name: 'Gambia' },
  'GE': { lat: 42.3154, lng: 43.3569, name: 'Georgia' },
  'DE': { lat: 51.1657, lng: 10.4515, name: 'Germany' },
  'GH': { lat: 7.9465, lng: -1.0232, name: 'Ghana' },
  'GR': { lat: 39.0742, lng: 21.8243, name: 'Greece' },
  'GD': { lat: 12.1165, lng: -61.6790, name: 'Grenada' },
  'GT': { lat: 15.7835, lng: -90.2308, name: 'Guatemala' },
  'GN': { lat: 9.9456, lng: -9.6966, name: 'Guinea' },
  'GW': { lat: 11.8037, lng: -15.1804, name: 'Guinea-Bissau' },
  'GY': { lat: 4.8604, lng: -58.9302, name: 'Guyana' },
  'HT': { lat: 18.9712, lng: -72.2852, name: 'Haiti' },
  'HN': { lat: 15.2000, lng: -86.2419, name: 'Honduras' },
  'HU': { lat: 47.1625, lng: 19.5033, name: 'Hungary' },
  'IS': { lat: 64.9631, lng: -19.0208, name: 'Iceland' },
  'IN': { lat: 20.5937, lng: 78.9629, name: 'India' },
  'ID': { lat: -0.7893, lng: 113.9213, name: 'Indonesia' },
  'IR': { lat: 32.4279, lng: 53.6880, name: 'Iran' },
  'IQ': { lat: 33.2232, lng: 43.6793, name: 'Iraq' },
  'IE': { lat: 53.4129, lng: -8.2439, name: 'Ireland' },
  'IL': { lat: 31.0461, lng: 34.8516, name: 'Israel' },
  'IT': { lat: 41.8719, lng: 12.5674, name: 'Italy' },
  'JM': { lat: 18.1096, lng: -77.2975, name: 'Jamaica' },
  'JP': { lat: 36.2048, lng: 138.2529, name: 'Japan' },
  'JO': { lat: 30.5852, lng: 36.2384, name: 'Jordan' },
  'KZ': { lat: 48.0196, lng: 66.9237, name: 'Kazakhstan' },
  'KE': { lat: -0.0236, lng: 37.9062, name: 'Kenya' },
  'KI': { lat: -3.3704, lng: -168.7340, name: 'Kiribati' },
  'XK': { lat: 42.6026, lng: 20.9030, name: 'Kosovo' },
  'KW': { lat: 29.3117, lng: 47.4818, name: 'Kuwait' },
  'KG': { lat: 41.2044, lng: 74.7661, name: 'Kyrgyzstan' },
  'LA': { lat: 19.8563, lng: 102.4955, name: 'Laos' },
  'LV': { lat: 56.8796, lng: 24.6032, name: 'Latvia' },
  'LB': { lat: 33.8547, lng: 35.8623, name: 'Lebanon' },
  'LS': { lat: -29.6100, lng: 28.2336, name: 'Lesotho' },
  'LR': { lat: 6.4281, lng: -9.4295, name: 'Liberia' },
  'LY': { lat: 26.3351, lng: 17.2283, name: 'Libya' },
  'LI': { lat: 47.1660, lng: 9.5554, name: 'Liechtenstein' },
  'LT': { lat: 55.1694, lng: 23.8813, name: 'Lithuania' },
  'LU': { lat: 49.8153, lng: 6.1296, name: 'Luxembourg' },
  'MG': { lat: -18.7669, lng: 46.8691, name: 'Madagascar' },
  'MW': { lat: -13.2543, lng: 34.3015, name: 'Malawi' },
  'MY': { lat: 4.2105, lng: 101.9758, name: 'Malaysia' },
  'MV': { lat: 3.2028, lng: 73.2207, name: 'Maldives' },
  'ML': { lat: 17.5707, lng: -3.9962, name: 'Mali' },
  'MT': { lat: 35.9375, lng: 14.3754, name: 'Malta' },
  'MH': { lat: 7.1315, lng: 171.1845, name: 'Marshall Islands' },
  'MR': { lat: 21.0079, lng: -10.9408, name: 'Mauritania' },
  'MU': { lat: -20.3484, lng: 57.5522, name: 'Mauritius' },
  'MX': { lat: 23.6345, lng: -102.5528, name: 'Mexico' },
  'FM': { lat: 7.4256, lng: 150.5508, name: 'Micronesia' },
  'MD': { lat: 47.4116, lng: 28.3699, name: 'Moldova' },
  'MC': { lat: 43.7384, lng: 7.4246, name: 'Monaco' },
  'MN': { lat: 46.8625, lng: 103.8467, name: 'Mongolia' },
  'ME': { lat: 42.7087, lng: 19.3744, name: 'Montenegro' },
  'MA': { lat: 31.7917, lng: -7.0926, name: 'Morocco' },
  'MZ': { lat: -18.6657, lng: 35.5296, name: 'Mozambique' },
  'MM': { lat: 21.9162, lng: 95.9560, name: 'Myanmar' },
  'NA': { lat: -22.9576, lng: 18.4904, name: 'Namibia' },
  'NR': { lat: -0.5228, lng: 166.9315, name: 'Nauru' },
  'NP': { lat: 28.3949, lng: 84.1240, name: 'Nepal' },
  'NL': { lat: 52.1326, lng: 5.2913, name: 'Netherlands' },
  'NZ': { lat: -40.9006, lng: 174.8860, name: 'New Zealand' },
  'NI': { lat: 12.8654, lng: -85.2072, name: 'Nicaragua' },
  'NE': { lat: 17.6078, lng: 8.0817, name: 'Niger' },
  'NG': { lat: 9.0820, lng: 8.6753, name: 'Nigeria' },
  'KP': { lat: 40.3399, lng: 127.5101, name: 'North Korea' },
  'MK': { lat: 41.6086, lng: 21.7453, name: 'North Macedonia' },
  'NO': { lat: 60.4720, lng: 8.4689, name: 'Norway' },
  'OM': { lat: 21.4735, lng: 55.9754, name: 'Oman' },
  'PK': { lat: 30.3753, lng: 69.3451, name: 'Pakistan' },
  'PW': { lat: 7.5150, lng: 134.5825, name: 'Palau' },
  'PS': { lat: 31.9522, lng: 35.2332, name: 'Palestine' },
  'PA': { lat: 8.5380, lng: -80.7821, name: 'Panama' },
  'PG': { lat: -6.3150, lng: 143.9555, name: 'Papua New Guinea' },
  'PY': { lat: -23.4425, lng: -58.4438, name: 'Paraguay' },
  'PE': { lat: -9.1900, lng: -75.0152, name: 'Peru' },
  'PH': { lat: 12.8797, lng: 121.7740, name: 'Philippines' },
  'PL': { lat: 51.9194, lng: 19.1451, name: 'Poland' },
  'PT': { lat: 39.3999, lng: -8.2245, name: 'Portugal' },
  'QA': { lat: 25.3548, lng: 51.1839, name: 'Qatar' },
  'RO': { lat: 45.9432, lng: 24.9668, name: 'Romania' },
  'RU': { lat: 61.5240, lng: 105.3188, name: 'Russia' },
  'RW': { lat: -1.9403, lng: 29.8739, name: 'Rwanda' },
  'KN': { lat: 17.3578, lng: -62.7830, name: 'Saint Kitts and Nevis' },
  'LC': { lat: 13.9094, lng: -60.9789, name: 'Saint Lucia' },
  'VC': { lat: 12.9843, lng: -61.2872, name: 'Saint Vincent' },
  'WS': { lat: -13.7590, lng: -172.1046, name: 'Samoa' },
  'SM': { lat: 43.9424, lng: 12.4578, name: 'San Marino' },
  'ST': { lat: 0.1864, lng: 6.6131, name: 'Sao Tome and Principe' },
  'SA': { lat: 23.8859, lng: 45.0792, name: 'Saudi Arabia' },
  'SN': { lat: 14.4974, lng: -14.4524, name: 'Senegal' },
  'RS': { lat: 44.0165, lng: 21.0059, name: 'Serbia' },
  'SC': { lat: -4.6796, lng: 55.4920, name: 'Seychelles' },
  'SL': { lat: 8.4606, lng: -11.7799, name: 'Sierra Leone' },
  'SG': { lat: 1.3521, lng: 103.8198, name: 'Singapore' },
  'SK': { lat: 48.6690, lng: 19.6990, name: 'Slovakia' },
  'SI': { lat: 46.1512, lng: 14.9955, name: 'Slovenia' },
  'SB': { lat: -9.6457, lng: 160.1562, name: 'Solomon Islands' },
  'SO': { lat: 5.1521, lng: 46.1996, name: 'Somalia' },
  'ZA': { lat: -30.5595, lng: 22.9375, name: 'South Africa' },
  'KR': { lat: 35.9078, lng: 127.7669, name: 'South Korea' },
  'SS': { lat: 6.8770, lng: 31.3070, name: 'South Sudan' },
  'ES': { lat: 40.4637, lng: -3.7492, name: 'Spain' },
  'LK': { lat: 7.8731, lng: 80.7718, name: 'Sri Lanka' },
  'SD': { lat: 12.8628, lng: 30.2176, name: 'Sudan' },
  'SR': { lat: 3.9193, lng: -56.0278, name: 'Suriname' },
  'SE': { lat: 60.1282, lng: 18.6435, name: 'Sweden' },
  'CH': { lat: 46.8182, lng: 8.2275, name: 'Switzerland' },
  'SY': { lat: 34.8021, lng: 38.9968, name: 'Syria' },
  'TW': { lat: 23.6978, lng: 120.9605, name: 'Taiwan' },
  'TJ': { lat: 38.8610, lng: 71.2761, name: 'Tajikistan' },
  'TZ': { lat: -6.3690, lng: 34.8888, name: 'Tanzania' },
  'TH': { lat: 15.8700, lng: 100.9925, name: 'Thailand' },
  'TL': { lat: -8.8742, lng: 125.7275, name: 'Timor-Leste' },
  'TG': { lat: 8.6195, lng: 0.8248, name: 'Togo' },
  'TO': { lat: -21.1789, lng: -175.1982, name: 'Tonga' },
  'TT': { lat: 10.6918, lng: -61.2225, name: 'Trinidad and Tobago' },
  'TN': { lat: 33.8869, lng: 9.5375, name: 'Tunisia' },
  'TR': { lat: 38.9637, lng: 35.2433, name: 'Turkey' },
  'TM': { lat: 38.9697, lng: 59.5563, name: 'Turkmenistan' },
  'TV': { lat: -7.1095, lng: 177.6493, name: 'Tuvalu' },
  'UG': { lat: 1.3733, lng: 32.2903, name: 'Uganda' },
  'UA': { lat: 48.3794, lng: 31.1656, name: 'Ukraine' },
  'AE': { lat: 23.4241, lng: 53.8478, name: 'UAE' },
  'GB': { lat: 55.3781, lng: -3.4360, name: 'United Kingdom' },
  'US': { lat: 39.8283, lng: -98.5795, name: 'United States' },
  'UY': { lat: -32.5228, lng: -55.7658, name: 'Uruguay' },
  'UZ': { lat: 41.3775, lng: 64.5853, name: 'Uzbekistan' },
  'VU': { lat: -15.3767, lng: 166.9592, name: 'Vanuatu' },
  'VA': { lat: 41.9029, lng: 12.4534, name: 'Vatican City' },
  'VE': { lat: 6.4238, lng: -66.5897, name: 'Venezuela' },
  'VN': { lat: 14.0583, lng: 108.2772, name: 'Vietnam' },
  'YE': { lat: 15.5527, lng: 48.5164, name: 'Yemen' },
  'ZM': { lat: -13.1339, lng: 27.8493, name: 'Zambia' },
  'ZW': { lat: -19.0154, lng: 29.1549, name: 'Zimbabwe' },
};

// ─── Data Model ────────────────────────────────────────────────────────────────

function buildMapData(topics) {
  const countryTopicMap = {};
  const connectionMap = {}; // key: "A-B" → { from, to, topics[], categories[] }

  topics.forEach(topic => {
    let codes = getTopicCountryCodes(topic);

    // South Sudan disambiguation
    const titleLower = String(topic?.title || '').toLowerCase();
    if (titleLower.includes('south sudan')) {
      codes = codes.filter(c => c !== 'SD');
      if (!codes.includes('SS')) codes.push('SS');
    }

    codes.forEach(code => {
      if (!COUNTRY_COORDINATES[code]) return;
      if (!countryTopicMap[code]) {
        countryTopicMap[code] = {
          ...COUNTRY_COORDINATES[code],
          code,
          topics: [],
        };
      }
      countryTopicMap[code].topics.push(topic);
    });

    // Build pairwise connections
    for (let i = 0; i < codes.length; i++) {
      for (let j = i + 1; j < codes.length; j++) {
        const a = codes[i];
        const b = codes[j];
        if (!COUNTRY_COORDINATES[a] || !COUNTRY_COORDINATES[b]) continue;
        const key = [a, b].sort().join('-');
        if (!connectionMap[key]) {
          connectionMap[key] = { from: a, to: b, topics: [], categories: [] };
        }
        connectionMap[key].topics.push(topic);
        const cat = (topic.category || 'other').toLowerCase();
        if (!connectionMap[key].categories.includes(cat)) {
          connectionMap[key].categories.push(cat);
        }
      }
    }
  });

  const connections = Object.values(connectionMap);
  return { countryTopicMap, connections };
}

function getDominantCategory(topics) {
  const counts = {};
  topics.forEach(t => {
    const cat = (t.category || 'other').toLowerCase();
    counts[cat] = (counts[cat] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'other';
}

// ─── Google MapComponent ───────────────────────────────────────────────────────

function MapComponent({ countryTopicMap, connections, archiveCountryTopicMap, archiveConnections, onCountryClick, onConnectionClick, selectedTopic }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const polylinesRef = useRef([]);
  const archiveMarkersRef = useRef([]);
  const archivePolylinesRef = useRef([]);
  const highlightCirclesRef = useRef([]);
  const infoWindowRef = useRef(null);

  // Init map
  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: 20, lng: 10 },
        zoom: 2,
        styles: [
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dde8f0' }] },
          { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
          { featureType: 'road', stylers: [{ visibility: 'off' }] },
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
          { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#c0c0c0' }] },
        ],
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      infoWindowRef.current = new window.google.maps.InfoWindow();

      // Click on map background closes info window (story flow stays active)
      mapInstanceRef.current.addListener('click', () => {
        if (infoWindowRef.current) infoWindowRef.current.close();
      });
    }
  }, [onConnectionClick]);

  // Draw markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !countryTopicMap) return;

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    Object.values(countryTopicMap).forEach(country => {
      const { lat, lng, name, code, topics } = country;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const dominant = getDominantCategory(topics);
      const color = getCategoryColor(dominant);
      const count = topics.length;
      const size = count >= 4 ? 16 : count >= 2 ? 12 : 9;

      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        map,
        title: `${name}: ${count} topic${count !== 1 ? 's' : ''}`,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: size,
          fillColor: color,
          fillOpacity: 0.9,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
        label: {
          text: String(count),
          color: '#fff',
          fontWeight: 'bold',
          fontSize: count >= 10 ? '10px' : '11px',
        },
        zIndex: count * 10,
      });
      marker._baseScale = size;
      marker._fillColor = color;
      marker._count = count;

      marker.addListener('click', (e) => {
        e.stop?.();

        const topicListHtml = topics.map((t, idx) => {
          const cat = (t.category || 'other').toLowerCase();
          const catColor = getCategoryColor(cat);
          const otherCodes = getTopicCountryCodes(t).filter(c => c !== code);
          const othersText = otherCodes.length
            ? `<div style="font-size:11px;color:#888;margin-top:2px;">Also affects: ${otherCodes.map(getFlagEmoji).join(' ')}</div>`
            : '';
          return `
            <div id="iw-topic-${code}-${idx}" style="padding:8px 6px;border-bottom:1px solid #f0f0f0;cursor:pointer;border-radius:4px;transition:background 0.15s;" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='transparent'">
              <span style="display:inline-block;background:${catColor};color:#fff;font-size:10px;padding:1px 6px;border-radius:999px;margin-right:4px;">${cat}</span>
              <span style="font-size:13px;font-weight:500;">${t.title}</span>
              ${othersText}
            </div>`;
        }).join('');

        infoWindowRef.current.setContent(`
          <div style="max-width:300px;font-family:sans-serif;">
            <div style="font-size:15px;font-weight:700;margin-bottom:8px;">
              ${getFlagEmoji(code)} ${name} — ${count} topic${count !== 1 ? 's' : ''}
            </div>
            ${topicListHtml}
          </div>
        `);
        infoWindowRef.current.open(map, marker);

        setTimeout(() => {
          topics.forEach((t, idx) => {
            const el = document.getElementById(`iw-topic-${code}-${idx}`);
            if (el) el.addEventListener('click', () => {
              infoWindowRef.current.close();
              onCountryClick(code, t);
            });
          });
        }, 80);
      });

      markersRef.current.push(marker);
    });
  }, [countryTopicMap, onCountryClick]);

  // Draw connection lines
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !connections) return;

    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];

    connections.forEach(conn => {
      const fromCoords = COUNTRY_COORDINATES[conn.from];
      const toCoords = COUNTRY_COORDINATES[conn.to];
      if (!fromCoords || !toCoords) return;

      const dominantCat = conn.categories[0] || 'other';
      const color = getCategoryColor(dominantCat);
      const weight = Math.min(1 + conn.topics.length, 4);

      const polyline = new window.google.maps.Polyline({
        path: [
          { lat: fromCoords.lat, lng: fromCoords.lng },
          { lat: toCoords.lat, lng: toCoords.lng },
        ],
        geodesic: true,
        strokeColor: color,
        strokeOpacity: 0.45,
        strokeWeight: weight,
        map,
      });

      polyline.addListener('click', (e) => {
        e.stop?.();
        if (conn.topics.length === 1) {
          onConnectionClick(conn.topics[0]);
        } else {
          // Show mini info window listing topics on this line
          const html = conn.topics.map(t => `<div style="padding:3px 0;font-size:13px;">${t.title}</div>`).join('');
          infoWindowRef.current.setContent(`
            <div style="max-width:260px;font-family:sans-serif;">
              <div style="font-weight:600;margin-bottom:6px;">${getFlagEmoji(conn.from)} ↔ ${getFlagEmoji(conn.to)}</div>
              ${html}
            </div>
          `);
          infoWindowRef.current.setPosition(e.latLng);
          infoWindowRef.current.open(map);
        }
      });

      polyline._connData = conn;
      polylinesRef.current.push(polyline);
    });
  }, [connections, onConnectionClick]);

  // Draw archive-only markers (muted, smaller, no label)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !archiveCountryTopicMap) return;

    archiveMarkersRef.current.forEach(m => m.setMap(null));
    archiveMarkersRef.current = [];

    Object.values(archiveCountryTopicMap).forEach(country => {
      const { lat, lng, name, code, topics } = country;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const dominant = getDominantCategory(topics);
      const mutedColor = getMutedColor(getCategoryColor(dominant));

      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        map,
        title: `${name}: ${topics.length} earlier topic${topics.length !== 1 ? 's' : ''}`,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: mutedColor,
          fillOpacity: 0.6,
          strokeColor: '#ccc',
          strokeWeight: 1,
        },
        zIndex: 1,
      });

      marker.addListener('click', (e) => {
        e.stop?.();
        onCountryClick(code);
      });

      archiveMarkersRef.current.push(marker);
    });
  }, [archiveCountryTopicMap, onCountryClick]);

  // Draw archive connections (dashed, muted)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !archiveConnections) return;

    archivePolylinesRef.current.forEach(p => p.setMap(null));
    archivePolylinesRef.current = [];

    archiveConnections.forEach(conn => {
      const fromCoords = COUNTRY_COORDINATES[conn.from];
      const toCoords = COUNTRY_COORDINATES[conn.to];
      if (!fromCoords || !toCoords) return;

      const dominantCat = conn.categories[0] || 'other';
      const mutedColor = getMutedColor(getCategoryColor(dominantCat));

      const polyline = new window.google.maps.Polyline({
        path: [
          { lat: fromCoords.lat, lng: fromCoords.lng },
          { lat: toCoords.lat, lng: toCoords.lng },
        ],
        geodesic: true,
        strokeColor: mutedColor,
        strokeOpacity: 0,
        strokeWeight: 2,
        icons: [{
          icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.5, scale: 2, strokeColor: mutedColor },
          offset: '0',
          repeat: '12px',
        }],
        map,
        zIndex: 0,
      });

      archivePolylinesRef.current.push(polyline);
    });
  }, [archiveConnections]);

  // Story flow: yellow highlight on affected countries
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear previous highlight circles
    highlightCirclesRef.current.forEach(c => c.setMap(null));
    highlightCirclesRef.current = [];

    if (!selectedTopic) {
      // Reset polylines to normal
      polylinesRef.current.forEach(p => {
        p.setOptions({ strokeOpacity: 0.45, strokeWeight: Math.min(1 + p._connData.topics.length, 4) });
      });
      return;
    }

    const selectedId = selectedTopic.topicId || selectedTopic.id;
    const affectedCodes = new Set(getTopicCountryCodes(selectedTopic));

    // Slightly emphasize selected polylines, keep others normal
    polylinesRef.current.forEach(p => {
      const conn = p._connData;
      const isSelected = conn.topics.some(t => (t.topicId || t.id) === selectedId);
      p.setOptions({
        strokeOpacity: isSelected ? 0.85 : 0.45,
        strokeWeight: isSelected ? 4 : Math.min(1 + conn.topics.length, 4),
      });
    });

    // Add yellow highlight markers (fixed pixel size, zoom-independent)
    affectedCodes.forEach(code => {
      const coords = COUNTRY_COORDINATES[code];
      if (!coords) return;
      const marker = new window.google.maps.Marker({
        position: { lat: coords.lat, lng: coords.lng },
        map,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 30,
          fillColor: '#facc15',
          fillOpacity: 0.22,
          strokeColor: '#eab308',
          strokeOpacity: 0.5,
          strokeWeight: 2,
        },
        clickable: false,
        zIndex: 1,
      });
      highlightCirclesRef.current.push(marker);
    });
  }, [selectedTopic, countryTopicMap]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

// ─── Fallback Map ──────────────────────────────────────────────────────────────

function FallbackMapComponent({ countryTopicMap, connections, archiveCountryTopicMap, archiveConnections, onCountryClick }) {
  const [hoveredCode, setHoveredCode] = useState(null);

  const countries = Object.values(countryTopicMap || {});
  const archiveCountries = Object.values(archiveCountryTopicMap || {});
  const totalConnections = (connections || []).length;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: '#dde8f0' }}>
      <svg width="100%" height="100%" viewBox="0 0 1000 500" style={{ position: 'absolute', inset: 0 }}>
        <rect width="1000" height="500" fill="#dde8f0" />
        <path d="M100 100 L300 80 L320 200 L250 250 L150 220 Z" fill="#e8f0e8" stroke="#c0d0c0" strokeWidth="1" />
        <path d="M200 280 L280 270 L300 400 L220 420 L180 350 Z" fill="#e8f0e8" stroke="#c0d0c0" strokeWidth="1" />
        <path d="M450 80 L550 70 L580 150 L500 180 L430 140 Z" fill="#e8f0e8" stroke="#c0d0c0" strokeWidth="1" />
        <path d="M480 200 L580 190 L600 350 L520 380 L460 320 Z" fill="#e8f0e8" stroke="#c0d0c0" strokeWidth="1" />
        <path d="M600 50 L850 40 L880 200 L750 220 L620 180 Z" fill="#e8f0e8" stroke="#c0d0c0" strokeWidth="1" />
        <path d="M750 350 L850 340 L870 400 L780 410 Z" fill="#e8f0e8" stroke="#c0d0c0" strokeWidth="1" />

        {/* Archive connection lines (dashed, muted) */}
        {(archiveConnections || []).slice(0, 50).map((conn, i) => {
          const from = COUNTRY_COORDINATES[conn.from];
          const to = COUNTRY_COORDINATES[conn.to];
          if (!from || !to) return null;
          const x1 = ((from.lng + 180) / 360) * 1000;
          const y1 = ((90 - from.lat) / 180) * 500;
          const x2 = ((to.lng + 180) / 360) * 1000;
          const y2 = ((90 - to.lat) / 180) * 500;
          const mutedColor = getMutedColor(getCategoryColor(conn.categories[0] || 'other'));
          return (
            <line key={`arc-${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={mutedColor} strokeWidth="1" strokeOpacity="0.35" strokeDasharray="6 4" />
          );
        })}

        {/* Connection lines */}
        {(connections || []).slice(0, 50).map((conn, i) => {
          const from = COUNTRY_COORDINATES[conn.from];
          const to = COUNTRY_COORDINATES[conn.to];
          if (!from || !to) return null;
          const x1 = ((from.lng + 180) / 360) * 1000;
          const y1 = ((90 - from.lat) / 180) * 500;
          const x2 = ((to.lng + 180) / 360) * 1000;
          const y2 = ((90 - to.lat) / 180) * 500;
          const color = getCategoryColor(conn.categories[0] || 'other');
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={color} strokeWidth="1" strokeOpacity="0.4" />
          );
        })}

        {/* Country markers */}
        {countries.map(country => {
          const x = ((country.lng + 180) / 360) * 1000;
          const y = ((90 - country.lat) / 180) * 500;
          const dominant = getDominantCategory(country.topics);
          const color = getCategoryColor(dominant);
          const r = Math.min(4 + country.topics.length * 2, 12);
          return (
            <g key={country.code}>
              <circle cx={x} cy={y} r={r} fill={color} stroke="#fff" strokeWidth="1.5"
                style={{ cursor: 'pointer', opacity: hoveredCode === country.code ? 0.75 : 1 }}
                onMouseEnter={() => setHoveredCode(country.code)}
                onMouseLeave={() => setHoveredCode(null)}
                onClick={() => onCountryClick(country.code)}
              />
              <text x={x} y={y + 4} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold"
                style={{ pointerEvents: 'none' }}>
                {country.topics.length}
              </text>
              {hoveredCode === country.code && (
                <text x={x} y={y - r - 4} textAnchor="middle" fill="#333" fontSize="11" fontWeight="600"
                  style={{ pointerEvents: 'none' }}>
                  {country.name}
                </text>
              )}
            </g>
          );
        })}

        {/* Archive-only country markers (muted, smaller) */}
        {archiveCountries.map(country => {
          const x = ((country.lng + 180) / 360) * 1000;
          const y = ((90 - country.lat) / 180) * 500;
          const dominant = getDominantCategory(country.topics);
          const mutedColor = getMutedColor(getCategoryColor(dominant));
          return (
            <circle key={`arc-${country.code}`} cx={x} cy={y} r={4}
              fill={mutedColor} stroke="#ccc" strokeWidth="1" opacity="0.6"
              style={{ cursor: 'pointer' }}
              onClick={() => onCountryClick(country.code)}
            />
          );
        })}
      </svg>

      <div style={{ position: 'absolute', bottom: 16, left: 16, background: 'rgba(255,255,255,0.9)',
        padding: '8px 12px', borderRadius: 6, fontSize: 12, color: '#555' }}>
        📍 Simplified map · {countries.length} countries · {totalConnections} connections · Click markers for details
      </div>
    </div>
  );
}

// ─── Main WorldMap Component ───────────────────────────────────────────────────

export default function WorldMap() {
  const { topics, loading, error, refetch } = useGeminiTopics();
  const { entries: archiveEntries } = useTodayArchive();
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelCountry, setPanelCountry] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [activeCategories, setActiveCategories] = useState(new Set());
  const [legendOpen, setLegendOpen] = useState(false);

  const { countryTopicMap: rawCountryTopicMap, connections: rawConnections } = buildMapData(topics || []);

  // Gather categories present in today's topics (for chips)
  const presentCategories = useMemo(() => [...new Set(
    (topics || []).map(t => (t.category || 'other').toLowerCase())
  )].sort((a, b) => CATEGORY_DISPLAY_ORDER.indexOf(a) - CATEGORY_DISPLAY_ORDER.indexOf(b)), [topics]);

  // Apply category filter — empty activeCategories means "show all"
  const { countryTopicMap, connections } = useMemo(() => {
    if (activeCategories.size === 0) {
      return { countryTopicMap: rawCountryTopicMap, connections: rawConnections };
    }
    // Filter connections
    const filteredConns = rawConnections.filter(conn =>
      conn.categories.some(c => activeCategories.has(c))
    );
    // Rebuild filtered country topic map
    const filteredCtm = {};
    Object.entries(rawCountryTopicMap).forEach(([code, country]) => {
      const filteredTopics = country.topics.filter(t =>
        activeCategories.has((t.category || 'other').toLowerCase())
      );
      if (filteredTopics.length > 0) {
        filteredCtm[code] = { ...country, topics: filteredTopics };
      }
    });
    return { countryTopicMap: filteredCtm, connections: filteredConns };
  }, [rawCountryTopicMap, rawConnections, activeCategories]);

  const toggleCategory = useCallback((cat) => {
    setActiveCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
    setSelectedTopic(null); // clear story flow when filter changes
  }, []);

  // Filter archive: exclude topic IDs already in current topics
  const filteredArchive = useMemo(() => {
    if (!archiveEntries.length) return [];
    const activeIds = new Set(
      (topics || []).map(t => String(t?.topicId || t?.topic_id || t?.id || '').trim()).filter(Boolean)
    );
    return archiveEntries.filter(e => !activeIds.has(String(e.topicId)));
  }, [archiveEntries, topics]);

  const { countryTopicMap: archiveCountryTopicMap, connections: archiveConnections } = buildMapData(filteredArchive);

  // Archive-only countries: in archive but NOT in current (to avoid marker overlap)
  const archiveOnlyCountryTopicMap = useMemo(() => {
    const result = {};
    for (const code of Object.keys(archiveCountryTopicMap)) {
      if (!countryTopicMap[code]) result[code] = archiveCountryTopicMap[code];
    }
    return result;
  }, [archiveCountryTopicMap, countryTopicMap]);

  const handleCountryClick = useCallback((code, topic) => {
    setPanelCountry(code);
    setPanelOpen(true);
    if (topic) {
      setSelectedTopic(topic);
    }
  }, []);

  const handleConnectionClick = useCallback((topic) => {
    setSelectedTopic(topic);
  }, []);

  const handleTopicSelect = useCallback((topic) => {
    setSelectedTopic(topic);
  }, []);

  const handleClosePanel = useCallback(() => {
    setPanelOpen(false);
    setSelectedTopic(null);
  }, []);

  // Escape key clears story flow
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { setSelectedTopic(null); setPanelOpen(false); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const totalCountries = Object.keys(countryTopicMap).length;
  const totalConnections = connections.length;

  const apiKey = typeof window !== 'undefined' && window.GOOGLE_MAPS_API_KEY
    ? window.GOOGLE_MAPS_API_KEY
    : '';

  const render = (status) => {
    if (status === 'FAILURE' || !apiKey) {
      return (
        <FallbackMapComponent
          countryTopicMap={countryTopicMap}
          connections={connections}
          archiveCountryTopicMap={archiveOnlyCountryTopicMap}
          archiveConnections={archiveConnections}
          onCountryClick={handleCountryClick}
        />
      );
    }
    if (status === 'LOADING') {
      return (
        <div className="map-loading-overlay">
          <div className="map-spinner" />
        </div>
      );
    }
    return (
      <MapComponent
        countryTopicMap={countryTopicMap}
        connections={connections}
        archiveCountryTopicMap={archiveOnlyCountryTopicMap}
        archiveConnections={archiveConnections}
        onCountryClick={handleCountryClick}
        onConnectionClick={handleConnectionClick}
        selectedTopic={selectedTopic}
      />
    );
  };

  if (loading) {
    return (
      <div style={{ width: '100%', height: 600, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#f5f5f5', borderRadius: 12 }}>
        <div style={{ textAlign: 'center' }}>
          <div className="map-spinner" style={{ margin: '0 auto 12px' }} />
          <p style={{ color: '#666', margin: 0 }}>Loading topics…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ width: '100%', height: 600, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#f5f5f5', borderRadius: 12 }}>
        <div style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🗺️</div>
          <h3 style={{ color: '#d32f2f', margin: '0 0 8px' }}>Map loading failed</h3>
          <p style={{ color: '#666', margin: '0 0 16px' }}>{error}</p>
          <button onClick={refetch} style={{ padding: '8px 16px', background: '#111',
            color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <div className="card" style={{ padding: '1rem' }}>
          <h2 style={{ margin: '0 0 0.5rem 0' }}>Today's Topics Map</h2>
          <p style={{ margin: '0 0 0.75rem 0', color: 'var(--text-muted)' }}>
            Lines connect countries sharing the same news topic. Click a country or line to explore.
          </p>
          {/* Category filter chips */}
          {presentCategories.length > 0 && (
            <div className="map-filter-bar">
              {activeCategories.size > 0 && (
                <button className="map-filter-chip map-filter-chip-reset" onClick={() => { setActiveCategories(new Set()); setSelectedTopic(null); }}>
                  ✕ All
                </button>
              )}
              {presentCategories.map(cat => {
                const isActive = activeCategories.has(cat);
                const color = getCategoryColor(cat);
                const count = (topics || []).filter(t => (t.category || 'other').toLowerCase() === cat).length;
                return (
                  <button
                    key={cat}
                    className={`map-filter-chip${isActive ? ' active' : ''}`}
                    style={isActive ? { backgroundColor: color, borderColor: color, color: '#fff' } : { borderColor: color, color: color }}
                    onClick={() => toggleCategory(cat)}
                  >
                    {cat} <span className="map-filter-chip-count">{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="map-shell">
        {/* Story flow banner */}
        {selectedTopic && (
          <div className="map-story-banner">
            <span>Related: {selectedTopic.title}</span>
            <button onClick={() => setSelectedTopic(null)}>✕ Clear</button>
          </div>
        )}

        {/* Legend — collapsible */}
        <div className={`map-overlay map-legend${legendOpen ? ' open' : ''}`}>
          <button className="map-legend-toggle" onClick={() => setLegendOpen(o => !o)}>
            <span className="map-legend-toggle-dots">
              {presentCategories.slice(0, 4).map(cat => (
                <span key={cat} className="legend-dot" style={{ backgroundColor: getCategoryColor(cat) }} />
              ))}
            </span>
            <span className="map-legend-toggle-label">Legend</span>
            <span className="map-legend-toggle-chevron">{legendOpen ? '▲' : '▼'}</span>
          </button>
          {legendOpen && (
            <div className="map-legend-body">
              {presentCategories.map(cat => (
                <div key={cat} className="map-legend-row">
                  <span className={`legend-dot ${cat}`}
                    style={{ backgroundColor: getCategoryColor(cat) }} />
                  <span className="legend-label" style={{ textTransform: 'capitalize' }}>{cat}</span>
                </div>
              ))}
              {filteredArchive.length > 0 && (
                <div className="map-legend-row map-legend-archive-row">
                  <span className="legend-dot" style={{ backgroundColor: '#94a3b8', opacity: 0.6 }} />
                  <span className="legend-label">
                    Earlier
                    <span className="legend-archive-dash" />
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="map-overlay map-stats">
          <div className="map-stats-row">Now: <strong>{(topics || []).length}</strong></div>
          {filteredArchive.length > 0 && (
            <div className="map-stats-row">Earlier: <strong>{filteredArchive.length}</strong></div>
          )}
          <div className="map-stats-row">Countries: <strong>{totalCountries + Object.keys(archiveOnlyCountryTopicMap).length}</strong></div>
          <div className="map-stats-row">Connections: <strong>{totalConnections}</strong></div>
        </div>

        {apiKey ? (
          <Wrapper apiKey={apiKey} render={render} />
        ) : (
          <FallbackMapComponent
            countryTopicMap={countryTopicMap}
            connections={connections}
            archiveCountryTopicMap={archiveOnlyCountryTopicMap}
            archiveConnections={archiveConnections}
            onCountryClick={handleCountryClick}
          />
        )}
      </div>

      <TodayArchiveSidebar entries={filteredArchive} />

      <MapSidePanel
        isOpen={panelOpen}
        onClose={handleClosePanel}
        country={panelCountry}
        topics={panelCountry ? (countryTopicMap[panelCountry]?.topics || []) : []}
        archiveTopics={panelCountry ? (archiveCountryTopicMap[panelCountry]?.topics || []) : []}
        countryTopicMap={countryTopicMap}
        archiveCountryTopicMap={archiveCountryTopicMap}
        selectedTopicId={selectedTopic ? (selectedTopic.topicId || selectedTopic.id) : null}
        onTopicSelect={handleTopicSelect}
      />
    </div>
  );
}
