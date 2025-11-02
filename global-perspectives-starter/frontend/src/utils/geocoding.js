// Geocoding utility using OpenStreetMap Nominatim API
// This extracts location names from article titles and converts them to coordinates

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search';

// Common location keywords that might appear in news articles
const LOCATION_KEYWORDS = [
  // Countries
  'Ukraine', 'Russia', 'China', 'Taiwan', 'Gaza', 'Palestine', 'Israel', 
  'Sudan', 'Myanmar', 'Syria', 'Turkey', 'Armenia', 'Azerbaijan', 'Mali',
  'Afghanistan', 'Pakistan', 'Bangladesh', 'Iraq', 'Iran', 'Libya',
  'Yemen', 'Somalia', 'Ethiopia', 'Nigeria', 'Congo', 'Chad',
  
  // Cities
  'Kharkiv', 'Kiev', 'Kyiv', 'Moscow', 'Beijing', 'Shanghai', 'Taipei',
  'Khartoum', 'Yangon', 'Damascus', 'Ankara', 'Istanbul', 'Yerevan', 'Baku',
  'Bamako', 'Kabul', 'Islamabad', 'Dhaka', 'Baghdad', 'Tehran', 'Tripoli',
  
  // Regions
  'Donbas', 'Crimea', 'Xinjiang', 'Tibet', 'West Bank', 'Darfur', 'Sahel',
  'Kurdistan', 'Nagorno-Karabakh'
];

// Common capitalized non-location words to avoid in extraction
const NON_LOCATION_WORDS = [
  'The', 'And', 'But', 'For', 'With', 'As', 'By', 'From', 'To', 'In', 'On', 'At',
  'Ceasefire', 'Negotiations', 'Humanitarian', 'Crisis', 'Conflict', 'War', 'Aid',
  'Talks', 'Agreement', 'Sanctions', 'Election', 'Elections', 'Government', 'Diplomacy'
];

// Maximum number of location attempts per article (prioritize known keywords)
const MAX_LOCATION_ATTEMPTS = 3;

/**
 * Extract potential location names from article title
 * @param {string} title - Article title
 * @returns {string[]} - Array of potential location names
 */
export function extractLocationsFromTitle(title) {
  if (!title) return [];
  
  const locations = [];
  const titleLower = title.toLowerCase();
  
  // Check for known location keywords
  LOCATION_KEYWORDS.forEach(location => {
    if (titleLower.includes(location.toLowerCase())) {
      locations.push(location);
    }
  });
  
  // Extract capitalized words that might be locations (stricter heuristic)
  const words = title.split(/\s+/);
  words.forEach(word => {
    // Remove punctuation and check if it's capitalized
    const cleanWord = word.replace(/[^\w]/g, '');
    const isCapitalized = cleanWord.length > 2 && cleanWord[0] === cleanWord[0].toUpperCase();
    const endsLikeVerb = /(ing|ed|s)$/i.test(cleanWord);
    if (isCapitalized && cleanWord.length >= 4 && !endsLikeVerb) {
      const alreadyKnown = locations.includes(cleanWord);
      const isKeyword = LOCATION_KEYWORDS.some(k => k.toLowerCase() === cleanWord.toLowerCase());
      const isBlocked = NON_LOCATION_WORDS.includes(cleanWord);
      if (!alreadyKnown && !isBlocked) {
        // Only add capitalized words if they are known keywords or look like proper nouns
        if (isKeyword || /^[A-Z][a-z]+(?:[-\s][A-Z][a-z]+)*$/.test(cleanWord)) {
          locations.push(cleanWord);
        }
      }
    }
  });
  
  // Prioritize known keywords first
  const keywordSet = new Set(LOCATION_KEYWORDS.map(k => k.toLowerCase()));
  const deduped = [...new Set(locations)];
  deduped.sort((a, b) => {
    const ak = keywordSet.has(a.toLowerCase()) ? 0 : 1;
    const bk = keywordSet.has(b.toLowerCase()) ? 0 : 1;
    return ak - bk;
  });
  return deduped;
}

/**
 * Geocode a location name to get coordinates
 * @param {string} locationName - Name of the location
 * @returns {Promise<{lat: number, lng: number, country: string} | null>}
 */
export async function geocodeLocation(locationName, countryCode) {
  try {
    // Check cache first
    const cached = getCachedGeocode(locationName, countryCode);
    if (cached) {
      return cached;
    }

    // Deduplicate in-flight requests by cache key
    const key = getCacheKey(locationName, countryCode);
    const inFlight = getInFlight(key);
    if (inFlight) {
      return await inFlight;
    }

    const params = new URLSearchParams({
      q: locationName,
      format: 'json',
      limit: '1',
      addressdetails: '1'
    });

    // Constrain by country when available (expects lower-case ISO alpha2)
    if (countryCode && typeof countryCode === 'string') {
      const cc = countryCode.trim().toUpperCase();
      const invalid = new Set(['UN', 'EU', 'WW', 'GLOBAL', 'UNKNOWN']);
      if (/^[A-Z]{2}$/.test(cc) && !invalid.has(cc)) {
        params.set('countrycodes', cc.toLowerCase());
      }
    }

    const fetchPromise = fetch(`${NOMINATIM_BASE_URL}?${params.toString()}`);
    setInFlight(key, fetchPromise);
    const response = await fetchPromise;
    
    if (!response.ok) {
      console.warn(`Geocoding failed for ${locationName}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      const result = data[0];
      const addr = result.address || {};
      const cityName = addr.city || addr.town || addr.village || addr.hamlet || addr.suburb || addr.municipality || null;
      const provinceName = addr.state || addr.region || addr.province || addr.county || null;
      const countryIso = (addr.country_code || '').toUpperCase() || 'UNKNOWN';
      const countryName = addr.country || null;

      const latNum = parseFloat(result.lat);
      const lngNum = parseFloat(result.lon);
      if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
        console.warn(`Geocoding returned invalid coordinates for ${locationName}:`, result.lat, result.lon);
        clearInFlight(key);
        return null;
      }

      const resultObj = {
        lat: latNum,
        lng: lngNum,
        country: countryIso,
        countryName,
        cityName,
        provinceName,
        displayName: result.display_name
      };

      // Cache successful geocode
      setCachedGeocode(locationName, countryCode, resultObj);
      clearInFlight(key);
      return resultObj;
    }
    clearInFlight(key);
    return null;
  } catch (error) {
    console.error(`Error geocoding ${locationName}:`, error);
    try { clearInFlight(getCacheKey(locationName, countryCode)); } catch (e) { void e; }
    return null;
  }
}

/**
 * Process an article to extract and geocode locations
 * @param {Object} article - Article object with title and content
 * @returns {Promise<{lat: number, lng: number, country: string} | null>}
 */
export async function geocodeArticle(article) {
  if (!article?.title) return null;
  
  console.log(`🌍 Geocoding article: ${article.title}`);

  // NEW: Check for primary_location from Gemini first
  if (article.primary_location) {
    console.log(`🎯 Using Gemini primary_location: ${article.primary_location}`);
    const coords = await geocodeLocation(article.primary_location, null);
    if (coords) {
      console.log(`✅ Successfully geocoded primary_location: ${article.primary_location} -> ${coords.country}`);
      return coords;
    }
    console.log(`⚠️ Failed to geocode primary_location: ${article.primary_location}, falling back to title extraction`);
  }

  // Extract potential locations from title as fallback
  let locations = extractLocationsFromTitle(article.title);
  console.log(`📍 Extracted locations from title (fallback): ${locations.join(', ')}`);

  // Try to determine a known country code from article metadata to constrain geocoding
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

  // Normalize invalid/non-ISO country codes to null so filters can be applied
  if (knownCountryCode && !/^[A-Z]{2}$/.test(knownCountryCode)) {
    knownCountryCode = null;
  }

  // Disambiguation: Gaza is ambiguous (Mozambique province vs Gaza Strip).
  // If Gaza is mentioned, force Palestine (PS) and prioritize "Gaza Strip" query.
  const lowerLocations = locations.map(l => l.toLowerCase());
  if (lowerLocations.includes('gaza')) {
    knownCountryCode = 'PS';
    // Prioritize accurate variants
    const withoutGaza = locations.filter(l => l.toLowerCase() !== 'gaza');
    locations = ['Gaza Strip', 'Gaza, Palestine', ...withoutGaza, 'Gaza'];
  }
  // Additional regional hint: West Bank belongs to Palestine
  if (lowerLocations.includes('west bank')) {
    knownCountryCode = 'PS';
    const withoutWB = locations.filter(l => l.toLowerCase() !== 'west bank');
    locations = ['West Bank, Palestine', ...withoutWB, 'West Bank'];
  }
  
  // Try to geocode each location until we find one
  // Limit attempts to reduce latency
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

/**
 * Add a small delay between geocoding requests to be respectful to the API
 * @param {number} ms - Milliseconds to wait
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
// Simple localStorage cache for geocoding results
const GEO_CACHE_KEY = 'geocode_cache_v1';
const GEO_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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
    // ignore write errors
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

// In-flight request dedupe map
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