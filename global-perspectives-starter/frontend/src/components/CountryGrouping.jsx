import { useState } from 'react';
import ArticleCard from './ArticleCard';

function CountryGrouping({ articles, query }) {
  const [activeTab, setActiveTab] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  
  // Group articles by country
  const articlesByCountry = articles.reduce((acc, article) => {
    const country = article.country || 'Unknown';
    if (!acc[country]) {
      acc[country] = [];
    }
    acc[country].push(article);
    return acc;
  }, {});

  // Sort countries by article count
  const sortedCountries = Object.keys(articlesByCountry).sort((a, b) => {
    if (a === 'Unknown') return 1;
    if (b === 'Unknown') return -1;
    return articlesByCountry[b].length - articlesByCountry[a].length;
  });

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
      'South Korea': '🇰🇷',
      'Unknown': '🌐'
    };
    return flags[country] || '🌍';
  };

  const sortArticles = (articleList) => {
    const sorted = [...articleList];
    switch (sortBy) {
      case 'date':
        return sorted.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
      case 'source':
        return sorted.sort((a, b) => (a.source?.name || '').localeCompare(b.source?.name || ''));
      case 'classification':
        return sorted.sort((a, b) => (a.classification || '').localeCompare(b.classification || ''));
      default:
        return sorted;
    }
  };

  const getActiveArticles = () => {
    if (activeTab === 'all') {
      return sortArticles(articles);
    }
    return sortArticles(articlesByCountry[activeTab] || []);
  };

  const getClassificationStats = (articleList) => {
    const stats = { local: 0, foreign: 0, neutral: 0 };
    articleList.forEach(article => {
      if (article.classification) {
        stats[article.classification] = (stats[article.classification] || 0) + 1;
      }
    });
    return stats;
  };

  if (!articles || articles.length === 0) {
    return null;
  }

  const activeArticles = getActiveArticles();
  const stats = getClassificationStats(activeArticles);

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
          Coverage by Country
        </h2>
        <p style={{ 
          margin: 0, 
          color: 'var(--text-secondary)',
          fontSize: '0.95rem'
        }}>
          Explore how different countries report on "{query}"
        </p>
      </div>

      {/* Controls */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        {/* Sort Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ 
            fontSize: '0.9rem', 
            fontWeight: '500',
            color: 'var(--text-secondary)'
          }}>
            Sort by:
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input"
            style={{ width: '150px', padding: '0.25rem 0.5rem' }}
          >
            <option value="date">Date</option>
            <option value="source">Source</option>
            <option value="classification">Classification</option>
          </select>
        </div>

        {/* Article Count */}
        <div style={{ 
          fontSize: '0.9rem', 
          color: 'var(--text-muted)',
          fontWeight: '500'
        }}>
          {activeArticles.length} articles
          {activeTab !== 'all' && ` from ${activeTab}`}
        </div>
      </div>

      {/* Country Tabs */}
      <div style={{ 
        display: 'flex', 
        overflowX: 'auto', 
        gap: '0.5rem',
        marginBottom: '1.5rem',
        paddingBottom: '0.5rem',
        borderBottom: '2px solid var(--border-color)'
      }}>
        {/* All Countries Tab */}
        <button
          onClick={() => setActiveTab('all')}
          style={{
            padding: '0.75rem 1rem',
            border: 'none',
            borderRadius: '0.5rem 0.5rem 0 0',
            backgroundColor: activeTab === 'all' ? 'var(--accent-color)' : 'var(--bg-secondary)',
            color: activeTab === 'all' ? 'white' : 'var(--text-primary)',
            fontWeight: '600',
            fontSize: '0.9rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s ease',
            borderBottom: activeTab === 'all' ? '2px solid var(--accent-color)' : '2px solid transparent',
            marginBottom: '-2px'
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'all') {
              e.target.style.backgroundColor = 'var(--bg-primary)';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'all') {
              e.target.style.backgroundColor = 'var(--bg-secondary)';
            }
          }}
        >
          🌍 All Countries
          <span style={{ 
            fontSize: '0.8rem',
            backgroundColor: activeTab === 'all' ? 'rgba(255,255,255,0.2)' : 'var(--bg-primary)',
            padding: '0.2rem 0.4rem',
            borderRadius: '0.75rem'
          }}>
            {articles.length}
          </span>
        </button>

        {/* Individual Country Tabs */}
        {sortedCountries.map(country => (
          <button
            key={country}
            onClick={() => setActiveTab(country)}
            style={{
              padding: '0.75rem 1rem',
              border: 'none',
              borderRadius: '0.5rem 0.5rem 0 0',
              backgroundColor: activeTab === country ? 'var(--accent-color)' : 'var(--bg-secondary)',
              color: activeTab === country ? 'white' : 'var(--text-primary)',
              fontWeight: '600',
              fontSize: '0.9rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease',
              borderBottom: activeTab === country ? '2px solid var(--accent-color)' : '2px solid transparent',
              marginBottom: '-2px'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== country) {
                e.target.style.backgroundColor = 'var(--bg-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== country) {
                e.target.style.backgroundColor = 'var(--bg-secondary)';
              }
            }}
          >
            {getCountryFlag(country)} {country}
            <span style={{ 
              fontSize: '0.8rem',
              backgroundColor: activeTab === country ? 'rgba(255,255,255,0.2)' : 'var(--bg-primary)',
              padding: '0.2rem 0.4rem',
              borderRadius: '0.75rem'
            }}>
              {articlesByCountry[country].length}
            </span>
          </button>
        ))}
      </div>

      {/* Statistics Bar */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ 
            display: 'flex', 
            gap: '1.5rem',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ 
                width: '12px', 
                height: '12px', 
                backgroundColor: '#3b82f6', 
                borderRadius: '50%' 
              }}></div>
              <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                Local: {stats.local}
              </span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ 
                width: '12px', 
                height: '12px', 
                backgroundColor: '#10b981', 
                borderRadius: '50%' 
              }}></div>
              <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                Foreign: {stats.foreign}
              </span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ 
                width: '12px', 
                height: '12px', 
                backgroundColor: '#6b7280', 
                borderRadius: '50%' 
              }}></div>
              <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                Neutral: {stats.neutral}
              </span>
            </div>
          </div>

          {/* Coverage Distribution */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            fontSize: '0.8rem',
            color: 'var(--text-muted)'
          }}>
            <span>Coverage Distribution:</span>
            <div style={{ 
              display: 'flex', 
              height: '8px', 
              width: '100px', 
              borderRadius: '4px',
              overflow: 'hidden',
              backgroundColor: 'var(--bg-secondary)'
            }}>
              {stats.local > 0 && (
                <div style={{ 
                  width: `${(stats.local / activeArticles.length) * 100}%`, 
                  backgroundColor: '#3b82f6' 
                }}></div>
              )}
              {stats.foreign > 0 && (
                <div style={{ 
                  width: `${(stats.foreign / activeArticles.length) * 100}%`, 
                  backgroundColor: '#10b981' 
                }}></div>
              )}
              {stats.neutral > 0 && (
                <div style={{ 
                  width: `${(stats.neutral / activeArticles.length) * 100}%`, 
                  backgroundColor: '#6b7280' 
                }}></div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Articles Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
        gap: '1rem'
      }}>
        {activeArticles.length > 0 ? (
          activeArticles.map((article, index) => (
            <ArticleCard key={index} article={article} />
          ))
        ) : (
          <div className="card" style={{ 
            textAlign: 'center', 
            padding: '3rem',
            gridColumn: '1 / -1'
          }}>
            <div style={{ 
              fontSize: '3rem', 
              marginBottom: '1rem' 
            }}>
              📰
            </div>
            <h3 style={{ 
              margin: '0 0 0.5rem 0', 
              color: 'var(--text-primary)'
            }}>
              No articles found
            </h3>
            <p style={{ 
              margin: 0, 
              color: 'var(--text-muted)'
            }}>
              {activeTab === 'all' 
                ? 'No articles available for this search.'
                : `No articles found from ${activeTab}.`
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default CountryGrouping;