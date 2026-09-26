import { usePreferences } from '@/features/account/hooks/usePreferences';
import { useMembership } from '@/features/account/hooks/useMembership';
import { useDeskChanges } from '@/features/account/hooks/useDeskChanges';
import DeskSinceLastVisit from '@/features/account/components/DeskSinceLastVisit';
import DeskFollowing from '@/features/account/components/DeskFollowing';
import { SavedPanel } from '@/features/account/components/SavedPanel';
import '@/features/account/components/Desk.css';

// Desk (A4, K1 board): the default account view — since-your-last-visit (left), following +
// saved (right). Countries only in v1 (operator decision, no story follows). No backend changes:
// everything here reads usePreferences/useMembership/country_history, which already exist.
export default function DeskPanel({ savedItems, savedLoading, onUnsave }) {
  const { isMember } = useMembership();
  const { prefs, loading: prefsLoading } = usePreferences();
  const followedCountries = prefs.followedCountries || [];

  // Only fetch country_history for members with follows — a non-member's followedCountries is
  // always empty (FollowButton gates on isMember), so this also naturally avoids empty fetches.
  const fetchCountries = isMember ? followedCountries : [];
  const { results, loading: changesLoading } = useDeskChanges(fetchCountries);

  return (
    <div className="desk-grid">
      <DeskSinceLastVisit
        isMember={isMember}
        followedCountries={followedCountries}
        countryResults={results}
        loading={prefsLoading || changesLoading}
      />
      <div className="desk-right">
        <DeskFollowing
          isMember={isMember}
          followedCountries={followedCountries}
          countryResults={results}
        />
        <section className="desk-panel desk-saved">
          <div className="desk-kicker">SAVED</div>
          <SavedPanel savedItems={savedItems} savedLoading={savedLoading} onUnsave={onUnsave} />
        </section>
      </div>
    </div>
  );
}
