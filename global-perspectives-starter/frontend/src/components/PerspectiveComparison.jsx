import { useState } from 'react';
import ArticleCard from './ArticleCard';

function PerspectiveComparison({ articles, query }) {
  const [selectedCountry, setSelectedCountry] = useState('all');
  
  // Group articles by classification
  const localArticles = articles.filter(article => article.classification === 'local');
  const foreignArticles = articles.filter(article => article.classification === 'foreign');
  const neutralArticles = articles.filter(article => article.classification === 'neutral');
  
  // Get unique countries for filtering
  const countries = [...new Set(articles.map(article => article.country).filter(Boolean))];
  
  // Filter articles by selected country
  const filterByCountry = (articleList) => {
    if (selectedCountry === 'all') return articleList;
    return articleList.filter(article => article.country === selectedCountry);
  };

  const getCountryFlag = (country) => {
    const flags = {
      'United States': '🇺🇸',
      'United Kingdom': '🇬🇧',
      'Canada': '🇨🇦',
      'Australia': '🇦🇺',
      'Germany': '🇩🇪',
      'France': '🇫🇷',
      'Spain': '🇪🇸',
      'Italy': '🇮🇹',
      'Japan': '🇯🇵',
      'China': '🇨🇳',
      'Russia': '🇷🇺',
      'Brazil': '🇧🇷',
      'India': '🇮🇳',
      'South Korea': '🇰🇷'
    };
    return flags[country] || '🌍';
  };

  if (!articles || articles.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: '2rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ 
          margin: '0 0 0.5rem 0', 
          fontSize: '1.5rem', 
          fontWeight: '700',
          color: 'var(--text-primary)'
        }}>
          Perspective Comparison
        </h2>
        <p style={{ 
          margin: 0, 
          color: 'var(--text-secondary)',
          fontSize: '0.95rem'
        }}>
          Compare how different regions cover "{query}"
        </p>
      </div>

      {/* Country Filter */}
      {countries.length > 1 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '0.5rem', 
            fontWeight: '500',
            fontSize: '0.9rem'
          }}>
            Filter by Country:
          </label>
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="input"
            style={{ width: '200px' }}
          >
            <option value="all">All Countries</option>
            {countries.map(country => (
              <option key={country} value={country}>
                {getCountryFlag(country)} {country}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Comparison Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        {/* Local Perspective */}
        <div className="card" style={{ height: 'fit-content' }}>
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ 
              margin: '0 0 0.5rem 0', 
              fontSize: '1.2rem', 
              fontWeight: '600',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              🏠 Local Perspective
              <span style={{ 
                fontSize: '0.8rem', 
                fontWeight: '400',
                color: 'var(--text-muted)',
                backgroundColor: 'var(--bg-secondary)',
                padding: '0.25rem 0.5rem',
                borderRadius: '1rem'
              }}>
                {filterByCountry(localArticles).length} articles
              </span>
            </h3>
            <p style={{ 
              margin: 0, 
              fontSize: '0.85rem', 
              color: 'var(--text-secondary)'
            }}>
              Coverage from domestic sources and local viewpoints
            </p>
          </div>
          
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {filterByCountry(localArticles).length > 0 ? (
              filterByCountry(localArticles).map((article, index) => (
                <ArticleCard key={index} article={article} />
              ))
            ) : (
              <div style={{ 
                textAlign: 'center', 
                padding: '2rem',
                color: 'var(--text-muted)',
                fontSize: '0.9rem'
              }}>
                No local perspective articles found
                {selectedCountry !== 'all' && ` for ${selectedCountry}`}
              </div>
            )}
          </div>
        </div>

        {/* Foreign Perspective */}
        <div className="card" style={{ height: 'fit-content' }}>
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ 
              margin: '0 0 0.5rem 0', 
              fontSize: '1.2rem', 
              fontWeight: '600',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              🌍 Foreign Perspective
              <span style={{ 
                fontSize: '0.8rem', 
                fontWeight: '400',
                color: 'var(--text-muted)',
                backgroundColor: 'var(--bg-secondary)',
                padding: '0.25rem 0.5rem',
                borderRadius: '1rem'
              }}>
                {filterByCountry(foreignArticles).length} articles
              </span>
            </h3>
            <p style={{ 
              margin: 0, 
              fontSize: '0.85rem', 
              color: 'var(--text-secondary)'
            }}>
              Coverage from international sources and external viewpoints
            </p>
          </div>
          
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {filterByCountry(foreignArticles).length > 0 ? (
              filterByCountry(foreignArticles).map((article, index) => (
                <ArticleCard key={index} article={article} />
              ))
            ) : (
              <div style={{ 
                textAlign: 'center', 
                padding: '2rem',
                color: 'var(--text-muted)',
                fontSize: '0.9rem'
              }}>
                No foreign perspective articles found
                {selectedCountry !== 'all' && ` for ${selectedCountry}`}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Neutral Articles Section */}
      {neutralArticles.length > 0 && (
        <div className="card">
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ 
              margin: '0 0 0.5rem 0', 
              fontSize: '1.2rem', 
              fontWeight: '600',
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              ⚖️ Neutral Coverage
              <span style={{ 
                fontSize: '0.8rem', 
                fontWeight: '400',
                color: 'var(--text-muted)',
                backgroundColor: 'var(--bg-secondary)',
                padding: '0.25rem 0.5rem',
                borderRadius: '1rem'
              }}>
                {filterByCountry(neutralArticles).length} articles
              </span>
            </h3>
            <p style={{ 
              margin: 0, 
              fontSize: '0.85rem', 
              color: 'var(--text-secondary)'
            }}>
              Balanced reporting without clear local or foreign bias
            </p>
          </div>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', 
            gap: '1rem'
          }}>
            {filterByCountry(neutralArticles).map((article, index) => (
              <ArticleCard key={index} article={article} />
            ))}
          </div>
        </div>
      )}

      {/* Summary Statistics */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h3 style={{ 
          margin: '0 0 1rem 0', 
          fontSize: '1.1rem', 
          fontWeight: '600'
        }}>
          📊 Coverage Analysis
        </h3>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
          gap: '1rem'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: '2rem', 
              fontWeight: '700', 
              color: '#3b82f6'
            }}>
              {filterByCountry(localArticles).length}
            </div>
            <div style={{ 
              fontSize: '0.8rem', 
              color: 'var(--text-muted)',
              fontWeight: '500'
            }}>
              Local Articles
            </div>
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: '2rem', 
              fontWeight: '700', 
              color: '#10b981'
            }}>
              {filterByCountry(foreignArticles).length}
            </div>
            <div style={{ 
              fontSize: '0.8rem', 
              color: 'var(--text-muted)',
              fontWeight: '500'
            }}>
              Foreign Articles
            </div>
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: '2rem', 
              fontWeight: '700', 
              color: '#6b7280'
            }}>
              {filterByCountry(neutralArticles).length}
            </div>
            <div style={{ 
              fontSize: '0.8rem', 
              color: 'var(--text-muted)',
              fontWeight: '500'
            }}>
              Neutral Articles
            </div>
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: '2rem', 
              fontWeight: '700', 
              color: 'var(--text-primary)'
            }}>
              {countries.length}
            </div>
            <div style={{ 
              fontSize: '0.8rem', 
              color: 'var(--text-muted)',
              fontWeight: '500'
            }}>
              Countries
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PerspectiveComparison;