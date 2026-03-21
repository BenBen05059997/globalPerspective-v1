import { Link } from 'react-router-dom';
import './WeeklyPage.css';

const MOCK_THREADS = [
  { title: 'Escalating tensions in South China Sea draw US and regional responses', regions: ['Asia'], days: 6, trend: 'rising' },
  { title: 'IMF revises global growth forecast as inflation pressures persist', regions: ['World'], days: 5, trend: 'stable' },
  { title: 'African Union emergency summit on Sudan humanitarian crisis', regions: ['Africa'], days: 4, trend: 'rising' },
];

const TREND_COLORS = {
  rising:  { bg: '#dcfce7', color: '#166534', label: 'Rising' },
  stable:  { bg: '#f3f4f6', color: '#374151', label: 'Stable' },
  fading:  { bg: '#fef3c7', color: '#92400e', label: 'Fading' },
  new:     { bg: '#dbeafe', color: '#1e40af', label: 'New' },
};

const REGION_COLORS = {
  Asia:    { bg: '#fef3c7', border: '#fbbf24', color: '#92400e' },
  World:   { bg: '#f3f4f6', border: '#d1d5db', color: '#6b7280' },
  Africa:  { bg: '#d1fae5', border: '#34d399', color: '#065f46' },
};

export default function WeeklyLockedPreview() {
  return (
    <div className="weekly-page" style={{ position: 'relative' }}>

      {/* Real header */}
      <div className="weekly-header">
        <div>
          <h1>Weekly Analysis</h1>
          <div className="weekly-subtitle">7 days · ~91 topics · ongoing threads tracked</div>
        </div>
      </div>

      {/* Blurred mock content */}
      <div style={{ position: 'relative' }}>
        <div style={{ filter: 'blur(4px)', pointerEvents: 'none', userSelect: 'none', opacity: 0.7 }}>

          {/* Mock trending section */}
          <div className="trending-section">
            <div className="trending-header">
              <h2 className="trending-title">Trending This Week</h2>
              <span className="trending-count">3 rising stories</span>
            </div>
            <div className="trending-cards" style={{ overflow: 'hidden' }}>
              {MOCK_THREADS.map((t, i) => {
                const trend = TREND_COLORS[t.trend];
                return (
                  <div key={i} className="trending-card" style={{ minWidth: 240 }}>
                    <div className="trending-card-top">
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: trend.bg, color: trend.color }}>
                        {trend.label}
                      </span>
                      <span className="trending-card-meta">{t.days}d</span>
                    </div>
                    <div className="trending-card-title">{t.title}</div>
                    <div className="trending-card-regions">
                      {t.regions.map(r => {
                        const rc = REGION_COLORS[r] || REGION_COLORS.World;
                        return (
                          <span key={r} className="story-card-region-tag" style={{ background: rc.bg, borderColor: rc.border, color: rc.color }}>
                            {r}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mock story cards */}
          {MOCK_THREADS.map((t, i) => (
            <div key={i} className="story-card" style={{ marginBottom: 8 }}>
              <div className="story-card-header">
                <div className="story-card-info">
                  <div className="story-card-title-row">
                    <span className="story-card-title">{t.title}</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: TREND_COLORS[t.trend].bg, color: TREND_COLORS[t.trend].color }}>
                      {TREND_COLORS[t.trend].label}
                    </span>
                  </div>
                  <div className="story-card-regions">
                    {t.regions.map(r => {
                      const rc = REGION_COLORS[r] || REGION_COLORS.World;
                      return (
                        <span key={r} className="story-card-region-tag" style={{ background: rc.bg, borderColor: rc.border, color: rc.color }}>
                          {r}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="story-card-indicators">
                  <span className="story-card-days">{t.days}d</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Upgrade overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.7) 30%, rgba(255,255,255,0.97) 60%)',
          paddingTop: '120px',
          gap: '1rem',
          textAlign: 'center',
        }}>
          <img src="/logo_no_grey_bg.png" alt="Global Perspectives" style={{ width: 56, height: 56 }} />
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>Sign in to access Story Intelligence</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: 360, margin: 0 }}>
            Track how every story evolves across days, explore AI country briefings, and follow narrative threads. Free during launch.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.5rem' }}>
            <Link to="/signin" style={{
              display: 'inline-block',
              background: '#111827', color: '#fff',
              padding: '0.6rem 1.5rem', borderRadius: 8,
              fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none',
            }}>
              Sign in free →
            </Link>
            <Link to="/pricing" style={{
              display: 'inline-block',
              background: 'var(--bg-secondary, #f3f4f6)',
              border: '1.5px solid var(--border-color, #e5e7eb)',
              color: 'var(--text-primary, #111827)',
              padding: '0.6rem 1.5rem', borderRadius: 8,
              fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none',
            }}>
              See plans
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
