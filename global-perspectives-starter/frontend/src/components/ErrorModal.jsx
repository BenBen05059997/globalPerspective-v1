import { useEffect } from 'react';
import { useError } from '../contexts/ErrorContext';

function getFriendlyMessage(errorMessage) {
  if (!errorMessage) return 'An unexpected error occurred.';

  const msg = errorMessage.toLowerCase();

  if (msg.includes('stale') || msg.includes('refreshing') || msg.includes('pending')) {
    return 'News topics are being refreshed. Please wait a moment and refresh the page.';
  }

  if (msg.includes('503') || msg.includes('service unavailable')) {
    return 'Service temporarily unavailable. Please try again in a moment.';
  }

  if (msg.includes('cache miss') || msg.includes('not found')) {
    return 'Content not yet generated. Please try again in a few seconds.';
  }

  if (msg.includes('network') || msg.includes('fetch')) {
    return 'Network error. Please check your connection and try again.';
  }

  return errorMessage;
}

export default function ErrorModal() {
  const { error, clearError } = useError();

  useEffect(() => {
    if (error) {
      const handleEscape = (e) => {
        if (e.key === 'Escape') clearError();
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [error, clearError]);

  if (!error) return null;

  const title = error.title || 'Something went wrong';
  const message = getFriendlyMessage(error.message);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) clearError();
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '1.5rem',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>
            {title}
          </h3>
          <button
            onClick={clearError}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0',
              lineHeight: '1',
              color: '#666',
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p style={{ margin: '0 0 1.5rem', color: '#333', lineHeight: '1.6' }}>
          {message}
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            onClick={clearError}
            className="btn btn-primary"
            style={{ minWidth: '100px' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
