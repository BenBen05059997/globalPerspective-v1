import EntityLink from '@/shared/ui/EntityLink.jsx';
import { COUNTRIES } from '@/shared/lib/countries.js';
import { itemPlaces, itemStoryId } from '@/features/track-record/lib/forecastPlaces.js';

// ForecastLinks — the way back from one forecast: its story (only when the item carries a real thread id;
// otherwise the title is plain text) and every country its text names. Used by the board (map panel and
// tiles) and the text version, so both pages link the same way.
export default function ForecastLinks({ item, className }) {
  const title = item.storyTitle || item.title;
  const storyId = itemStoryId(item);
  const places = itemPlaces(item);
  if (!title && places.length === 0) return null;
  return (
    <span className={className}>
      {title ? <EntityLink kind="story" id={storyId} topic={{ title }}>{title}</EntityLink> : null}
      {places.map((iso3, i) => (
        <span key={iso3}>
          {title || i > 0 ? ' · ' : ''}
          <EntityLink kind="country" id={iso3}>{COUNTRIES[iso3]?.name || iso3}</EntityLink>
        </span>
      ))}
    </span>
  );
}
