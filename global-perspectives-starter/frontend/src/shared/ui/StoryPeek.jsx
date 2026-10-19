import Tooltip from '@/shared/ui/Tooltip.jsx';

// StoryPeek — the shared hover/focus preview for a story mention (M5a): the one Tooltip, fed from
// `peekData()` (src/shared/lib/peekData.js). Rendered only while `usePeek()` says it should be open.
export default function StoryPeek({ id, data, style }) {
  if (!data) return null;
  const { category, hue, headline, primaryCountry, sourcesLabel, updatedLabel, hint } = data;
  return (
    <Tooltip
      id={id}
      style={style}
      kicker={category}
      dot={hue || 'var(--text-dim)'}
      title={headline}
      meta={[primaryCountry, sourcesLabel]}
      note={updatedLabel}
      hint={hint}
    />
  );
}
