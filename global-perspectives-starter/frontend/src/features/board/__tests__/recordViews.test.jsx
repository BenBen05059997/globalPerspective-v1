import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import RecordPinDetails from '../components/RecordPinDetails.jsx';
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

it('populated schema-compatible tree keeps dated lines, chapters, event sources and dead/resurrected history', () => {
  const populated = structuredClone(story);
  populated.line = {text:'The named event remains the test',writtenAt:'2026-10-19',label:'JUDGMENT',confidence:0.7,versions:[]};
  populated.chapters = [{startedAt:'2026-10-19',name:'Report phase',text:'The ministry report becomes the test',writtenAt:'2026-10-19',label:'JUDGMENT',confidence:0.7}];
  populated.events = [{date:'2026-10-19',archive:'archive#2026-10-19',topicId:'topic-a',headline:'The named report appears',outlets:[{outlet:'Ministry',url:'https://example.org/report'}],killed:[]}];
  populated.forks[0].branches[0].status = ['hold','dead','resurrected','fired'].map((status,i)=>({date:`2026-10-${16+i}`,status,evidence:[],note:`Recorded ${status}`,label:'JUDGMENT',confidence:0.8}));
  render(<StoryTree story={populated}/>);
  expect(screen.getByText(/The named event remains the test/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'chapters'}));expect(screen.getByText(/Report phase/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'forks and events'}));
  for(const status of ['hold','dead','resurrected','fired'])expect(screen.getByText(new RegExp(`Recorded ${status}`))).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'The named report appears'}));
  expect(screen.getByRole('link',{name:'Ministry'})).toHaveAttribute('href','https://example.org/report');
});
it('populated weekly shows only recorded changes', () => {
  const populated=structuredClone(story);populated.forks[0].branches[0].status[0].status='dead';
  populated.links=[{otherThreadId:'story-b',confirmed:true,strength:'strong',mechanism:'Recorded transmission',since:'2026-10-19'}];
  render(<BoardWeekly board={{recordAvailable:true,pins:[{pinId:'p1',line:'Recorded move',lastMoved:'2026-10-19'}],strings:[{a:'p1',b:'p2',owner:'yours',line:'My line',keptAt:'2026-10-19'}]}} stories={{a:populated}} now={new Date('2026-10-20T12:00:00Z')}/>);
  expect(screen.getByText('Recorded move')).toBeInTheDocument();expect(screen.getByText(/My line/)).toBeInTheDocument();expect(screen.getByText(/Recorded transmission/)).toBeInTheDocument();expect(screen.getByText(/The named event occurs: dead/)).toBeInTheDocument();
});

it('pin details render no text for absent or partial unknown data, while retaining actual zero counts', () => {
  const {container,rerender}=render(<RecordPinDetails pin={{counts:{}}}/>);
  expect(container.textContent).toBe('');
  rerender(<RecordPinDetails pin={{counts:{chapters:0}}}/>);
  expect(container.textContent).toBe('0 chapters');
});
