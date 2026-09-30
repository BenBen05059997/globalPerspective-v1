// StoryLinkNote — the honest "no linked stories" lines (lib/linkStates.js). Renders nothing while a
// story is linked or while nothing is known yet.
export default function StoryLinkNote({ note }) {
  if (!note || !note.lines?.length) return null;
  return (
    <div className="sm-link-note" data-testid="story-link-note" data-state={note.key}>
      <p className="sm-link-note-lead">{note.lines[0]}</p>
      {note.lines.slice(1).map((l) => <p key={l} className="sm-link-note-more">{l}</p>)}
    </div>
  );
}
