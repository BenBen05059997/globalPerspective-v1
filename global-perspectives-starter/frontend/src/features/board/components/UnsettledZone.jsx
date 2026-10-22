import Card from '@/shared/ui/Card.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import { sumCounts } from '@/features/board/lib/recordProjection.js';
// This week's facts that no weekly review has read yet (0037 section 6): counts only, no sentences and no line.
export default function UnsettledZone({ ids, counts }) {
  const { byDate, loading, error, week, since, visit } = counts;
  const generated = week.some((d) => byDate[d]);
  const total = sumCounts(byDate, week, ids);
  const fresh = since ? sumCounts(byDate, since, ids).newEntries : 0;
  return <Card as="section" aria-label="This week, unsettled"><SectionHeader label="This week, unsettled" as="h2" />
    {loading ? <p className="board-line">Loading this week’s counts.</p>
      : error ? <p className="board-line">This week’s counts could not be read.</p>
        : !generated ? <p className="board-line">This week’s counts are not generated yet.</p>
          : total.newEntries || total.branchesDue || total.verdicts
            ? <p className="board-line">this week, unsettled: {total.newEntries} new entries, {total.branchesDue} branches due, {total.verdicts} verdicts</p>
            : <p className="board-line">Nothing new this week.</p>}
    {!loading && !error && fresh > 0 ? <p className="board-note">{fresh} new entries since {visit}</p> : null}
  </Card>;
}
