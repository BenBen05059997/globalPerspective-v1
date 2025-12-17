// Geocoding utility with hybrid approach: AI + Complete Country List + Keywords + Heuristics
import { geocodeProxy } from '../services/restProxy.js';

// PRIORITY 1: All countries in the world (ISO 3166-1 + common variations)
const ALL_COUNTRIES = [
  // A
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 
  'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan',
  // B
  'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize',
  'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Bosnia', 'Botswana', 
  'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi',
  // C
  'Cambodia', 'Cameroon', 'Canada', 'Cape Verde', 'Central African Republic', 
  'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo', 'Costa Rica', 
  'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Czechia',
  // D
  'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic',
  // E
  'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 
  'Eswatini', 'Ethiopia',
  // F
  'Fiji', 'Finland', 'France',
  // G
  'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 
  'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana',
  // H
  'Haiti', 'Honduras', 'Hungary',
  // I
  'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy',
  // J
  'Jamaica', 'Japan', 'Jordan',
  // K
  'Kazakhstan', 'Kenya', 'Kiribati', 'Kosovo', 'Kuwait', 'Kyrgyzstan',
  // L
  'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 
  'Lithuania', 'Luxembourg',
  // M
  'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands',
  'Mauritania', 'Mauritius', 'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia',
  'Montenegro', 'Morocco', 'Mozambique', 'Myanmar', 'Burma',
  // N
  'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger',
  'Nigeria', 'North Korea', 'North Macedonia', 'Macedonia', 'Norway',
  // O
  'Oman',
  // P
  'Pakistan', 'Palau', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru',
  'Philippines', 'Poland', 'Portugal',
  // Q
  'Qatar',
  // R
  'Romania', 'Russia', 'Rwanda',
  // S
  'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines',
  'Samoa', 'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal',
  'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia',
  'Solomon Islands', 'Somalia', 'South Africa', 'South Korea', 'South Sudan',
  'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria',
  // T
  'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 'East Timor',
  'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu',
  // U
  'Uganda', 'Ukraine', 'United Arab Emirates', 'UAE', 'United Kingdom', 'UK', 
  'Britain', 'England', 'Scotland', 'Wales', 'Northern Ireland',
  'United States', 'USA', 'US', 'America', 'Uruguay', 'Uzbekistan',
  // V
  'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam',
  // Y
  'Yemen',
  // Z
  'Zambia', 'Zimbabwe'
];

// PRIORITY 2: Major cities and conflict zones (high-value locations for news)
const MAJOR_CITIES_AND_REGIONS = [
  // Major world cities
  'Tokyo', 'Delhi', 'Shanghai', 'Mumbai', 'Beijing', 'Dhaka', 'Karachi', 'Istanbul',
  'Manila', 'Lagos', 'Cairo', 'Mexico City', 'Sao Paulo', 'Moscow', 'Bangkok',
  'London', 'Paris', 'Berlin', 'Madrid', 'Rome', 'Amsterdam', 'Brussels', 'Vienna',
  'New York', 'Los Angeles', 'Chicago', 'Houston', 'Toronto', 'Vancouver',
  'Sydney', 'Melbourne', 'Seoul', 'Singapore', 'Hong Kong', 'Dubai', 'Riyadh',
  
  // Conflict/news-relevant cities
  'Kharkiv', 'Kiev', 'Kyiv', 'Mariupol', 'Odesa', 'Lviv',
  'Khartoum', 'Yangon', 'Damascus', 'Aleppo', 'Ankara', 'Yerevan', 'Baku',
  'Bamako', 'Kabul', 'Islamabad', 'Baghdad', 'Tehran', 'Tripoli', 'Benghazi',
  'Jerusalem', 'Tel Aviv', 'Ramallah', 'Rafah',
  
  // Important regions
  'Gaza', 'Gaza Strip', 'West Bank', 'Donbas', 'Crimea', 'Xinjiang', 'Tibet',
  'Darfur', 'Sahel', 'Kurdistan', 'Nagorno-Karabakh', 'Transnistria', 'Abkhazia',
  'Kashmir', 'Catalonia', 'Basque Country', 'Chechnya'
];

// Words to exclude from location detection (adjectives, verbs, common words)
const NON_LOCATION_WORDS = [
  'The', 'And', 'But', 'For', 'With', 'As', 'By', 'From', 'To', 'In', 'On', 'At',
  'Ceasefire', 'Negotiations', 'Humanitarian', 'Crisis', 'Conflict', 'War', 'Aid',
  'Talks', 'Agreement', 'Sanctions', 'Election', 'Elections', 'Government', 'Diplomacy',
  'Long', 'Economic', 'Strategy', 'Devastating', 'Major', 'Global', 'International',
  'Rising', 'Growing', 'Ongoing', 'Latest', 'Breaking', 'Recent', 'New', 'Historic',
  'Deadly', 'Massive', 'Escalating', 'Urgent', 'Critical', 'Emergency', 'Violence',
  'Peace', 'Security', 'Defense', 'Military', 'Political', 'Economic', 'Trade',
  'Climate', 'Energy', 'Food', 'Water', 'Health', 'Covid', 'Pandemic'
];

const MAX_LOCATION_ATTEMPTS = 3;

/**
 * HYBRID METHOD 1: Check AI-detected location (Gemini)
 */
function checkAILocation(article) {
  if (article?.primary_location && typeof article.primary_location === 'string') {
    console.log(`🤖 AI detected location: ${article.primary_location}`);
    return [article.primary_location];
  }
  return [];
}

/**
 * HYBRID METHOD 2: Match against complete country list
 */
function matchCountries(title) {
  if (!title) return [];
  const titleLower = title.toLowerCase();
  const matched = [];
  
  for (const country of ALL_COUNTRIES) {
    const countryLower = country.toLowerCase();
    // Use word boundary regex to avoid partial matches (e.g., "Chad" in "Tchad")
    const regex = new RegExp(`\\b${countryLower}\\b`, 'i');
    if (regex.test(titleLower)) {
      matched.push(country);
    }
  }
  
  if (matched.length > 0) {
    console.log(`🌍 Matched countries: ${matched.join(', ')}`);
  }
  return matched;
}

/**
 * HYBRID METHOD 3: Match major cities and regions
 */
function matchCitiesAndRegions(title) {
  if (!title) return [];
  const titleLower = title.toLowerCase();
  const matched = [];
  
  for (const location of MAJOR_CITIES_AND_REGIONS) {
    const locationLower = location.toLowerCase();
    const regex = new RegExp(`\\b${locationLower}\\b`, 'i');
    if (regex.test(titleLower)) {
      matched.push(location);
    }
  }
  
  if (matched.length > 0) {
    console.log(`🏙️ Matched cities/regions: ${matched.join(', ')}`);
  }
  return matched;
}

/**
 * HYBRID METHOD 4: Extract capitalized words (heuristic fallback)
 */
function extractCapitalizedLocations(title) {
  if (!title) return [];
  
  const words = title.split(/\s+/);
  const locations = [];
  
  for (const word of words) {
    const cleanWord = word.replace(/[^\w]/g, '');
    const isCapitalized = cleanWord.length > 2 && cleanWord[0] === cleanWord[0].toUpperCase();
    const endsLikeVerb = /(ing|ed|s)$/i.test(cleanWord);
    
    if (isCapitalized && cleanWord.length >= 4 && !endsLikeVerb) {
      const isBlocked = NON_LOCATION_WORDS.some(blocked => 
        blocked.toLowerCase() === cleanWord.toLowerCase()
      );
      
      if (!isBlocked && /^[A-Z][a-z]+(?:[-\s][A-Z][a-z]+)*$/.test(cleanWord)) {
        locations.push(cleanWord);
      }
    }
  }
  
  if (locations.length > 0) {
    console.log(`🔤 Extracted capitalized words: ${locations.join(', ')}`);
  }
  return locations;
}

/**
 * Extract potential location names using hybrid approach
 */
export function extractLocationsFromTitle(title, article = null) {
  if (!title) return [];

  const candidates = [];
  
  // Priority 1: AI detection (if article object provided)
  if (article) {
    candidates.push(...checkAILocation(article));
  }
  
  // Priority 2: Complete country list
  candidates.push(...matchCountries(title));
  
  // Priority 3: Major cities and regions
  candidates.push(...matchCitiesAndRegions(title));
  
  // Priority 4: Capitalized words (last resort)
  candidates.push(...extractCapitalizedLocations(title));
  
  // Deduplicate while preserving priority order
  const seen = new Set();
  const deduplicated = [];
  for (const loc of candidates) {
    const normalized = loc.toLowerCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      deduplicated.push(loc);
    }
  }
  
  console.log(`📍 Final candidate list: ${deduplicated.slice(0, MAX_LOCATION_ATTEMPTS).join(', ')}`);
  return deduplicated;
}

/**
 * Geocode a location name to get coordinates
 */
export async function geocodeLocation(locationName, countryCode) {
  try {
    const cached = getCachedGeocode(locationName, countryCode);
    if (cached) {
      return cached;
    }

    const key = getCacheKey(locationName, countryCode);
    const inFlight = getInFlight(key);
    if (inFlight) {
      return await inFlight;
    }

    const lookupPromise = (async () => {
      try {
        const address = (() => {
          if (!countryCode || typeof countryCode !== 'string') return locationName;
          const cc = countryCode.trim().toUpperCase();
          const invalid = new Set(['UN', 'EU', 'WW', 'GLOBAL', 'UNKNOWN']);
          return /^[A-Z]{2}$/.test(cc) && !invalid.has(cc)
            ? `${locationName}, ${cc}`
            : locationName;
        })();

        const payload = await geocodeProxy(address);
        if (!payload || payload.success === false) {
          const reason = payload?.error || payload?.reason || 'unknown error';
          console.warn(`Geocoding proxy failure for ${locationName}: ${reason}`);
          return null;
        }

        const data = payload.data || {};
        const latNum = Number(data.lat);
        const lngNum = Number(data.lng);
        if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
          console.warn('Geocoding proxy returned invalid coordinates:', data);
          return null;
        }

        const resultObj = {
          lat: latNum,
          lng: lngNum,
          country: typeof data.country === 'string' ? data.country.toUpperCase() : 'UNKNOWN',
          countryName: data.countryName || null,
          cityName: data.cityName || null,
          provinceName: data.provinceName || null,
          displayName: data.displayName || address,
          source: 'mapbox',
        };

        setCachedGeocode(locationName, countryCode, resultObj);
        return resultObj;
      } catch (err) {
        console.error(`Error calling geocoding proxy for ${locationName}:`, err);
        return null;
      } finally {
        clearInFlight(key);
      }
    })();

    setInFlight(key, lookupPromise);
    return await lookupPromise;
  } catch (error) {
    console.error(`Error geocoding ${locationName}:`, error);
    try { clearInFlight(getCacheKey(locationName, countryCode)); } catch (e) { void e; }
    return null;
  }
}

/**
 * Process an article to extract and geocode locations
 */
export async function geocodeArticle(article) {
  if (!article?.title) return null;

  console.log(`🌍 Geocoding article: ${article.title}`);

  const candidateSet = new Set();
  const addCandidate = (value) => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed) return;
    candidateSet.add(trimmed);
  };

  // Add metadata locations
  addCandidate(article.primary_location);
  addCandidate(article.location_context);

  if (Array.isArray(article.regions)) {
    article.regions.forEach(addCandidate);
  }

  if (Array.isArray(article.search_keywords)) {
    article.search_keywords
      .filter((kw) => typeof kw === 'string' && kw.split(/\s+/).length > 1)
      .forEach(addCandidate);
  }

  // Extract locations using hybrid approach
  const extractedLocations = extractLocationsFromTitle(article.title, article);
  extractedLocations.forEach(addCandidate);

  // Determine country code from metadata
  let knownCountryCode = null;
  try {
    let countries = [];
    if (article.detected_locations?.countries?.length > 0) {
      countries = article.detected_locations.countries;
    } else if (article.geographic_analysis?.primary_countries?.length > 0) {
      countries = article.geographic_analysis.primary_countries;
    } else if (article.geographic_analysis?.countries?.length > 0) {
      countries = article.geographic_analysis.countries;
    } else if (article.country) {
      countries = [article.country];
    }
    if (countries.length > 0) {
      const c = countries[0];
      if (typeof c === 'string') knownCountryCode = c.toUpperCase();
      else knownCountryCode = (c.code || c.country_code || '').toUpperCase() || null;
    }
  } catch {
    // ignore
  }

  if (knownCountryCode && !/^[A-Z]{2}$/.test(knownCountryCode)) {
    knownCountryCode = null;
  }

  // Special handling for Gaza and West Bank
  const lowerLocations = extractedLocations.map(l => l.toLowerCase());
  if (lowerLocations.includes('gaza')) {
    knownCountryCode = 'PS';
    addCandidate('Gaza Strip');
    addCandidate('Gaza, Palestine');
  }
  if (lowerLocations.includes('west bank')) {
    knownCountryCode = 'PS';
    addCandidate('West Bank, Palestine');
    addCandidate('West Bank');
  }

  let locations = Array.from(candidateSet);
  locations = locations.slice(0, MAX_LOCATION_ATTEMPTS);
  
  for (const location of locations) {
    const coords = await geocodeLocation(location, knownCountryCode);
    if (coords) {
      console.log(`✅ Successfully geocoded ${location}:`, coords);
      return coords;
    }
  }

  console.log(`❌ No coordinates found for article: ${article.title}`);
  return null;
}

export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Cache management (same as original)
const GEO_CACHE_KEY = 'geocode_cache_v1';
const GEO_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function readGeoCache() {
  try {
    const raw = localStorage.getItem(GEO_CACHE_KEY);
    return raw ? JSON.parse(raw) : { items: {}, timestamp: Date.now() };
  } catch {
    return { items: {}, timestamp: Date.now() };
  }
}

function writeGeoCache(cache) {
  try {
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

function getCacheKey(locationName, countryCode) {
  const cc = (countryCode || '').toUpperCase();
  return `${cc}:${String(locationName || '').toLowerCase()}`;
}

function getCachedGeocode(locationName, countryCode) {
  const cache = readGeoCache();
  const key = getCacheKey(locationName, countryCode);
  const record = cache.items[key];
  if (!record) return null;
  const isFresh = record.timestamp && (Date.now() - record.timestamp) < GEO_CACHE_TTL_MS;
  return isFresh ? record.value : null;
}

function setCachedGeocode(locationName, countryCode, value) {
  const cache = readGeoCache();
  const key = getCacheKey(locationName, countryCode);
  cache.items[key] = { value, timestamp: Date.now() };
  writeGeoCache(cache);
}

const GEO_INFLIGHT = {};

function getInFlight(key) {
  return GEO_INFLIGHT[key] || null;
}

function setInFlight(key, promise) {
  GEO_INFLIGHT[key] = promise;
}

function clearInFlight(key) {
  delete GEO_INFLIGHT[key];
}
