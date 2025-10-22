import { useState, useEffect, useRef } from 'react';
import { Wrapper } from '@googlemaps/react-wrapper';
import { useGeminiTopics } from '../hooks/useGeminiTopics';
import { geocodeArticle, delay } from '../utils/geocoding';

// Hardcoded country coordinates for mapping
const COUNTRY_COORDINATES = {
  'US': { lat: 39.8283, lng: -98.5795, name: 'United States' },
  'GB': { lat: 55.3781, lng: -3.4360, name: 'United Kingdom' },
  'FR': { lat: 46.6034, lng: 1.8883, name: 'France' },
  'DE': { lat: 51.1657, lng: 10.4515, name: 'Germany' },
  'JP': { lat: 36.2048, lng: 138.2529, name: 'Japan' },
  'CN': { lat: 35.8617, lng: 104.1954, name: 'China' },
  'RU': { lat: 61.5240, lng: 105.3188, name: 'Russia' },
  'IN': { lat: 20.5937, lng: 78.9629, name: 'India' },
  'BR': { lat: -14.2350, lng: -51.9253, name: 'Brazil' },
  'CA': { lat: 56.1304, lng: -106.3468, name: 'Canada' },
  'AU': { lat: -25.2744, lng: 133.7751, name: 'Australia' },
  'IT': { lat: 41.8719, lng: 12.5674, name: 'Italy' },
  'ES': { lat: 40.4637, lng: -3.7492, name: 'Spain' },
  'KR': { lat: 35.9078, lng: 127.7669, name: 'South Korea' },
  'MX': { lat: 23.6345, lng: -102.5528, name: 'Mexico' },
  'ZA': { lat: -30.5595, lng: 22.9375, name: 'South Africa' },
  'EG': { lat: 26.8206, lng: 30.8025, name: 'Egypt' },
  'TR': { lat: 38.9637, lng: 35.2433, name: 'Turkey' },
  'SA': { lat: 23.8859, lng: 45.0792, name: 'Saudi Arabia' },
  'IL': { lat: 31.0461, lng: 34.8516, name: 'Israel' },
  'AE': { lat: 23.4241, lng: 53.8478, name: 'UAE' },
  'SG': { lat: 1.3521, lng: 103.8198, name: 'Singapore' },
  'TH': { lat: 15.8700, lng: 100.9925, name: 'Thailand' },
  'VN': { lat: 14.0583, lng: 108.2772, name: 'Vietnam' },
  'PH': { lat: 12.8797, lng: 121.7740, name: 'Philippines' },
  'ID': { lat: -0.7893, lng: 113.9213, name: 'Indonesia' },
  'MY': { lat: 4.2105, lng: 101.9758, name: 'Malaysia' },
  'NG': { lat: 9.0820, lng: 8.6753, name: 'Nigeria' },
  'KE': { lat: -0.0236, lng: 37.9062, name: 'Kenya' },
  'AR': { lat: -38.4161, lng: -63.6167, name: 'Argentina' },
  'CL': { lat: -35.6751, lng: -71.5430, name: 'Chile' },
  'PE': { lat: -9.1900, lng: -75.0152, name: 'Peru' },
  'CO': { lat: 4.5709, lng: -74.2973, name: 'Colombia' },
  'VE': { lat: 6.4238, lng: -66.5897, name: 'Venezuela' },
  'UA': { lat: 48.3794, lng: 31.1656, name: 'Ukraine' },
  'PL': { lat: 51.9194, lng: 19.1451, name: 'Poland' },
  'NL': { lat: 52.1326, lng: 5.2913, name: 'Netherlands' },
  'BE': { lat: 50.5039, lng: 4.4699, name: 'Belgium' },
  'CH': { lat: 46.8182, lng: 8.2275, name: 'Switzerland' },
  'AT': { lat: 47.5162, lng: 14.5501, name: 'Austria' },
  'SE': { lat: 60.1282, lng: 18.6435, name: 'Sweden' },
  'NO': { lat: 60.4720, lng: 8.4689, name: 'Norway' },
  'DK': { lat: 56.2639, lng: 9.5018, name: 'Denmark' },
  'FI': { lat: 61.9241, lng: 25.7482, name: 'Finland' },
  'IE': { lat: 53.4129, lng: -8.2439, name: 'Ireland' },
  'PT': { lat: 39.3999, lng: -8.2245, name: 'Portugal' },
  'GR': { lat: 39.0742, lng: 21.8243, name: 'Greece' },
  'CZ': { lat: 49.8175, lng: 15.4730, name: 'Czech Republic' },
  'HU': { lat: 47.1625, lng: 19.5033, name: 'Hungary' },
  'RO': { lat: 45.9432, lng: 24.9668, name: 'Romania' },
  'BG': { lat: 42.7339, lng: 25.4858, name: 'Bulgaria' },
  'HR': { lat: 45.1000, lng: 15.2000, name: 'Croatia' },
  'RS': { lat: 44.0165, lng: 21.0059, name: 'Serbia' },
  'BA': { lat: 43.9159, lng: 17.6791, name: 'Bosnia and Herzegovina' },
  'SI': { lat: 46.1512, lng: 14.9955, name: 'Slovenia' },
  'SK': { lat: 48.6690, lng: 19.6990, name: 'Slovakia' },
  'LT': { lat: 55.1694, lng: 23.8813, name: 'Lithuania' },
  'LV': { lat: 56.8796, lng: 24.6032, name: 'Latvia' },
  'EE': { lat: 58.5953, lng: 25.0136, name: 'Estonia' },
  'PS': { lat: 31.9522, lng: 35.2332, name: 'Palestine' },
  'SD': { lat: 12.8628, lng: 30.2176, name: 'Sudan' },
  'LY': { lat: 26.3351, lng: 17.2283, name: 'Libya' },
  'SY': { lat: 34.8021, lng: 38.9968, name: 'Syria' },
  'IQ': { lat: 33.2232, lng: 43.6793, name: 'Iraq' },
  'AF': { lat: 33.9391, lng: 67.7100, name: 'Afghanistan' },
  'PK': { lat: 30.3753, lng: 69.3451, name: 'Pakistan' },
  'BD': { lat: 23.6850, lng: 90.3563, name: 'Bangladesh' },
  'MM': { lat: 21.9162, lng: 95.9560, name: 'Myanmar' },
  'LK': { lat: 7.8731, lng: 80.7718, name: 'Sri Lanka' }
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
          const coords = await geocodeArticle(article);
          
          if (coords) {
            geocoded.push({
              ...article,
              geocoded: true,
              coordinates: coords,
              countryCode: coords.country
            });
            console.log(`✅ Successfully geocoded: ${article.title} -> ${coords.country}`);
          } else {
            // Fallback to country-level mapping for articles that can't be geocoded
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

            let countryCode = 'Unknown';
            if (countries.length > 0) {
              const c = countries[0];
              if (typeof c === 'string') {
                countryCode = c.toUpperCase();
              } else {
                countryCode = c.code || c.country_code || (c.name ? c.name.substring(0, 2).toUpperCase() : 'Unknown');
              }
            }

            const coords = COUNTRY_COORDINATES[countryCode] || null;

            geocoded.push({
              ...article,
              geocoded: false,
              coordinates: coords,
              countryCode: countryCode
            });
            console.log(`⚠️ Fallback mapping for: ${article.title} -> ${countryCode}${coords ? '' : ' (no coordinates found)'}`);
          }
          
          // Add delay between requests to be respectful to the API
          if (i < articles.length - 1) {
            await delay(100); // 100ms delay between requests
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
      const regions = Array.isArray(t.regions) ? t.regions : [];
      regions.forEach(code => {
        out.push({
          title: t.title,
          geographic_analysis: { primary_countries: [{ code }] },
        });
      });
    });
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
      <div style={{ width: '100%', height: '600px', position: 'relative' }}>
        {/* Map Legend */}
        <div style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          backgroundColor: 'white',
          padding: '12px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          zIndex: 1000,
          minWidth: '200px'
        }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>
            Coverage Density
          </h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: 'rgb(100, 200, 255)',
              border: '2px solid white'
            }} />
            <span style={{ fontSize: '12px', color: '#666' }}>Low coverage (1-5 articles)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: 'rgb(255, 150, 100)',
              border: '2px solid white'
            }} />
            <span style={{ fontSize: '12px', color: '#666' }}>Medium coverage (6-10 articles)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: 'rgb(255, 100, 100)',
              border: '2px solid white'
            }} />
            <span style={{ fontSize: '12px', color: '#666' }}>High coverage (10+ articles)</span>
          </div>
        </div>

        {/* Map Statistics */}
        <div style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          backgroundColor: 'white',
          padding: '12px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          zIndex: 1000
        }}>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
            Total Articles: <strong>{articles.length}</strong>
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
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
