import Card from '@/shared/ui/Card.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import { sumCounts } from '@/features/board/lib/recordProjection.js';
import { dueCounts } from '@/features/board/lib/branchDays.js';
import { dayMonth } from '@/shared/lib/branchWording.js';
// This week's facts that no weekly review has read yet (0037 section 6): counts only, no sentences and no line.
// New entries and verdicts are the record's daily counts; "branches due" is read from the pinned stories with the same
// helper as the due strip and the monthly, so the numbers agree. A failed read shows nothing (the loader reports it).
export default function UnsettledZone({ ids, counts, stories, today }) {
  const { byDate, loading, error, week, since, visit } = counts;
  const generated = week.some((d) => byDate[d]);
  const counted = sumCounts(byDate, week, ids);
  const due = dueCounts(stories, today);
  const total = { ...counted, branchesDue: due.dueThisWeek };
  const fresh = since ? sumCounts(byDate, since, ids).newEntries : 0;
  if (error || (!loading && !generated)) return null; // counts failed or not generated yet: nothing to show
  return <Card as="section" aria-label="This week, unsettled"><SectionHeader label="This week, unsettled" as="h2" />
    {loading ? <p className="board-line">Loading this week’s counts.</p>
      : !generated ? null
        : total.newEntries || total.branchesDue || total.verdicts || due.late
          ? <p className="board-line">this week, unsettled: {total.newEntries} new entries, {total.branchesDue} branches due, {total.verdicts} verdicts{due.late ? `, ${due.late} past due` : ''}</p>
          : <p className="board-line">Nothing new this week.</p>}
    {!loading && fresh > 0 && dayMonth(visit) ? <p className="board-note">{fresh} new entries since {dayMonth(visit)}</p> : null}
  </Card>;
}
