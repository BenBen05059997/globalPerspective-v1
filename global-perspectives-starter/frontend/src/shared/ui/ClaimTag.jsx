import '@/shared/ui/ClaimTag.css';

// ClaimTag — the one "what kind of claim is this" mark, on every page: FACT (cited dated news),
// INFERENCE (a model link / cause) or MODEL JUDGMENT (model-written text). A neutral outlined word:
// the word carries the meaning, never a colour (green is a passed check, accent is a link).
// An unknown kind renders nothing (never a blank box).
const WORD = { fact: 'FACT', inference: 'INFERENCE', judgment: 'MODEL JUDGMENT' };

export default function ClaimTag({ kind }) {
  if (!WORD[kind]) return null;
  return <span className={`claim-tag claim-tag--${kind}`}>{WORD[kind]}</span>;
}
