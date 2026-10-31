import '@/features/board/panels.css';

// Marks shared by the verdict, weekly and arrivals panels. Strength is a word plus a ring weight, never a colour;
// OURS is dashed (judged by us), as the board draws our strings.
export function OursBadge() {
  return <span className="pn-ours">Ours</span>;
}

export function StrengthBadge({ strength }) {
  if (!strength) return null;
  return <span className="pn-strength" data-strength={strength}>{strength}</span>;
}
