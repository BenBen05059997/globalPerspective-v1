import AiResultCard from '@/features/home/components/AiResultCard';
import Button from '@/shared/ui/Button.jsx';

// Bullet renderer: "- " markers become a list; anything else is one paragraph.
function SummaryContent({ text }) {
  if (!text) return null;
  const normalized = String(text)
    .replace(/\*\*(.+?)\*\*/g, '$1') // drop bold markers
    .replace(/\r\n/g, '\n')
    .trim();

  // Split on bullet markers "- " while keeping sentences intact.
  const parts = normalized
    .split(/\n?\s*-\s+/)
    .map(part => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) return <p className="ai-summary-p">{normalized}</p>;

  return (
    <ul className="ai-summary-list">
      {parts.map((paragraph, idx) => <li key={`summary-part-${idx}`}>{paragraph}</li>)}
    </ul>
  );
}

/** SummaryDisplay — a story's AI key takeaways (AiResultCard frame). */
const SummaryDisplay = ({ summary, isLoading, error, onRetry, onClear, isCollapsed = false, onToggleCollapse, lastActive }) => (
  <AiResultCard
    title="AI Key Takeaways" loadingText="Generating concise summary" what="Summary"
    hasResult={!!summary} isLoading={isLoading} error={error} onRetry={onRetry} onClear={onClear}
    isCollapsed={isCollapsed} onToggleCollapse={onToggleCollapse} lastActive={lastActive}
  >
    <div className="ai-result-content">
      <SummaryContent text={summary?.content} />
      <div className="ai-result-foot">
        <span>Fast-Track Summary v1.0</span>
        <Button variant="icon" compact label="Close" onClick={onClear}>✕</Button>
      </div>
    </div>
  </AiResultCard>
);

export default SummaryDisplay;
