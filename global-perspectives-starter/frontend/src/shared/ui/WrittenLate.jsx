import { writtenLateText } from '@/shared/lib/writtenLate.js';
import '@/shared/ui/blocks.css';

// WrittenLate — the one quiet line under a story/entry that was written after its run slot (decision 0061):
// "Written 16 Nov from articles saved on 15 Nov". Plain text. Renders nothing without a valid marker.
export default function WrittenLate({ entry, className }) {
  const text = writtenLateText(entry);
  return text ? <p className={['gp-late', className].filter(Boolean).join(' ')}>{text}</p> : null;
}
