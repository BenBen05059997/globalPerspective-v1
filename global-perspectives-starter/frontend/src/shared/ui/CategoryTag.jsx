import { crisisDotVar } from '@/shared/lib/crisisHue';
import '@/shared/ui/blocks.css';

// CategoryTag — a topic as a neutral outlined text tag with a small dot in the crisis hue of its crisis type (no dot when the topic maps to none). The topic
// palette never fills the tag (a fill is a second palette on the dark frame); the word carries
// the meaning, the dot is a hint. Renders nothing without a category.
export default function CategoryTag({ category, className = '' }) {
  if (!category) return null;
  const dot = crisisDotVar(category);
  return (
    <span className={`gp-cat ${className}`.trim()} data-dot={dot ? 'on' : 'off'} style={{ '--cat-dot': dot }}>
      {category}
    </span>
  );
}
