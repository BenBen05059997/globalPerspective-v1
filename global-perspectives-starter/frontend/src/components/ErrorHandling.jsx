import { useState } from 'react';

export function ErrorBoundary({ children, fallback }) {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState(null);

  const resetError = () => {
    setHasError(false);
    setError(null);
  };

  if (hasError) {
    return fallback ? fallback(error, resetError) : (
      <ErrorCard 
        title="Something went wrong"
        message="An unexpected error occurred. Please try again."
        onRetry={resetError}
      />
    );
  }

  return children;
}

export function ErrorCard({ 
  title = "Error", 
  message = "Something went wrong", 
  type = "error",
  onRetry = null,
  onDismiss = null,
  details = null
}) {
  const [showDetails, setShowDetails] = useState(false);

  const getErrorIcon = () => {
    switch (type) {
      case 'network':
        return '🌐';
      case 'timeout':
        return '⏱️';
      case 'server':
        return '🔧';
      case 'validation':
        return '⚠️';
      case 'not-found':
        return '🔍';
      default:
        return '❌';
    }
  };

  const getErrorColor = () => {
    switch (type) {
      case 'network':
        return '#f59e0b';
      case 'timeout':
        return '#8b5cf6';
      case 'server':
        return '#ef4444';
      case 'validation':
        return '#f59e0b';
      case 'not-found':
        return '#6b7280';
      default:
        return '#ef4444';
    }
  };

  return (
    <div className="card" style={{
      borderLeft: `4px solid ${getErrorColor()}`,
      backgroundColor: 'var(--bg-primary)'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div style={{ 
            fontSize: '1.5rem',
            flexShrink: 0
          }}>
            {getErrorIcon()}
          </div>
          
          <div style={{ flex: 1 }}>
            <h3 style={{
              margin: '0 0 0.5rem 0',
              fontSize: '1.1rem',
              fontWeight: '600',
              color: 'var(--text-primary)'
            }}>
              {title}
            </h3>
            
            <p style={{
              margin: 0,
              color: 'var(--text-secondary)',
              lineHeight: '1.5'
            }}>
              {message}
            </p>
          </div>

          {/* Dismiss button */}
          {onDismiss && (
            <button
              onClick={onDismiss}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '1.2rem',
                padding: '0.25rem',
                borderRadius: '0.25rem',
                flexShrink: 0
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--bg-secondary)'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              title="Dismiss"
            >
              ✕
            </button>
          )}
        </div>

        {/* Details section */}
        {details && (
          <div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                textDecoration: 'underline',
                padding: 0
              }}
            >
              {showDetails ? 'Hide details' : 'Show details'}
            </button>
            
            {showDetails && (
              <div style={{
                marginTop: '0.5rem',
                padding: '0.75rem',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '0.375rem',
                fontSize: '0.8rem',
                fontFamily: 'monospace',
                color: 'var(--text-muted)',
                whiteSpace: 'pre-wrap',
                overflow: 'auto'
              }}>
                {details}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {onRetry && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button
              onClick={onRetry}
              className="btn btn-primary"
              style={{ fontSize: '0.9rem' }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function NetworkErrorCard({ onRetry }) {
  return (
    <ErrorCard
      type="network"
      title="Connection Problem"
      message="Unable to connect to the server. Please check your internet connection and try again."
      onRetry={onRetry}
    />
  );
}

export function TimeoutErrorCard({ onRetry }) {
  return (
    <ErrorCard
      type="timeout"
      title="Request Timeout"
      message="The request took too long to complete. The server might be busy. Please try again."
      onRetry={onRetry}
    />
  );
}

export function ServerErrorCard({ onRetry, statusCode }) {
  return (
    <ErrorCard
      type="server"
      title="Server Error"
      message={`The server encountered an error${statusCode ? ` (${statusCode})` : ''}. Please try again later.`}
      onRetry={onRetry}
    />
  );
}

export function NotFoundErrorCard({ onRetry }) {
  return (
    <ErrorCard
      type="not-found"
      title="No Results Found"
      message="We couldn't find any articles matching your search criteria. Try different keywords or check your spelling."
      onRetry={onRetry}
    />
  );
}

export function ValidationErrorCard({ errors, onRetry }) {
  const errorList = Array.isArray(errors) ? errors : [errors];
  
  return (
    <ErrorCard
      type="validation"
      title="Invalid Input"
      message={
        <div>
          <p style={{ margin: '0 0 0.5rem 0' }}>Please correct the following issues:</p>
          <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
            {errorList.map((error, index) => (
              <li key={index} style={{ marginBottom: '0.25rem' }}>
                {error}
              </li>
            ))}
          </ul>
        </div>
      }
      onRetry={onRetry}
    />
  );
}

export function InlineError({ message, type = "error" }) {
  const getIcon = () => {
    switch (type) {
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '❌';
    }
  };

  const getColor = () => {
    switch (type) {
      case 'warning':
        return '#f59e0b';
      case 'info':
        return '#3b82f6';
      default:
        return '#ef4444';
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.5rem 0.75rem',
      backgroundColor: 'var(--bg-secondary)',
      border: `1px solid ${getColor()}`,
      borderRadius: '0.375rem',
      fontSize: '0.9rem',
      color: 'var(--text-secondary)'
    }}>
      <span>{getIcon()}</span>
      <span>{message}</span>
    </div>
  );
}

export function Toast({ message, type = "info", duration = 5000, onClose }) {
  const [isVisible, setIsVisible] = useState(true);

  const handleClose = () => {
    setIsVisible(false);
    if (onClose) onClose();
  };

  if (duration > 0) {
    setTimeout(handleClose, duration);
  }

  if (!isVisible) return null;

  const getToastStyle = () => {
    const baseStyle = {
      position: 'fixed',
      top: '1rem',
      right: '1rem',
      zIndex: 1000,
      padding: '0.75rem 1rem',
      borderRadius: '0.5rem',
      boxShadow: '0 4px 12px var(--shadow)',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      maxWidth: '400px',
      animation: 'slideInRight 0.3s ease-out'
    };

    switch (type) {
      case 'success':
        return { ...baseStyle, backgroundColor: '#10b981', color: 'white' };
      case 'error':
        return { ...baseStyle, backgroundColor: '#ef4444', color: 'white' };
      case 'warning':
        return { ...baseStyle, backgroundColor: '#f59e0b', color: 'white' };
      default:
        return { ...baseStyle, backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' };
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      default:
        return 'ℹ️';
    }
  };

  return (
    <div style={getToastStyle()}>
      <span>{getIcon()}</span>
      <span style={{ flex: 1 }}>{message}</span>
      <button
        onClick={handleClose}
        style={{
          background: 'none',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          fontSize: '1.1rem',
          padding: '0.25rem'
        }}
      >
        ✕
      </button>
    </div>
  );
}