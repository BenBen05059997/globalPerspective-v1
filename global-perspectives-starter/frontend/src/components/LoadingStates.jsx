// Skeleton loading components for better UX

export function ArticleCardSkeleton() {
  return (
    <div className="card" style={{ 
      marginBottom: '1rem',
      animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Header skeleton */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
            <div style={{
              width: '120px',
              height: '16px',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '4px'
            }}></div>
            <div style={{
              width: '60px',
              height: '14px',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '4px'
            }}></div>
          </div>
          <div style={{
            width: '80px',
            height: '14px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '4px'
          }}></div>
        </div>

        {/* Title skeleton */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{
            width: '90%',
            height: '20px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '4px'
          }}></div>
          <div style={{
            width: '70%',
            height: '20px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '4px'
          }}></div>
        </div>

        {/* Description skeleton */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{
            width: '100%',
            height: '16px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '4px'
          }}></div>
          <div style={{
            width: '85%',
            height: '16px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '4px'
          }}></div>
          <div style={{
            width: '60%',
            height: '16px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '4px'
          }}></div>
        </div>

        {/* Footer skeleton */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '0.5rem',
          borderTop: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{
              width: '60px',
              height: '24px',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '12px'
            }}></div>
            <div style={{
              width: '80px',
              height: '24px',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '12px'
            }}></div>
          </div>
          <div style={{
            width: '100px',
            height: '16px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '4px'
          }}></div>
        </div>
      </div>
    </div>
  );
}

export function SearchResultsSkeleton({ count = 6 }) {
  return (
    <div>
      {/* Header skeleton */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{
          width: '200px',
          height: '32px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '4px',
          marginBottom: '0.5rem'
        }}></div>
        <div style={{
          width: '300px',
          height: '16px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '4px'
        }}></div>
      </div>

      {/* Articles skeleton */}
      {Array.from({ length: count }, (_, index) => (
        <ArticleCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function LoadingSpinner({ size = 'medium', text = 'Loading...' }) {
  const sizes = {
    small: '20px',
    medium: '40px',
    large: '60px'
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1rem',
      padding: '2rem'
    }}>
      <div
        style={{
          width: sizes[size],
          height: sizes[size],
          border: '3px solid var(--bg-secondary)',
          borderTop: '3px solid var(--accent-color)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}
      ></div>
      {text && (
        <p style={{
          margin: 0,
          color: 'var(--text-muted)',
          fontSize: '0.9rem',
          fontWeight: '500'
        }}>
          {text}
        </p>
      )}
    </div>
  );
}

export function ProgressBar({ progress = 0, text = '' }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      padding: '1rem'
    }}>
      {text && (
        <div style={{
          fontSize: '0.9rem',
          fontWeight: '500',
          color: 'var(--text-secondary)'
        }}>
          {text}
        </div>
      )}
      <div style={{
        width: '100%',
        height: '8px',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '4px',
        overflow: 'hidden'
      }}>
        <div
          style={{
            width: `${Math.min(100, Math.max(0, progress))}%`,
            height: '100%',
            backgroundColor: 'var(--accent-color)',
            borderRadius: '4px',
            transition: 'width 0.3s ease'
          }}
        ></div>
      </div>
      <div style={{
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
        textAlign: 'right'
      }}>
        {Math.round(progress)}%
      </div>
    </div>
  );
}

export function SearchLoadingCard() {
  return (
    <div className="card" style={{
      textAlign: 'center',
      padding: '3rem 2rem'
    }}>
      <LoadingSpinner size="large" />
      <div style={{ marginTop: '1rem' }}>
        <h3 style={{
          margin: '0 0 0.5rem 0',
          fontSize: '1.2rem',
          fontWeight: '600',
          color: 'var(--text-primary)'
        }}>
          Searching Global News
        </h3>
        <p style={{
          margin: 0,
          color: 'var(--text-muted)',
          fontSize: '0.9rem'
        }}>
          Analyzing perspectives from around the world...
        </p>
      </div>
    </div>
  );
}

export function PerspectiveComparisonSkeleton() {
  return (
    <div style={{ marginTop: '2rem' }}>
      {/* Header skeleton */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{
          width: '250px',
          height: '32px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '4px',
          marginBottom: '0.5rem'
        }}></div>
        <div style={{
          width: '400px',
          height: '16px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '4px'
        }}></div>
      </div>

      {/* Comparison grid skeleton */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
        gap: '1.5rem'
      }}>
        {/* Local perspective skeleton */}
        <div className="card">
          <div style={{
            width: '180px',
            height: '24px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '4px',
            marginBottom: '1rem'
          }}></div>
          <ArticleCardSkeleton />
          <ArticleCardSkeleton />
        </div>

        {/* Foreign perspective skeleton */}
        <div className="card">
          <div style={{
            width: '200px',
            height: '24px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '4px',
            marginBottom: '1rem'
          }}></div>
          <ArticleCardSkeleton />
          <ArticleCardSkeleton />
        </div>
      </div>
    </div>
  );
}

export function CountryGroupingSkeleton() {
  return (
    <div style={{ marginTop: '2rem' }}>
      {/* Header skeleton */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{
          width: '220px',
          height: '32px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '4px',
          marginBottom: '0.5rem'
        }}></div>
        <div style={{
          width: '350px',
          height: '16px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '4px'
        }}></div>
      </div>

      {/* Tabs skeleton */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem',
        marginBottom: '1.5rem'
      }}>
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            style={{
              width: '120px',
              height: '40px',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '0.5rem 0.5rem 0 0'
            }}
          ></div>
        ))}
      </div>

      {/* Articles grid skeleton */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
        gap: '1rem'
      }}>
        <ArticleCardSkeleton />
        <ArticleCardSkeleton />
        <ArticleCardSkeleton />
        <ArticleCardSkeleton />
      </div>
    </div>
  );
}