import { CATEGORY_DOT } from '@/shared/styles/tokens';
import '@/shared/ui/blocks.css';

// CategoryTag — a topic as a neutral outlined text tag with a small category dot. The topic
// palette never fills the tag (a fill is a second palette on the dark frame); the word carries
// the meaning, the dot is a hint. Renders nothing without a category.
export default function CategoryTag({ category, className = '' }) {
  if (!category) return null;
  const key = String(category).toLowerCase();
  return (
    <span className={`gp-cat ${className}`.trim()} style={{ '--cat-dot': CATEGORY_DOT[key] || undefined }}>
      {category}
    </span>
  );
}
