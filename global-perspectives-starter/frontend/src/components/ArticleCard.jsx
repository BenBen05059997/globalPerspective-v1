import React, { useState } from 'react';
import { useSummary } from '../hooks/useSummary';
import { usePrediction } from '../hooks/usePrediction';
import SummaryDisplay from './SummaryDisplay';
import PredictionDisplay from './PredictionDisplay';

function ArticleCard({ article }) {
  const [isAISummaryCollapsed, setIsAISummaryCollapsed] = useState(true);
  const [isAIPredictionCollapsed, setIsAIPredictionCollapsed] = useState(true);
  
  // Initialize the summary hook
  const {
    generateSummary,
    getSummary,
    isLoading,
    getError,
    clearSummary
  } = useSummary();

  // Initialize the prediction hook
  const {
    generatePrediction,
    getPrediction,
    isPredictionLoading,
    getPredictionError,
    clearPrediction
  } = usePrediction();

  // Generate a unique ID for this article
  const articleId = `${article.url || 'unknown'}-${article.title?.slice(0, 50) || 'untitled'}`.replace(/[^a-zA-Z0-9]/g, '-');

  // AI Summary handlers
  const handleGenerateSummary = async () => {
    try {
      // Use 'bedrock' as the default service to connect to Bedrock API
      const selectedService = 'bedrock';
      
      await generateSummary(articleId, {
        title: article.title,
        description: article.description,
        url: article.url
      }, selectedService, {
        maxTokens: 150,
        temperature: 0.7
      });
      setIsAISummaryCollapsed(false);
    } catch (error) {
      console.error('Failed to generate summary:', error);
    }
  };

  const handleRetrySummary = () => {
    handleGenerateSummary();
  };

  const handleClearSummary = () => {
    clearSummary(articleId);
    setIsAISummaryCollapsed(true);
  };

  // Removed export handler per UI simplification

  const handleToggleAISummary = () => {
    setIsAISummaryCollapsed(!isAISummaryCollapsed);
  };

  // AI Prediction handlers
  const handleGeneratePrediction = async () => {
    try {
      await generatePrediction(articleId, {
        title: article.title,
        description: article.description,
        url: article.url
      }, 'lambda', {
        maxTokens: 800,
        temperature: 0.8
      });
      setIsAIPredictionCollapsed(false);
    } catch (error) {
      console.error('Failed to generate prediction:', error);
    }
  };

  const handleRetryPrediction = () => {
    handleGeneratePrediction();
  };

  const handleClearPrediction = () => {
    clearPrediction(articleId);
    setIsAIPredictionCollapsed(true);
  };

  // Removed export handler per UI simplification

  const handleToggleAIPrediction = () => {
    setIsAIPredictionCollapsed(!isAIPredictionCollapsed);
  };

  // Get current AI summary state
  const currentSummary = getSummary(articleId);
  const summaryLoading = isLoading(articleId);
  const summaryError = getError(articleId);

  // Get current AI prediction state
  const currentPrediction = getPrediction(articleId);
  const predictionLoading = isPredictionLoading(articleId);
  const predictionErrorObj = getPredictionError(articleId);
  const predictionError = predictionErrorObj ? predictionErrorObj.message || String(predictionErrorObj) : null;

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
      
      if (diffInHours < 1) {
        return 'Just now';
      } else if (diffInHours < 24) {
        return `${diffInHours}h ago`;
      } else if (diffInHours < 48) {
        return 'Yesterday';
      } else {
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
      }
    } catch {
      return 'Date unavailable';
    }
  };

  const getClassificationColor = (classification) => {
    const colors = {
      'local': '#3b82f6',
      'foreign': '#10b981',
      'neutral': '#6b7280'
    };
    return colors[classification] || colors.neutral;
  };

  const getCredibilityScore = (source) => {
    // Mock credibility scoring based on source name
    const highCredibility = ['reuters', 'bbc', 'ap news', 'associated press', 'npr', 'pbs'];
    const mediumCredibility = ['cnn', 'fox news', 'nbc', 'abc', 'cbs', 'the guardian'];
    
    const sourceName = source?.name?.toLowerCase() || '';
    
    if (highCredibility.some(name => sourceName.includes(name))) {
      return { score: 'high', color: '#10b981', icon: '🟢' };
    } else if (mediumCredibility.some(name => sourceName.includes(name))) {
      return { score: 'medium', color: '#f59e0b', icon: '🟡' };
    } else {
      return { score: 'unknown', color: '#6b7280', icon: '⚪' };
    }
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

  const {
    title,
    description,
    url,
    source,
    publishedAt,
    summaryText,
    classification,
    country
  } = article;

  const credibility = getCredibilityScore(source);

  return (
    <div className="card" style={{ 
      marginBottom: '1rem',
      transition: 'all 0.2s ease',
      cursor: 'pointer'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = '0 8px 16px var(--shadow)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 2px 4px var(--shadow)';
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Header with Source and Credibility */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
            <span style={{ 
              fontWeight: '600', 
              fontSize: '0.85rem',
              color: 'var(--text-primary)'
            }}>
              {source?.name || 'Unknown Source'}
            </span>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.25rem',
              fontSize: '0.75rem'
            }}>
              <span>{credibility.icon}</span>
              <span style={{ 
                color: credibility.color,
                fontWeight: '500',
                textTransform: 'capitalize'
              }}>
                {credibility.score}
              </span>
            </div>
          </div>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            fontSize: '0.8rem',
            color: 'var(--text-muted)'
          }}>
            <span>{formatDate(publishedAt)}</span>
          </div>
        </div>

        {/* Title */}
        {title && (
          <h3 style={{ 
            margin: 0, 
            fontSize: '1.2rem', 
            fontWeight: '700',
            lineHeight: '1.3',
            letterSpacing: '-0.01em'
          }}>
            {url ? (
              <a 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ 
                  color: 'var(--text-primary)', 
                  textDecoration: 'none' 
                }}
                onMouseEnter={(e) => e.target.style.color = 'var(--accent-color)'}
                onMouseLeave={(e) => e.target.style.color = 'var(--text-primary)'}
              >
                {title}
              </a>
            ) : (
              title
            )}
          </h3>
        )}

        {/* Description */}
        {description && (
          <p style={{ 
            margin: 0, 
            color: 'var(--text-secondary)', 
            lineHeight: '1.6',
            fontSize: '0.95rem'
          }}>
            {description}
          </p>
        )}

        {/* AI Features Section */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          padding: '12px 16px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem',
            fontWeight: '600',
            color: 'var(--text-primary)'
          }}>
            <span>🤖</span>
            <span>AI Features</span>
          </div>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap'
          }}>
            {/* Summarize Button */}
            <button
              onClick={handleGenerateSummary}
              disabled={summaryLoading}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: summaryLoading ? '#6c757d' : '#28a745',
                color: 'white',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: summaryLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              onMouseEnter={(e) => {
                if (!summaryLoading) {
                  e.target.style.backgroundColor = '#218838';
                  e.target.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!summaryLoading) {
                  e.target.style.backgroundColor = '#28a745';
                  e.target.style.transform = 'translateY(0)';
                }
              }}
            >
              {summaryLoading ? (
                <>
                  <span style={{
                    width: '12px',
                    height: '12px',
                    border: '2px solid #ffffff40',
                    borderTop: '2px solid #ffffff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></span>
                  Generating...
                </>
              ) : (
                <>
                  ✨ Summarize
                </>
              )}
            </button>

            {/* Predict Button */}
            <button
              onClick={handleGeneratePrediction}
              disabled={predictionLoading}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: predictionLoading ? '#6c757d' : '#6f42c1',
                color: 'white',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: predictionLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              onMouseEnter={(e) => {
                if (!predictionLoading) {
                  e.target.style.backgroundColor = '#5a2d91';
                  e.target.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!predictionLoading) {
                  e.target.style.backgroundColor = '#6f42c1';
                  e.target.style.transform = 'translateY(0)';
                }
              }}
              title="Generate AI prediction for this article"
            >
              {predictionLoading ? (
                <>
                  <span style={{
                    width: '12px',
                    height: '12px',
                    border: '2px solid #ffffff40',
                    borderTop: '2px solid #ffffff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></span>
                  Predicting...
                </>
              ) : (
                <>
                  🔮 Predict
                </>
              )}
            </button>
          </div>
        </div>

        {/* AI Summary Display */}
        {(currentSummary || summaryLoading || summaryError) && (
          <SummaryDisplay
            summary={currentSummary}
            isLoading={summaryLoading}
            error={summaryError}
            onRetry={handleRetrySummary}
            onClear={handleClearSummary}
            isCollapsed={isAISummaryCollapsed}
            onToggleCollapse={handleToggleAISummary}
          />
        )}

        {/* AI Prediction Display */}
        {(currentPrediction || predictionLoading || predictionError) && (
          <PredictionDisplay
            prediction={currentPrediction}
            isLoading={predictionLoading}
            error={predictionError}
            onRetry={handleRetryPrediction}
            onClear={handleClearPrediction}
            isCollapsed={isAIPredictionCollapsed}
            onToggleCollapse={handleToggleAIPrediction}
          />
        )}

        {/* Original AI Summary (keeping for backward compatibility) */}
        {summaryText && summaryText !== 'No summary available' && (
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            padding: '1rem',
            borderRadius: '0.5rem',
            borderLeft: '4px solid var(--accent-color)',
            position: 'relative'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.5rem'
            }}>
              <span style={{ fontSize: '0.8rem' }}>🤖</span>
              <span style={{ 
                fontSize: '0.8rem', 
                fontWeight: '600',
                color: 'var(--accent-color)'
              }}>
                AI Summary
              </span>
            </div>
            <p style={{ 
              margin: 0, 
              fontSize: '0.9rem', 
              lineHeight: '1.5',
              color: 'var(--text-secondary)'
            }}>
              {summaryText}
            </p>
          </div>
        )}

        {/* Footer with Tags and Metadata */}
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
          paddingTop: '0.5rem',
          borderTop: '1px solid var(--border-color)'
        }}>
          {/* Left side - Classification and Country */}
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '0.5rem', 
            alignItems: 'center'
          }}>
            {/* Classification Badge */}
            {classification && (
              <span 
                style={{
                  backgroundColor: getClassificationColor(classification),
                  color: 'white',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '1rem',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                {classification}
              </span>
            )}

            {/* Country */}
            {country && (
              <span style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.8rem',
                fontWeight: '500',
                color: 'var(--text-muted)',
                backgroundColor: 'var(--bg-secondary)',
                padding: '0.25rem 0.5rem',
                borderRadius: '0.375rem'
              }}>
                <span>{getCountryFlag(country)}</span>
                <span>{country}</span>
              </span>
            )}
          </div>

          {/* Right side - Read More Link */}
          {url && (
            <a 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{
                fontSize: '0.8rem',
                fontWeight: '600',
                color: 'var(--accent-color)',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
              onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
              onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
            >
              Read Full Article
              <span style={{ fontSize: '0.7rem' }}>↗</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default ArticleCard;