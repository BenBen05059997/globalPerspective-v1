import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import StoryTree from '../components/StoryTree.jsx';
import BoardWeekly from '../components/BoardWeekly.jsx';
import story from '../dev/recordExamples/valid-story.json';
import { boardWeek } from '../lib/recordProjection.js';
afterEach(cleanup);
describe('record views', () => {
  it('missing tree renders only its documented empty line', () => {
    const { container } = render(<StoryTree />);
    expect(container.textContent).toBe('Branch status starts when the story record goes live.');
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('schema example exposes its logged late branch and no invented line', () => {
    render(<StoryTree story={story} />);
    expect(screen.getByText('No dated one-line read has been written for this story.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'chapters' }));
    expect(screen.getByText('No chapter has been recorded for this story.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'forks and events' }));
    expect(screen.getByText(/The named event occurs · 65% · late 2026-10-19/)).toBeInTheDocument();
    expect(screen.getByText(/Due date passed without established trigger/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'event' }));
    expect(screen.getByText('Choose a dated event from the trunk to read its evidence.')).toBeInTheDocument();
  });
  it('weekly absent records never invent changes or counts', () => {
    render(<BoardWeekly board={{pins: [], strings: [], recordAvailable: false}} stories={{}} />);
    expect(screen.getByText('Pin changes start when the story record goes live.')).toBeInTheDocument();
    expect(screen.getByText('Branch status starts when the story record goes live.')).toBeInTheDocument();
    expect(screen.queryByText(/65%/)).toBeNull();
  });
  it('weekly uses dated changes within its seven-day window only', () => {
    const board = {pins: [{pinId: 'p1', line: 'A dated move', lastMoved: '2026-10-19'}], strings: [{a:'p1', b:'p2', keptAt:'2026-10-19', cutAt:'2026-09-01'}]};
    const week = boardWeek(board, {a:story}, new Date('2026-10-20T12:00:00Z'));
    expect(week.moved).toHaveLength(1); expect(week.strings).toHaveLength(1); expect(week.branches).toHaveLength(0);
  });
});
