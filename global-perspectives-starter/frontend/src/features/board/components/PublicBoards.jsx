// PublicBoards: /board for a visitor who is not signed in (board look SPEC §1, §2, §6). The list: the theme boards
// ("Linked stories", from themes.json), the sign-in line, then the region boards. With ?theme= or ?preset= it opens that
// board. Both lists are public reads; a list that failed is left out (its hook reported it), and with both failed the page
// says so. While they load, only the heading and the sentence show.
import { Link } from 'react-router';
import { boardHref } from '@/shared/lib/links.js';
import Button from '@/shared/ui/Button.jsx';
import Card from '@/shared/ui/Card.jsx';
import CategoryTag from '@/shared/ui/CategoryTag.jsx';
import PageLine from '@/shared/ui/PageLine.jsx';
import SectionHeader from '@/shared/ui/SectionHeader.jsx';
import { shortDay } from '@/shared/ui/StoryCard.jsx';
import { useThemes } from '@/features/board/hooks/useThemes.js';
import { themeTitle, themeNewest, themesByNewest, themeCategories, presetLinks } from '@/features/board/lib/linkedBoard.js';
import LinkedBoard, { CENTRE, themeDiagram } from '@/features/board/components/LinkedBoard.jsx';
import PresetsPanel from '@/features/board/components/PresetsPanel.jsx';

const MAX_TAGS = 4;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const themeHref = (id) => `${boardHref()}?theme=${encodeURIComponent(id)}`;

function ThemeCard({ theme }) {
  const cats = themeCategories(theme);
  const newest = themeNewest(theme);
  return (
    <li>
      <Card as="article" className="bl-theme">
        <h3 className="bl-theme__title">{themeTitle(theme)}</h3>
        <p className="bl-theme__facts">{plural((theme.stories || []).length, 'story', 'stories')} · {plural((theme.links || []).length, 'judged link', 'judged links')}</p>
        {newest ? <p className="bl-theme__facts">Newest step {shortDay(newest)}</p> : null}
        {cats.length ? (
          <p className="bl-theme__tags">
            {cats.slice(0, MAX_TAGS).map((c) => <CategoryTag key={c} category={c} />)}
            {cats.length > MAX_TAGS ? <span className="bl-theme__more">+{cats.length - MAX_TAGS}</span> : null}
          </p>
        ) : null}
        <Link className="board-link" to={themeHref(theme.themeId)} aria-label={`Open the board: ${themeTitle(theme)}`}>Open the board →</Link>
      </Card>
    </li>
  );
}

function themeRows(theme) {
  return (theme.stories || []).map((s) => ({ ...s, id: s.threadId }));
}

function presetRows(preset) {
  return (preset.pins || []).filter((p) => p.kind === 'thread').map((p) => ({ id: p.refId, title: p.title, riskScore: p.riskScore ?? null }));
}

export default function PublicBoards({ search, presets, signIn }) {
  const themes = useThemes();
  const params = new URLSearchParams(search);
  const themeId = params.get('theme');
  const presetId = params.get('preset');

  if (themeId || presetId) {
    const theme = themeId ? themes.themes.find((t) => t.themeId === themeId) : null;
    const preset = presetId ? presets.presets.find((p) => p.presetId === presetId) : null;
    const settled = themeId ? !themes.loading : !presets.loading;
    if (theme) {
      return <><LinkedBoard key={theme.themeId} kind="theme" title={themeTitle(theme)} rows={themeRows(theme)} links={theme.links || []} shared={theme.shared || []} diagram={themeDiagram(theme)} />{signIn}</>;
    }
    if (preset) {
      const { links, shared } = presetLinks(preset);
      return <><LinkedBoard key={preset.presetId} kind="region" title={preset.name} region={preset.region} rows={presetRows(preset)} links={links} shared={shared} diagram={{ pins: preset.pins, strings: preset.strings }} />{signIn}</>;
    }
    if (!settled) return <div className="bl-board" aria-busy="true"><PageLine>{CENTRE}</PageLine></div>;
    return (
      <div className="bl-board">
        <p className="board-line">This board is no longer listed.</p>
        <Link className="board-link" to={boardHref()}>← All boards</Link>
        {signIn}
      </div>
    );
  }

  const shownThemes = themesByNewest(themes.themes);
  const bothFailed = themes.failed && presets.failed;
  return (
    <>
      <h1 className="board-title">Board</h1>
      <PageLine>{CENTRE}</PageLine>
      {shownThemes.length ? (
        <section className="bl-section" aria-label="Linked stories">
          <SectionHeader as="h2" label="Linked stories" count={shownThemes.length} />
          <p className="board-line">Groups of stories our model judged to feed into each other.</p>
          <ul className="bl-themes">{shownThemes.map((t) => <ThemeCard key={t.themeId} theme={t} />)}</ul>
        </section>
      ) : null}
      {signIn}
      {bothFailed ? <p className="board-line">The boards could not be loaded.</p> : null}
      {presets.presets.length ? (
        <Card as="section" aria-label="Stories touching a region">
          <SectionHeader label="Stories touching a region" as="h2" />
          <PresetsPanel presets={presets.presets} loading={presets.loading} />
        </Card>
      ) : null}
    </>
  );
}

/** The sign-in line and button, as live (kept on every public board view). */
export function SignInLine({ returnTo }) {
  return (
    <div className="bl-signin">
      <div><Button variant="primary" to={`/signin?returnTo=${encodeURIComponent(returnTo)}`}>Sign in to build your own board</Button></div>
      <p className="board-line">With a free account, you can build and save your own boards, test connections between pins and see the verdicts, follow stories and actors, and see new arrivals since your last visit.</p>
    </div>
  );
}
