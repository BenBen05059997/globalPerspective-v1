import { Link } from 'react-router-dom';
import IntelligenceLoader from './IntelligenceLoader';
import { usePairAnalyses } from '../hooks/usePairAnalyses';
import './PairListPage.css';

const QUALITY_CONFIG = {
  rich: { label: 'Rich', cls: 'plp-quality-rich' },
  moderate: { label: 'Moderate', cls: 'plp-quality-moderate' },
  sparse: { label: 'Sparse', cls: 'plp-quality-sparse' },
  thin: { label: 'Limited', cls: 'plp-quality-thin' },
};

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

function PairCard({ analysis }) {
  const { slug, pairTitle, leadSentence, dataQuality, countries = [], generatedAt } = analysis;
  const cfg = QUALITY_CONFIG[dataQuality] || QUALITY_CONFIG.thin;

  return (
    <Link to={`/weekly/pair/${slug}`} className="plp-card">
      <div className="plp-card-countries">
        {countries.map((c, i) => (
          <span key={i} className="plp-country-tag">{c}</span>
        ))}
      </div>
      <h3 className="plp-card-title">{pairTitle}</h3>
      {leadSentence && (
        <p className="plp-card-lead">{leadSentence}{leadSentence.length >= 200 ? '…' : ''}</p>
      )}
      <div className="plp-card-footer">
        <span className={`plp-quality-badge ${cfg.cls}`}>{cfg.label}</span>
        {generatedAt && <span className="plp-card-date">{formatDate(generatedAt)}</span>}
      </div>
    </Link>
  );
}

export default function PairListPage() {
  const { analyses, loading, error } = usePairAnalyses();

  return (
    <div className="plp-page">
      <div className="plp-header">
        <h1 className="plp-title">Bilateral Intelligence</h1>
        <p className="plp-subtitle">AI-generated analysis of key country relationships and conflict dynamics.</p>
      </div>

      {loading && (
        <div className="plp-loading">
          <IntelligenceLoader type="typewriter" />
        </div>
      )}

      {!loading && error && (
        <div className="plp-error">
          <p>Failed to load pair analyses: {error}</p>
        </div>
      )}

      {!loading && !error && analyses.length === 0 && (
        <div className="plp-empty">
          <p>No pair analyses available yet.</p>
        </div>
      )}

      {!loading && analyses.length > 0 && (
        <div className="plp-grid">
          {analyses.map(a => <PairCard key={a.slug} analysis={a} />)}
        </div>
      )}
    </div>
  );
}
