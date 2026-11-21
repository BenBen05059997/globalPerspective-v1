import { crisisHueForCategory } from '@/shared/lib/crisisHue.js';
import '@/shared/ui/blocks.css';

// LinkSign — the one sign for "this story -> the other story" (story page, Home card, board row). A SOLID square in this story's
// crisis colour (with this story's places) and a STRIPED, dashed-edged square in the other story's colour (with the other story's
// places), joined by the arrow; "fed by" flips the arrow, never which square is which. The stripe is the second sign, so the pair
// reads without colour. The board row passes `showMine={false}`: the card is this story. Squares and arrow are decoration
// (aria-hidden); the places are words, with hidden words saying which story they belong to.
//   places  { mine: [name], other: [name], same: bool } from signPlaces; null shows the squares only
//   dir     'feeds' | 'fed'
export default function LinkSign({ dir = 'feeds', mineCategory = null, otherCategory = null, places = null, showMine = true }) {
  const mineHue = crisisHueForCategory(mineCategory);
  const otherHue = crisisHueForCategory(otherCategory);
  const mine = places?.mine || [];
  const other = places?.other || [];
  const otherText = other.length ? other.join(', ') : places?.same ? 'same places' : '';
  return (
    <span className="gp-sign" data-testid="link-sign">
      {showMine ? (
        <>
          <span className="gp-sign__sw gp-sign__sw--solid" style={{ '--h': mineHue }} aria-hidden="true" />
          {mine.length ? <span className="gp-sign__places"><span className="gp-sign__sr">This story: </span>{mine.join(', ')}</span> : null}
          <span className="gp-sign__arr" style={{ '--h': dir === 'feeds' ? mineHue : otherHue }} aria-hidden="true">{dir === 'feeds' ? '→' : '←'}</span>
        </>
      ) : null}
      <span className="gp-sign__sw gp-sign__sw--stripe" style={{ '--h': otherHue }} aria-hidden="true" />
      {otherText ? <span className="gp-sign__places"><span className="gp-sign__sr">The other story: </span>{otherText}</span> : null}
    </span>
  );
}
