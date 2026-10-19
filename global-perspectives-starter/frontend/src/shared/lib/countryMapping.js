// Region grouping for topics: country names -> ISO-2 (via the one country resolver, shared/lib/countries.js)
// -> continent. Country identity (names, aliases, sub-national places) is NOT kept here.
import { COUNTRIES, parentCountry } from '@/shared/lib/countries.js';

// Broad region names to the specific countries they include
export const BROAD_REGION_COUNTRIES = {
    'EU': ['Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden'],
    'European Union': ['Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden'],
    'Europe': ['United Kingdom', 'France', 'Germany', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Switzerland', 'Austria', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Poland', 'Czech Republic', 'Greece', 'Portugal', 'Ireland', 'Romania', 'Hungary', 'Ukraine', 'Serbia', 'Croatia', 'Bulgaria', 'Slovakia', 'Slovenia', 'Lithuania', 'Latvia', 'Estonia'],
    'Middle East': ['Israel', 'Palestine', 'Iran', 'Iraq', 'Saudi Arabia', 'UAE', 'Turkey', 'Syria', 'Lebanon', 'Jordan', 'Yemen', 'Oman', 'Qatar', 'Kuwait', 'Bahrain'],
    'Southeast Asia': ['Thailand', 'Vietnam', 'Philippines', 'Indonesia', 'Malaysia', 'Singapore', 'Myanmar', 'Cambodia', 'Laos', 'Brunei', 'East Timor'],
    'East Asia': ['China', 'Japan', 'South Korea', 'North Korea', 'Taiwan', 'Mongolia'],
    'South Asia': ['India', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal', 'Afghanistan'],
    'Central Asia': ['Kazakhstan', 'Uzbekistan', 'Turkmenistan', 'Kyrgyzstan', 'Tajikistan'],
    'Africa': ['Nigeria', 'South Africa', 'Kenya', 'Egypt', 'Ethiopia', 'Ghana', 'Tanzania', 'Democratic Republic of the Congo', 'Sudan', 'Somalia', 'Libya', 'Tunisia', 'Morocco', 'Algeria', 'Uganda', 'Mozambique', 'Angola', 'Cameroon', 'Mali', 'Niger', 'Chad', 'Senegal', 'Rwanda', 'Zimbabwe'],
    'North Africa': ['Egypt', 'Libya', 'Tunisia', 'Morocco', 'Algeria'],
    'West Africa': ['Nigeria', 'Ghana', 'Senegal', 'Mali', 'Niger', 'Burkina Faso', 'Sierra Leone', 'Liberia'],
    'Latin America': ['Brazil', 'Mexico', 'Argentina', 'Colombia', 'Chile', 'Peru', 'Venezuela', 'Ecuador', 'Bolivia', 'Paraguay', 'Uruguay'],
    'Central America': ['Guatemala', 'Honduras', 'El Salvador', 'Nicaragua', 'Costa Rica', 'Panama', 'Belize'],
    'Caribbean': ['Cuba', 'Haiti', 'Dominican Republic', 'Jamaica', 'Trinidad and Tobago', 'Bahamas'],
    'Pacific': ['Australia', 'New Zealand', 'Fiji', 'Papua New Guinea'],
    'NATO': ['United States', 'United Kingdom', 'France', 'Germany', 'Italy', 'Canada', 'Turkey', 'Spain', 'Poland', 'Netherlands', 'Belgium', 'Norway', 'Denmark', 'Greece', 'Portugal', 'Czech Republic', 'Hungary', 'Romania', 'Bulgaria', 'Croatia', 'Slovakia', 'Slovenia', 'Lithuania', 'Latvia', 'Estonia', 'Finland', 'Sweden'],
    'BRICS': ['Brazil', 'Russia', 'India', 'China', 'South Africa', 'Egypt', 'Ethiopia', 'Iran', 'Saudi Arabia', 'UAE'],
    'G7': ['United States', 'United Kingdom', 'France', 'Germany', 'Italy', 'Canada', 'Japan'],
};

// Pre-computed reverse index: canonical country name → list of broad regions it belongs to. Both sides
// go through the resolver, so "United Arab Emirates" and "UAE" (or "Czech Republic" / "Czechia") match.
const canon = (name) => parentCountry(name)?.name || name;
const _COUNTRY_TO_BROAD_REGIONS = {};
for (const [region, countries] of Object.entries(BROAD_REGION_COUNTRIES)) {
    for (const country of countries) {
        (_COUNTRY_TO_BROAD_REGIONS[canon(country)] ||= []).push(region);
    }
}

export function getBroadRegionsForCountry(countryName) {
    return _COUNTRY_TO_BROAD_REGIONS[canon(countryName)] || [];
}

// ISO country code to geographic region mapping
// Used to categorize news topics by region
export const ISO_CODE_TO_REGION = {
    // Asia (50 countries)
    'AF': 'Asia',
    'AM': 'Asia',
    'AZ': 'Asia',
    'BD': 'Asia',
    'BN': 'Asia',
    'BT': 'Asia',
    'CN': 'Asia',
    'GE': 'Asia',
    'ID': 'Asia',
    'IN': 'Asia',
    'JP': 'Asia',
    'KG': 'Asia',
    'KH': 'Asia',
    'KP': 'Asia',
    'KR': 'Asia',
    'KZ': 'Asia',
    'LA': 'Asia',
    'LK': 'Asia',
    'MM': 'Asia',
    'MN': 'Asia',
    'MV': 'Asia',
    'MY': 'Asia',
    'NP': 'Asia',
    'PH': 'Asia',
    'PK': 'Asia',
    'SG': 'Asia',
    'TH': 'Asia',
    'TJ': 'Asia',
    'TL': 'Asia',
    'TM': 'Asia',
    'TW': 'Asia',
    'UZ': 'Asia',
    'VN': 'Asia',

    // Europe (46 countries - including Russia)
    'AL': 'Europe',
    'AD': 'Europe',
    'AT': 'Europe',
    'BA': 'Europe',
    'BE': 'Europe',
    'BG': 'Europe',
    'BY': 'Europe',
    'CH': 'Europe',
    'CY': 'Europe',
    'CZ': 'Europe',
    'DE': 'Europe',
    'DK': 'Europe',
    'EE': 'Europe',
    'ES': 'Europe',
    'FI': 'Europe',
    'FR': 'Europe',
    'GB': 'Europe',
    'GR': 'Europe',
    'HR': 'Europe',
    'HU': 'Europe',
    'IE': 'Europe',
    'IS': 'Europe',
    'IT': 'Europe',
    'LI': 'Europe',
    'LT': 'Europe',
    'LU': 'Europe',
    'LV': 'Europe',
    'MC': 'Europe',
    'MD': 'Europe',
    'ME': 'Europe',
    'MK': 'Europe',
    'MT': 'Europe',
    'NL': 'Europe',
    'NO': 'Europe',
    'PL': 'Europe',
    'PT': 'Europe',
    'RO': 'Europe',
    'RS': 'Europe',
    'RU': 'Europe',
    'SE': 'Europe',
    'SI': 'Europe',
    'SK': 'Europe',
    'SM': 'Europe',
    'UA': 'Europe',
    'VA': 'Europe',
    'XK': 'Europe',

    // Middle East (15 countries - including Turkey)
    'AE': 'Middle East',
    'BH': 'Middle East',
    'IL': 'Middle East',
    'IQ': 'Middle East',
    'IR': 'Middle East',
    'JO': 'Middle East',
    'KW': 'Middle East',
    'LB': 'Middle East',
    'OM': 'Middle East',
    'PS': 'Middle East',
    'QA': 'Middle East',
    'SA': 'Middle East',
    'SY': 'Middle East',
    'TR': 'Middle East',
    'YE': 'Middle East',

    // Africa (54 countries - including Egypt)
    'AO': 'Africa',
    'BF': 'Africa',
    'BI': 'Africa',
    'BJ': 'Africa',
    'BW': 'Africa',
    'CD': 'Africa',
    'CF': 'Africa',
    'CG': 'Africa',
    'CI': 'Africa',
    'CM': 'Africa',
    'CV': 'Africa',
    'DJ': 'Africa',
    'DZ': 'Africa',
    'EG': 'Africa',
    'ER': 'Africa',
    'ET': 'Africa',
    'GA': 'Africa',
    'GH': 'Africa',
    'GM': 'Africa',
    'GN': 'Africa',
    'GQ': 'Africa',
    'GW': 'Africa',
    'KE': 'Africa',
    'KM': 'Africa',
    'LR': 'Africa',
    'LS': 'Africa',
    'LY': 'Africa',
    'MA': 'Africa',
    'MG': 'Africa',
    'ML': 'Africa',
    'MR': 'Africa',
    'MU': 'Africa',
    'MW': 'Africa',
    'MZ': 'Africa',
    'NA': 'Africa',
    'NE': 'Africa',
    'NG': 'Africa',
    'RW': 'Africa',
    'SC': 'Africa',
    'SD': 'Africa',
    'SL': 'Africa',
    'SN': 'Africa',
    'SO': 'Africa',
    'SS': 'Africa',
    'ST': 'Africa',
    'SZ': 'Africa',
    'TD': 'Africa',
    'TG': 'Africa',
    'TN': 'Africa',
    'TZ': 'Africa',
    'UG': 'Africa',
    'ZA': 'Africa',
    'ZM': 'Africa',
    'ZW': 'Africa',

    // North America (23 countries - including Caribbean)
    'AG': 'North America',
    'BB': 'North America',
    'BS': 'North America',
    'BZ': 'North America',
    'CA': 'North America',
    'CR': 'North America',
    'CU': 'North America',
    'DM': 'North America',
    'DO': 'North America',
    'GD': 'North America',
    'GT': 'North America',
    'HN': 'North America',
    'HT': 'North America',
    'JM': 'North America',
    'KN': 'North America',
    'LC': 'North America',
    'MX': 'North America',
    'NI': 'North America',
    'PA': 'North America',
    'SV': 'North America',
    'TT': 'North America',
    'US': 'North America',
    'VC': 'North America',

    // South America (12 countries)
    'AR': 'South America',
    'BO': 'South America',
    'BR': 'South America',
    'CL': 'South America',
    'CO': 'South America',
    'EC': 'South America',
    'GY': 'South America',
    'PE': 'South America',
    'PY': 'South America',
    'SR': 'South America',
    'UY': 'South America',
    'VE': 'South America',

    // Oceania (14 countries)
    'AU': 'Oceania',
    'FJ': 'Oceania',
    'FM': 'Oceania',
    'KI': 'Oceania',
    'MH': 'Oceania',
    'NR': 'Oceania',
    'NZ': 'Oceania',
    'PG': 'Oceania',
    'PW': 'Oceania',
    'SB': 'Oceania',
    'TO': 'Oceania',
    'TV': 'Oceania',
    'VU': 'Oceania',
    'WS': 'Oceania',

    // Special
    'EU': 'Europe',
};

// Blocs are not countries; the EU keeps its code so an EU-only story still groups under Europe.
const BLOC_CODES = { eu: 'EU', 'european union': 'EU' };

/**
 * Convert a region name to ISO-2 country code ("China's" -> "CN", "Scotland" -> "GB")
 * @param {string} regionName - Region or country name
 * @returns {string|null} - ISO country code or null
 */
export function regionToCountryCode(regionName) {
    if (!regionName || typeof regionName !== 'string') return null;
    const name = regionName.trim().replace(/['\u2019]s$/, '');
    const country = parentCountry(name);
    if (country) return COUNTRIES[country.iso3].iso2;
    return BLOC_CODES[name.toLowerCase()] || null;
}

/**
 * Get all country codes from a topic's regions and sources
 * @param {Object} topic - Topic object with regions and sources
 * @returns {string[]} - Array of unique country codes
 */
export function getTopicCountryCodes(topic) {
    const codes = new Set();

    // From regions array only - trust Gemini's country extraction
    // Note: Source URL inference removed to prevent mapping news to where it's REPORTED
    // instead of where it HAPPENED (e.g., Ukraine news from BBC was mapping to GB)
    if (Array.isArray(topic.regions)) {
        topic.regions.forEach(region => {
            const code = regionToCountryCode(region);
            if (code) codes.add(code);
        });
    }

    return Array.from(codes);
}

/**
 * Get geographic region from ISO country code
 * @param {string} code - ISO country code
 * @returns {string|null} - Region name or null
 */
export function getRegionFromCountryCode(code) {
    if (!code || typeof code !== 'string') return null;
    const upperCode = code.toUpperCase();
    return ISO_CODE_TO_REGION[upperCode] || null;
}

/**
 * Get the primary geographic region for a topic
 * @param {Object} topic - Topic object with regions and sources
 * @returns {string} - Region name ('Asia', 'Europe', etc.) or 'World'
 */
export function getTopicRegion(topic) {
    if (!topic) return 'World';

    // Get all country codes for this topic
    const countryCodes = getTopicCountryCodes(topic);

    // No country codes found
    if (countryCodes.length === 0) return 'World';

    // Map country codes to regions
    const regions = countryCodes
        .map(code => getRegionFromCountryCode(code))
        .filter(region => region && region !== 'World');

    // No valid regions found
    if (regions.length === 0) return 'World';

    // Get unique regions
    const uniqueRegions = [...new Set(regions)];

    // Single region - return it
    if (uniqueRegions.length === 1) {
        return uniqueRegions[0];
    }

    // Multiple regions - return 'World'
    return 'World';
}

/**
 * Categorize an array of topics by geographic region
 * @param {Array} topics - Array of topic objects
 * @returns {Object} - Object with region names as keys and arrays of topics as values
 */
export function categorizeTopicsByRegion(topics) {
    const regions = {
        'Asia': [],
        'Africa': [],
        'North America': [],
        'Europe': [],
        'Middle East': [],
        'South America': [],
        'Oceania': [],
        'World': []
    };

    if (!Array.isArray(topics)) return regions;

    topics.forEach(topic => {
        const region = getTopicRegion(topic);
        if (regions[region]) {
            regions[region].push(topic);
        } else {
            // Fallback to World if region not recognized
            regions['World'].push(topic);
        }
    });

    return regions;
}
