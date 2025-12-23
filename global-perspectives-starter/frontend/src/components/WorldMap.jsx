import { useState, useEffect, useRef } from 'react';
import { Wrapper } from '@googlemaps/react-wrapper';
import { useGeminiTopics } from '../hooks/useGeminiTopics';
import { geocodeArticle, delay } from '../utils/geocoding';
import { getTopicCountryCodes } from '../utils/countryMapping';

// Hardcoded country coordinates for mapping
// Complete country coordinates for all 195 countries
const COUNTRY_COORDINATES = {
  // A
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

  // B
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

  // C
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
  'CD': { lat: -4.0383, lng: 21.7587, name: 'Democratic Republic of the Congo' },
  'CR': { lat: 9.7489, lng: -83.7534, name: 'Costa Rica' },
  'HR': { lat: 45.1000, lng: 15.2000, name: 'Croatia' },
  'CU': { lat: 21.5218, lng: -77.7812, name: 'Cuba' },
  'CY': { lat: 35.1264, lng: 33.4299, name: 'Cyprus' },
  'CZ': { lat: 49.8175, lng: 15.4730, name: 'Czech Republic' },

  // D
  'DK': { lat: 56.2639, lng: 9.5018, name: 'Denmark' },
  'DJ': { lat: 11.8251, lng: 42.5903, name: 'Djibouti' },
  'DM': { lat: 15.4150, lng: -61.3710, name: 'Dominica' },
  'DO': { lat: 18.7357, lng: -70.1627, name: 'Dominican Republic' },

  // E
  'EC': { lat: -1.8312, lng: -78.1834, name: 'Ecuador' },
  'EG': { lat: 26.8206, lng: 30.8025, name: 'Egypt' },
  'SV': { lat: 13.7942, lng: -88.8965, name: 'El Salvador' },
  'GQ': { lat: 1.6508, lng: 10.2679, name: 'Equatorial Guinea' },
  'ER': { lat: 15.1794, lng: 39.7823, name: 'Eritrea' },
  'EE': { lat: 58.5953, lng: 25.0136, name: 'Estonia' },
  'SZ': { lat: -26.5225, lng: 31.4659, name: 'Eswatini' },
  'ET': { lat: 9.1450, lng: 40.4897, name: 'Ethiopia' },

  // F
  'FJ': { lat: -17.7134, lng: 178.0650, name: 'Fiji' },
  'FI': { lat: 61.9241, lng: 25.7482, name: 'Finland' },
  'FR': { lat: 46.6034, lng: 1.8883, name: 'France' },

  // G
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

  // H
  'HT': { lat: 18.9712, lng: -72.2852, name: 'Haiti' },
  'HN': { lat: 15.2000, lng: -86.2419, name: 'Honduras' },
  'HU': { lat: 47.1625, lng: 19.5033, name: 'Hungary' },

  // I
  'IS': { lat: 64.9631, lng: -19.0208, name: 'Iceland' },
  'IN': { lat: 20.5937, lng: 78.9629, name: 'India' },
  'ID': { lat: -0.7893, lng: 113.9213, name: 'Indonesia' },
  'IR': { lat: 32.4279, lng: 53.6880, name: 'Iran' },
  'IQ': { lat: 33.2232, lng: 43.6793, name: 'Iraq' },
  'IE': { lat: 53.4129, lng: -8.2439, name: 'Ireland' },
  'IL': { lat: 31.0461, lng: 34.8516, name: 'Israel' },
  'IT': { lat: 41.8719, lng: 12.5674, name: 'Italy' },

  // J
  'JM': { lat: 18.1096, lng: -77.2975, name: 'Jamaica' },
  'JP': { lat: 36.2048, lng: 138.2529, name: 'Japan' },
  'JO': { lat: 30.5852, lng: 36.2384, name: 'Jordan' },

  // K
  'KZ': { lat: 48.0196, lng: 66.9237, name: 'Kazakhstan' },
  'KE': { lat: -0.0236, lng: 37.9062, name: 'Kenya' },
  'KI': { lat: -3.3704, lng: -168.7340, name: 'Kiribati' },
  'XK': { lat: 42.6026, lng: 20.9030, name: 'Kosovo' },
  'KW': { lat: 29.3117, lng: 47.4818, name: 'Kuwait' },
  'KG': { lat: 41.2044, lng: 74.7661, name: 'Kyrgyzstan' },

  // L
  'LA': { lat: 19.8563, lng: 102.4955, name: 'Laos' },
  'LV': { lat: 56.8796, lng: 24.6032, name: 'Latvia' },
  'LB': { lat: 33.8547, lng: 35.8623, name: 'Lebanon' },
  'LS': { lat: -29.6100, lng: 28.2336, name: 'Lesotho' },
  'LR': { lat: 6.4281, lng: -9.4295, name: 'Liberia' },
  'LY': { lat: 26.3351, lng: 17.2283, name: 'Libya' },
  'LI': { lat: 47.1660, lng: 9.5554, name: 'Liechtenstein' },
  'LT': { lat: 55.1694, lng: 23.8813, name: 'Lithuania' },
  'LU': { lat: 49.8153, lng: 6.1296, name: 'Luxembourg' },

  // M
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

  // N
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

  // O
  'OM': { lat: 21.4735, lng: 55.9754, name: 'Oman' },

  // P
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

  // Q
  'QA': { lat: 25.3548, lng: 51.1839, name: 'Qatar' },

  // R
  'RO': { lat: 45.9432, lng: 24.9668, name: 'Romania' },
  'RU': { lat: 61.5240, lng: 105.3188, name: 'Russia' },
  'RW': { lat: -1.9403, lng: 29.8739, name: 'Rwanda' },

  // S
  'KN': { lat: 17.3578, lng: -62.7830, name: 'Saint Kitts and Nevis' },
  'LC': { lat: 13.9094, lng: -60.9789, name: 'Saint Lucia' },
  'VC': { lat: 12.9843, lng: -61.2872, name: 'Saint Vincent and the Grenadines' },
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

  // T
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

  // U
  'UG': { lat: 1.3733, lng: 32.2903, name: 'Uganda' },
  'UA': { lat: 48.3794, lng: 31.1656, name: 'Ukraine' },
  'AE': { lat: 23.4241, lng: 53.8478, name: 'United Arab Emirates' },
  'GB': { lat: 55.3781, lng: -3.4360, name: 'United Kingdom' },
  'US': { lat: 39.8283, lng: -98.5795, name: 'United States' },
  'UY': { lat: -32.5228, lng: -55.7658, name: 'Uruguay' },
  'UZ': { lat: 41.3775, lng: 64.5853, name: 'Uzbekistan' },

  // V
  'VU': { lat: -15.3767, lng: 166.9592, name: 'Vanuatu' },
  'VA': { lat: 41.9029, lng: 12.4534, name: 'Vatican City' },
  'VE': { lat: 6.4238, lng: -66.5897, name: 'Venezuela' },
  'VN': { lat: 14.0583, lng: 108.2772, name: 'Vietnam' },

  // Y
  'YE': { lat: 15.5527, lng: 48.5164, name: 'Yemen' },

  // Z
  'ZM': { lat: -13.1339, lng: 27.8493, name: 'Zambia' },
  'ZW': { lat: -19.0154, lng: 29.1549, name: 'Zimbabwe' }
};

// Map component that renders the actual Google Map
function MapComponent({ articles, onCountryClick }) {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [infoWindow, setInfoWindow] = useState(null);

  useEffect(() => {
    if (mapRef.current && !map) {
      const newMap = new window.google.maps.Map(mapRef.current, {
        center: { lat: 20, lng: 0 },
        zoom: 2,
        styles: [
          {
            featureType: 'water',
            elementType: 'geometry',
            stylers: [{ color: '#e9e9e9' }, { lightness: 17 }]
          },
          {
            featureType: 'landscape',
            elementType: 'geometry',
            stylers: [{ color: '#f5f5f5' }, { lightness: 20 }]
          }
        ]
      });
      setMap(newMap);
      setInfoWindow(new window.google.maps.InfoWindow());
    }
  }, [map]);

  // State for geocoded articles
  const [geocodedArticles, setGeocodedArticles] = useState([]);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Geocode articles when they change
  useEffect(() => {
    const geocodeAllArticles = async () => {
      if (!articles || articles.length === 0) {
        console.log('MapComponent: No articles to geocode');
        setGeocodedArticles([]);
        return;
      }

      console.log(`🌍 Starting geocoding for ${articles.length} articles`);
      setIsGeocoding(true);

      const geocoded = [];

      for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        console.log(`🔍 Geocoding article ${i + 1}/${articles.length}: ${article.title}`);

        try {
          // PRIORITY 1: Check if article already has a known country code
          let countries = [];
          let countrySource = 'unknown';

          if (article.detected_locations?.countries?.length > 0) {
            countries = article.detected_locations.countries;
            countrySource = 'detected_locations';
          } else if (article.geographic_analysis?.primary_countries?.length > 0) {
            countries = article.geographic_analysis.primary_countries;
            countrySource = 'geographic_analysis.primary_countries';
          } else if (article.geographic_analysis?.countries?.length > 0) {
            countries = article.geographic_analysis.countries;
            countrySource = 'geographic_analysis.countries';
          } else if (article.country) {
            countries = [article.country];
            countrySource = 'article.country';
          } else if (article.countryCode) {
            countries = [article.countryCode];
            countrySource = 'article.countryCode';
          }

          let countryCode = 'Unknown';
          if (countries.length > 0) {
            const c = countries[0];
            if (typeof c === 'string') {
              countryCode = c.toUpperCase();
            } else {
              countryCode = c.code || c.country_code || (c.name ? c.name.substring(0, 2).toUpperCase() : 'Unknown');
            }
          }

          // If we have a valid country code, use static coordinates (skip Mapbox)
          if (countryCode !== 'Unknown' && COUNTRY_COORDINATES[countryCode]) {
            const coords = COUNTRY_COORDINATES[countryCode];
            geocoded.push({
              ...article,
              geocoded: false, // Country-level, not city-level
              coordinates: coords,
              countryCode: countryCode
            });
            console.log(`✅ Country-level mapping: ${article.title} -> ${countryCode} (${coords.name}) [${countrySource}]`);
          } else {
            // PRIORITY 2: Try Mapbox geocoding for city-level precision (if country unknown)
            console.log(`🌐 Falling back to Mapbox geocoding: ${article.title} [countryCode=${countryCode}, source=${countrySource}]`);
            const coords = await geocodeArticle(article);

            if (coords) {
              geocoded.push({
                ...article,
                geocoded: true,
                coordinates: coords,
                countryCode: coords.country
              });
              console.log(`✅ City-level geocoded: ${article.title} -> ${coords.country}`);
            } else {
              // Final fallback: no coordinates available
              geocoded.push({
                ...article,
                geocoded: false,
                coordinates: null,
                countryCode: 'Unknown'
              });
              console.log(`⚠️ No coordinates found for: ${article.title}`);
            }

            // Add delay between Mapbox API requests
            if (i < articles.length - 1) {
              await delay(100); // 100ms delay between requests
            }
          }
        } catch (error) {
          console.error(`❌ Error geocoding article: ${article.title}`, error);
          geocoded.push({
            ...article,
            geocoded: false,
            coordinates: null,
            countryCode: 'Unknown'
          });
        }
      }

      console.log(`🎯 Geocoding complete: ${geocoded.filter(a => a.geocoded).length}/${geocoded.length} articles successfully geocoded`);
      setGeocodedArticles(geocoded);
      setIsGeocoding(false);
    };

    geocodeAllArticles();
  }, [articles]);

  useEffect(() => {
    if (map && geocodedArticles.length > 0) {
      console.log('MapComponent: Processing', geocodedArticles.length, 'geocoded articles');

      // Clear existing markers
      markers.forEach(marker => marker.setMap(null));

      // Group articles by location
      const locationGroups = {};
      geocodedArticles.forEach(article => {
        const key = article.geocoded
          ? `${article.coordinates.lat},${article.coordinates.lng}`
          : article.countryCode;

        if (!locationGroups[key]) {
          locationGroups[key] = {
            coordinates: article.coordinates,
            countryCode: article.countryCode,
            articles: [],
            isGeocoded: article.geocoded
          };
        }

        locationGroups[key].articles.push(article);
      });

      // Create markers for each location group
      const newMarkers = [];
      console.log('MapComponent: Location groups:', Object.keys(locationGroups));
      Object.values(locationGroups).forEach((group) => {
        if (group.coordinates) {
          const articleCount = group.articles.length;

          // Determine marker size and color based on article count (coverage density)
          let markerSize = 20;
          let markerColor = 'rgb(100, 200, 255)'; // Default blue for low coverage

          if (articleCount > 10) {
            markerSize = 30;
            markerColor = 'rgb(255, 100, 100)'; // Red for high coverage
          } else if (articleCount > 5) {
            markerSize = 25;
            markerColor = 'rgb(255, 150, 100)'; // Orange for medium coverage
          }

          // Build human-friendly location label using city, province, country name
          const cityName = group.coordinates.cityName || null;
          const provinceName = group.coordinates.provinceName || null;
          const countryNameLabel = group.coordinates.countryName
            || (COUNTRY_COORDINATES[group.countryCode]?.name || group.countryCode);

          const locationName = group.isGeocoded
            ? [cityName, provinceName, countryNameLabel].filter(Boolean).join(', ')
            : `Country-level: ${countryNameLabel}`;

          // Guard against invalid coordinates (NaN/undefined)
          const latNum = Number(group.coordinates.lat);
          const lngNum = Number(group.coordinates.lng);
          if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
            console.warn('Skipping marker with invalid coords:', group.coordinates);
            return; // skip this group
          }

          const marker = new window.google.maps.Marker({
            position: { lat: latNum, lng: lngNum },
            map: map,
            title: `${locationName}: ${articleCount} articles`,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: markerSize / 2,
              fillColor: markerColor,
              fillOpacity: 0.8,
              strokeColor: 'white',
              strokeWeight: 2
            },
            label: {
              text: `${articleCount}`,
              color: 'white',
              fontWeight: 'bold',
              fontSize: '12px'
            }
          });

          marker.addListener('click', () => {
            const primaryArticle = Array.isArray(group.articles) && group.articles.length > 0
              ? group.articles[0]
              : null;
            const sourceUrl = buildNewsSearchUrl(
              primaryArticle?.title,
              primaryArticle?.search_keywords,
              group.countryCode,
              locationName
            );

            const sourceLabel = (primaryArticle?.source || '').trim();
            const classLabel = (primaryArticle?.classification || '').trim();
            const leftText = [sourceLabel, classLabel].filter(Boolean).join(' • ');

            const content = `
              <div style="max-width: 300px;">
                <h3 style="margin: 0 0 10px 0; color: #333;">${locationName}</h3>
                <p style="margin: 0 0 10px 0; color: #666;"><strong>${articleCount}</strong> articles found ${group.isGeocoded ? '<span style="color: #4CAF50;">(Geocoded location)</span>' : '<span style="color: #FF9800;">(Country-level)</span>'}</p>
                <p style="margin: 0 0 10px 0; color: #999; font-size: 12px;">${group.isGeocoded ? '📍 Precise location' : '🌍 Country-level location'}</p>
                <div style="max-height: 200px; overflow-y: auto;">
                  ${primaryArticle ? `
                    <div style="margin-bottom: 8px; padding: 8px; background: #f9f9f9; border-radius: 4px;">
                      <div style="font-weight: 500; font-size: 14px; margin-bottom: 4px; color: var(--text-primary);">${primaryArticle.title || 'No title'}</div>
                      <div style="display: flex; justify-content: space-between; align-items: center;">
                        ${leftText ? `<div style="font-size: 12px; color: #666;">${leftText}</div>` : ''}
                        ${sourceUrl ? `<a href="${sourceUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-link" style="font-size: 0.9rem">View sources →</a>` : ''}
                      </div>
                    </div>
                  ` : '<div style="font-size: 12px; color: #666;">No article available</div>'}
                  ${articleCount > 1 ? `<div style="text-align: center; color: #666; font-size: 12px;">+${articleCount - 1} more articles</div>` : ''}
                </div>
              </div>
            `;

            infoWindow.setContent(content);
            infoWindow.open(map, marker);

            if (onCountryClick) {
              onCountryClick(group.countryCode, group.articles);
            }
          });

          newMarkers.push(marker);
        }
      });

      setMarkers(newMarkers);
    }
  }, [map, geocodedArticles, infoWindow, onCountryClick]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      {isGeocoding && (
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(255,255,255,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid #f3f3f3',
              borderTop: '4px solid var(--text-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 12px'
            }} />
            <div style={{ color: '#333', fontWeight: 500 }}>Geocoding articles...</div>
            <div style={{ color: '#666', fontSize: '12px' }}>Analyzing locations for map coverage</div>
          </div>
        </div>
      )}
    </div>
  );
}

// Fallback Map Component (works without Google Maps API)
function FallbackMapComponent({ articles, onCountryClick }) {
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [hoveredCountry, setHoveredCountry] = useState(null);

  console.log('FallbackMapComponent: Processing', articles.length, 'articles');

  // Group articles by country
  const countryData = {};
  articles.forEach(article => {
    let countries = [];

    // Try to get countries from detected_locations first
    if (article.detected_locations?.countries) {
      countries = article.detected_locations.countries;
      console.log('FallbackMapComponent: Found countries from detected_locations:', countries.map(c => c.code || c.name));
    }
    // Fallback to geographic_analysis
    else if (article.geographic_analysis?.primary_countries) {
      countries = article.geographic_analysis.primary_countries;
      console.log('FallbackMapComponent: Found countries from geographic_analysis primary:', countries.map(c => c.code || c.name));
    }
    // Fallback to legacy geographic_analysis.countries
    else if (article.geographic_analysis?.countries) {
      countries = article.geographic_analysis.countries;
      console.log('FallbackMapComponent: Found countries from geographic_analysis legacy:', countries.map(c => c.code || c.name));
    }

    countries.forEach(country => {
      const countryCode = country.code || country.country_code || country.name?.substring(0, 2).toUpperCase();
      if (countryCode && COUNTRY_COORDINATES[countryCode]) {
        if (!countryData[countryCode]) {
          countryData[countryCode] = {
            ...COUNTRY_COORDINATES[countryCode],
            articles: [],
            count: 0
          };
        }
        countryData[countryCode].articles.push(article);
        countryData[countryCode].count++;
      }
    });
  });

  const getMarkerColor = (count) => {
    if (count >= 10) return '#d32f2f';
    if (count >= 5) return '#ff9800';
    return '#4caf50';
  };

  const getMarkerSize = (count) => {
    if (count >= 10) return 12;
    if (count >= 5) return 8;
    return 6;
  };

  const handleCountryClick = (countryCode, countryInfo) => {
    setSelectedCountry(countryCode);
    if (onCountryClick) {
      onCountryClick(countryInfo);
    }
  };

  return (
    <div style={{ width: '100%', height: '600px', position: 'relative', backgroundColor: '#e3f2fd' }}>
      {/* Simple World Map Background */}
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1000 500"
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {/* Simplified world map outline */}
        <rect width="1000" height="500" fill="#81d4fa" />

        {/* Continents (simplified shapes) */}
        {/* North America */}
        <path d="M100 100 L300 80 L320 200 L250 250 L150 220 Z" fill="#c8e6c9" stroke="#4caf50" strokeWidth="1" />

        {/* South America */}
        <path d="M200 280 L280 270 L300 400 L220 420 L180 350 Z" fill="#c8e6c9" stroke="#4caf50" strokeWidth="1" />

        {/* Europe */}
        <path d="M450 80 L550 70 L580 150 L500 180 L430 140 Z" fill="#c8e6c9" stroke="#4caf50" strokeWidth="1" />

        {/* Africa */}
        <path d="M480 200 L580 190 L600 350 L520 380 L460 320 Z" fill="#c8e6c9" stroke="#4caf50" strokeWidth="1" />

        {/* Asia */}
        <path d="M600 50 L850 40 L880 200 L750 220 L620 180 Z" fill="#c8e6c9" stroke="#4caf50" strokeWidth="1" />

        {/* Australia */}
        <path d="M750 350 L850 340 L870 400 L780 410 Z" fill="#c8e6c9" stroke="#4caf50" strokeWidth="1" />

        {/* Country markers */}
        {Object.entries(countryData).map(([countryCode, data]) => {
          // Convert lat/lng to SVG coordinates (simplified projection)
          const x = ((data.lng + 180) / 360) * 1000;
          const y = ((90 - data.lat) / 180) * 500;

          return (
            <g key={countryCode}>
              <circle
                cx={x}
                cy={y}
                r={getMarkerSize(data.count)}
                fill={getMarkerColor(data.count)}
                stroke="white"
                strokeWidth="2"
                style={{
                  cursor: 'pointer',
                  opacity: hoveredCountry === countryCode ? 0.8 : 1,
                  transform: hoveredCountry === countryCode ? 'scale(1.2)' : 'scale(1)',
                  transformOrigin: `${x}px ${y}px`,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={() => setHoveredCountry(countryCode)}
                onMouseLeave={() => setHoveredCountry(null)}
                onClick={() => handleCountryClick(countryCode, data)}
              />
              {/* Permanent article count label */}
              <text
                x={x}
                y={y + 4}
                textAnchor="middle"
                fill="white"
                fontSize="10"
                fontWeight="bold"
                style={{ pointerEvents: 'none' }}
              >
                {data.count}
              </text>
              {/* Hover tooltip */}
              {hoveredCountry === countryCode && (
                <text
                  x={x}
                  y={y - 20}
                  textAnchor="middle"
                  fill="#333"
                  fontSize="12"
                  fontWeight="bold"
                  style={{ pointerEvents: 'none' }}
                >
                  {data.name}: {data.count} articles
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Info panel */}
      {selectedCountry && countryData[selectedCountry] && (
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          backgroundColor: 'white',
          padding: '16px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          maxWidth: '300px',
          zIndex: 1000
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, color: '#333' }}>{countryData[selectedCountry].name}</h3>
            <button
              onClick={() => setSelectedCountry(null)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '18px',
                cursor: 'pointer',
                color: '#666'
              }}
            >
              ×
            </button>
          </div>
          <p style={{ margin: '0 0 8px 0', color: '#666' }}>
            {countryData[selectedCountry].count} articles found
          </p>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {countryData[selectedCountry].articles.slice(0, 1).map((article, index) => {
              const sourceUrl = buildNewsSearchUrl(
                article?.title,
                article?.search_keywords,
                selectedCountry,
                countryData[selectedCountry]?.name
              );
              return (
                <div
                  key={index}
                  style={{
                    marginBottom: '8px',
                    paddingBottom: '8px',
                    borderBottom: '1px solid #eee',
                    padding: '4px',
                    borderRadius: '4px'
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: '#1976d2' }}>
                    {article.title}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {(() => {
                      const sourceLabel = (article?.source || '').trim();
                      const classLabel = (article?.classification || '').trim();
                      const leftText = [sourceLabel, classLabel].filter(Boolean).join(' • ');
                      return leftText ? (
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {leftText}
                        </div>
                      ) : null;
                    })()}
                    {sourceUrl && (
                      <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-link"
                        style={{ fontSize: '0.9rem' }}
                      >
                        View sources →
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
            {countryData[selectedCountry].articles.length > 1 && (
              <div style={{ fontSize: '12px', color: '#666', textAlign: 'center' }}>
                +{countryData[selectedCountry].articles.length - 1} more articles
              </div>
            )}
          </div>
        </div>
      )}

      {/* Debug panel */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        padding: '12px',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#333',
        border: '1px solid #ddd',
        maxWidth: '250px'
      }}>
        <div><strong>Debug Info:</strong></div>
        <div>Articles: {articles.length}</div>
        <div>Countries: {Object.keys(countryData).length}</div>
        {Object.keys(countryData).length > 0 && (
          <div style={{ marginTop: '8px' }}>
            <div><strong>Countries found:</strong></div>
            {Object.entries(countryData).map(([code, data]) => (
              <div key={code}>{code}: {data.count} articles</div>
            ))}
          </div>
        )}
        <button
          onClick={async () => {
            try {
              const response = await fetch('http://localhost:8000/api/search?q=news');
              const data = await response.json();
              alert(`API Test: ${data.articles?.length || 0} articles found`);
            } catch (err) {
              alert(`API Error: ${err.message}`);
            }
          }}
          style={{
            marginTop: '8px',
            padding: '4px 8px',
            fontSize: '10px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          Test API
        </button>
      </div>

      {/* Map notice */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        padding: '8px 12px',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#666'
      }}>
        📍 Simplified map view • Click markers to see articles
      </div>
    </div>
  );
}

// Main WorldMap component
function WorldMap({ articles: propArticles, onCountryClick }) {
  const { topics, loading, error, refetch } = useGeminiTopics();

  // Convert AppSync topics to article-like objects for map grouping
  const topicsToArticles = (list) => {
    if (!Array.isArray(list)) return [];
    const out = [];

    list.forEach(t => {
      // Get country codes from regions and sources
      const countryCodes = getTopicCountryCodes(t);

      // Create an article entry for each country
      countryCodes.forEach(code => {
        out.push({
          title: t.title,
          regions: t.regions || [],
          sources: t.sources || [],
          search_keywords: Array.isArray(t.search_keywords) ? t.search_keywords : [],
          countryCode: code,
          geographic_analysis: {
            primary_countries: [{ code, name: code }]
          },
        });
      });
    });

    console.log(`📍 Converted ${list.length} topics to ${out.length} map articles`);
    return out;
  };

  const articles = propArticles && propArticles.length ? propArticles : topicsToArticles(topics);

  const apiKey = 'AIzaSyA6L0VMKNFLNoMIAglFxVg9MWZhdc4OFzU';

  console.log('🗺️ WorldMap: Using articles derived from topics:', articles.length);
  console.log('🗺️ WorldMap: Topics count:', Array.isArray(topics) ? topics.length : 0);
  console.log('🗺️ WorldMap: PropArticles:', propArticles?.length || 0);
  console.log('🗺️ WorldMap: Final articles being used:', articles);
  console.log('🗺️ WorldMap: First few article titles:', articles.slice(0, 3).map(a => a?.title));

  const render = (status) => {
    if (status === 'LOADING') {
      return (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f5f5f5'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid #f3f3f3',
              borderTop: '4px solid var(--accent-color)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px'
            }} />
            <p style={{ color: '#666', margin: 0 }}>Loading map...</p>
          </div>
        </div>
      );
    }

    if (status === 'FAILURE' || apiKey === 'REPLACE_WITH_GOOGLE_MAPS_API_KEY') {
      // Use fallback map when Google Maps API key is not configured
      console.log('WorldMap: Using FallbackMapComponent with', articles.length, 'articles');
      return <FallbackMapComponent articles={articles} onCountryClick={onCountryClick} />;
    }

    console.log('WorldMap: Using Google MapComponent with', articles.length, 'articles');
    return <MapComponent articles={articles} onCountryClick={onCountryClick} />;
  };

  if (loading) {
    return (
      <div style={{
        width: '100%',
        height: '600px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid var(--accent-color)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: '#666', margin: 0 }}>Loading articles...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        width: '100%',
        height: '600px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗺️</div>
          <h3 style={{ color: '#d32f2f', margin: '0 0 8px 0' }}>Map Loading Failed</h3>
          <p style={{ color: '#666', margin: '0 0 16px 0' }}>{error}</p>
          <button
            onClick={refetch}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--accent-color)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Map Header */}
      <div style={{ marginBottom: '1rem' }}>
        <div className="card" style={{ padding: '1rem' }}>
          <h2 style={{ margin: '0 0 1rem 0' }}>Today's Topics Map</h2>
          <p style={{ margin: '0', color: 'var(--text-muted)' }}>
            Explore today's top international topics around the world. Markers show coverage density by region.
          </p>
        </div>
      </div>

      {/* Map Container */}
      <div className="map-shell">
        {/* Map Legend */}
        <div className="map-overlay map-legend">
          <h4 className="map-legend-title">Coverage Density</h4>
          <div className="map-legend-row">
            <span className="legend-dot low" />
            <span className="legend-label">Low coverage (1-5 articles)</span>
          </div>
          <div className="map-legend-row">
            <span className="legend-dot medium" />
            <span className="legend-label">Medium coverage (6-10 articles)</span>
          </div>
          <div className="map-legend-row">
            <span className="legend-dot high" />
            <span className="legend-label">High coverage (10+ articles)</span>
          </div>
        </div>

        {/* Map Statistics */}
        <div className="map-overlay map-stats">
          <div className="map-stats-row">
            Total Articles: <strong>{articles.length}</strong>
          </div>
          <div className="map-stats-row">
            Countries: <strong>
              {(() => {
                const countries = new Set();
                articles.forEach(article => {
                  if (article.detected_locations?.countries) {
                    article.detected_locations.countries.forEach(c => countries.add(c.code || c.country_code));
                  } else if (article.geographic_analysis?.primary_countries) {
                    article.geographic_analysis.primary_countries.forEach(c => countries.add(c.code));
                  } else if (article.country) {
                    countries.add(article.country);
                  }
                });
                return countries.size;
              })()}
            </strong>
          </div>
        </div>

        {/* Google Maps Wrapper */}
        <Wrapper apiKey={apiKey} render={render} />
      </div>

      {/* CSS for loading animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* Removed articles list under the map per UI request */}
    </div>
  );
}

// Removed GroupedArticlesByCountry component per UI request

export default WorldMap;
const buildNewsSearchUrl = (title) => {
  if (!title) return '';
  const query = String(title)
    .replace(/\s+/g, ' ')
    .trim();
  return query ? `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=nws&tbs=qdr:d` : '';
};
