// Country name to ISO code mapping
// Used to convert Gemini's region names to country codes for mapping

export const COUNTRY_NAME_TO_CODE = {
    // North America
    'United States': 'US',
    'USA': 'US',
    'US': 'US',
    'America': 'US',
    'Canada': 'CA',
    'Mexico': 'MX',

    // South America
    'Venezuela': 'VE',
    'Brazil': 'BR',
    'Argentina': 'AR',
    'Chile': 'CL',
    'Colombia': 'CO',
    'Peru': 'PE',

    // Europe
    'United Kingdom': 'GB',
    'UK': 'GB',
    'Britain': 'GB',
    'France': 'FR',
    'Germany': 'DE',
    'Italy': 'IT',
    'Spain': 'ES',
    'Netherlands': 'NL',
    'Belgium': 'BE',
    'Switzerland': 'CH',
    'Austria': 'AT',
    'Sweden': 'SE',
    'Norway': 'NO',
    'Denmark': 'DK',
    'Finland': 'FI',
    'Poland': 'PL',
    'Ukraine': 'UA',
    'Russia': 'RU',
    'Greece': 'GR',
    'Portugal': 'PT',
    'Ireland': 'IE',

    // Asia
    'China': 'CN',
    'Japan': 'JP',
    'South Korea': 'KR',
    'Korea': 'KR',
    'India': 'IN',
    'Singapore': 'SG',
    'Thailand': 'TH',
    'Vietnam': 'VN',
    'Philippines': 'PH',
    'Indonesia': 'ID',
    'Malaysia': 'MY',
    'Taiwan': 'TW',
    'Pakistan': 'PK',
    'Bangladesh': 'BD',
    'Myanmar': 'MM',
    'Sri Lanka': 'LK',

    // Middle East
    'Israel': 'IL',
    'Palestine': 'PS',
    'Saudi Arabia': 'SA',
    'UAE': 'AE',
    'Turkey': 'TR',
    'Iran': 'IR',
    'Iraq': 'IQ',
    'Syria': 'SY',
    'Lebanon': 'LB',
    'Jordan': 'JO',

    // Africa
    'South Africa': 'ZA',
    'Egypt': 'EG',
    'Nigeria': 'NG',
    'Kenya': 'KE',
    'Ethiopia': 'ET',
    'Sudan': 'SD',
    'Libya': 'LY',

    // Oceania
    'Australia': 'AU',
    'New Zealand': 'NZ',

    // Special cases
    'EU': 'EU',
    'European Union': 'EU',
    'Global': 'GLOBAL',
    'International': 'GLOBAL',
    'Worldwide': 'GLOBAL',
};

// News source domain to country mapping
// Used to infer geographic focus from article sources
export const SOURCE_TO_COUNTRY = {
    // US Sources
    'nytimes.com': 'US',
    'washingtonpost.com': 'US',
    'cnn.com': 'US',
    'foxnews.com': 'US',
    'wsj.com': 'US',
    'usatoday.com': 'US',
    'nbcnews.com': 'US',
    'abcnews.go.com': 'US',
    'cbsnews.com': 'US',
    'politico.com': 'US',
    'bloomberg.com': 'US',

    // UK Sources
    'bbc.com': 'GB',
    'bbc.co.uk': 'GB',
    'theguardian.com': 'GB',
    'telegraph.co.uk': 'GB',
    'independent.co.uk': 'GB',
    'dailymail.co.uk': 'GB',
    'thetimes.co.uk': 'GB',
    'ft.com': 'GB',

    // International/Global
    'reuters.com': 'GLOBAL',
    'apnews.com': 'GLOBAL',
    'aljazeera.com': 'GLOBAL',
    'afp.com': 'GLOBAL',

    // European
    'france24.com': 'FR',
    'lemonde.fr': 'FR',
    'dw.com': 'DE',
    'spiegel.de': 'DE',
    'elpais.com': 'ES',
    'corriere.it': 'IT',

    // Asian
    'scmp.com': 'CN',
    'chinadaily.com.cn': 'CN',
    'japantimes.co.jp': 'JP',
    'asahi.com': 'JP',
    'thehindu.com': 'IN',
    'timesofindia.com': 'IN',
    'straitstimes.com': 'SG',

    // Middle Eastern
    'haaretz.com': 'IL',
    'timesofisrael.com': 'IL',
    'arabnews.com': 'SA',

    // Russian
    'rt.com': 'RU',
    'tass.com': 'RU',

    // Australian
    'abc.net.au': 'AU',
    'smh.com.au': 'AU',
};

/**
 * Convert a region name to ISO country code
 * @param {string} regionName - Region or country name
 * @returns {string|null} - ISO country code or null
 */
export function regionToCountryCode(regionName) {
    if (!regionName || typeof regionName !== 'string') return null;

    const normalized = regionName.trim();

    // Direct match
    if (COUNTRY_NAME_TO_CODE[normalized]) {
        return COUNTRY_NAME_TO_CODE[normalized];
    }

    // Case-insensitive match
    const lowerName = normalized.toLowerCase();
    for (const [name, code] of Object.entries(COUNTRY_NAME_TO_CODE)) {
        if (name.toLowerCase() === lowerName) {
            return code;
        }
    }

    return null;
}

/**
 * Extract country code from article source URL
 * @param {string} url - Article URL
 * @returns {string|null} - ISO country code or null
 */
export function sourceToCountryCode(url) {
    if (!url || typeof url !== 'string') return null;

    try {
        const hostname = new URL(url).hostname.replace(/^www\./, '');
        return SOURCE_TO_COUNTRY[hostname] || null;
    } catch {
        return null;
    }
}

/**
 * Get all country codes from a topic's regions and sources
 * @param {Object} topic - Topic object with regions and sources
 * @returns {string[]} - Array of unique country codes
 */
export function getTopicCountryCodes(topic) {
    const codes = new Set();

    // From regions array
    if (Array.isArray(topic.regions)) {
        topic.regions.forEach(region => {
            const code = regionToCountryCode(region);
            if (code && code !== 'GLOBAL') {
                codes.add(code);
            }
        });
    }

    // From source URLs
    if (Array.isArray(topic.sources)) {
        topic.sources.forEach(source => {
            const code = sourceToCountryCode(source.url);
            if (code && code !== 'GLOBAL') {
                codes.add(code);
            }
        });
    }

    return Array.from(codes);
}
