import '@/features/threads/components/ClaimTag.css';

// ClaimTag — the one "what kind of claim is this" mark on the story pages: FACT (cited dated news),
// INFERENCE (a model link / cause) or MODEL JUDGMENT (model-written text). A neutral outlined word:
// the word carries the meaning, never a colour (green is a passed check, accent is a link).
const WORD = { fact: 'FACT', inference: 'INFERENCE', judgment: 'MODEL JUDGMENT' };

export default function ClaimTag({ kind }) {
  return <span className={`claim-tag claim-tag--${kind}`}>{WORD[kind]}</span>;
}
