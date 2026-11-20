import { Link } from 'react-router';
import KindKey from '@/shared/ui/KindKey.jsx';
import { ROUTE } from '@/shared/lib/links.js';
import '@/shared/ui/blocks.css';

// SiteGuide — how the site works, SPEC §5 items 2 to 4 (round 5 R7, R8): the three kinds with their plain lines, what a step is,
// what is left out, and what each tab holds. The "?" panel and the Map's About drawer both show it. `onNavigate` runs when a
// tab link is followed (the panel closes).
const TAB_LINES = [
  ['Map', ROUTE.map, 'where the stories we follow are happening'],
  ['Today', ROUTE.today, 'today’s news, inside the story it starts or moves'],
  ['Stories', ROUTE.stories, 'every story we follow, most recently moved first'],
  ['Briefings', ROUTE.briefings, 'the day and the week, told through the stories that moved most'],
  ['Track record', ROUTE.trackRecord, 'did what we watched happen? We count only checked forecasts.'],
];

// `board`: the shell says a board backend exists (the shell may ask features/board; shared/ui may not). Then the list also
// names the Board: the public region boards, and your own once signed in.
const BOARD_LINE = ['Board', ROUTE.board, 'region boards anyone can read; sign in to build your own'];

export default function SiteGuide({ onNavigate = null, board = false }) {
  return (
    <div className="gp-guide">
      <KindKey kinds={['move', 'start', 'measure']} />
      <p>A step is one piece of news that starts, moves or measures a story.</p>
      <p>News that starts or moves no story is left out.</p>
      <ul className="gp-guide__tabs">
        {(board ? [...TAB_LINES, BOARD_LINE] : TAB_LINES).map(([label, to, line]) => <li key={label}><Link to={to} onClick={onNavigate || undefined}>{label}</Link>: {line}</li>)}
      </ul>
    </div>
  );
}
