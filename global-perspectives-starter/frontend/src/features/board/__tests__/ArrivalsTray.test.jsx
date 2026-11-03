import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup,fireEvent,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router';
import ArrivalsTray, {viaText} from '../components/ArrivalsTray.jsx';
const {call}=vi.hoisted(()=>({call:vi.fn()}));
vi.mock('../lib/boardApi.js',()=>({callBoard:call}));
vi.mock('@/shared/api/errorSink',()=>({reportFetchError:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
const board={boardId:'b',pins:[],dismissed:[]};
it('missing record renders no panel at all',async()=>{
 call.mockResolvedValue({recordAvailable:false});const {container}=render(<ArrivalsTray board={board}/>);
 await waitFor(()=>expect(call).toHaveBeenCalledWith('visit_board',expect.anything()));expect(container.textContent).toBe('');
});
it('empty pool says so for the window',async()=>{
 call.mockResolvedValue({recordAvailable:true,since:'2026-10-18',arrivals:[]});render(<ArrivalsTray board={board}/>);
 expect(await screen.findByText('No new story touches your board in the last 14 days.')).toBeInTheDocument();
});
it('a failed read shows nothing and the unseen badge counts only cards new since the visit',async()=>{
 call.mockRejectedValue(new Error('down'));const failed=render(<ArrivalsTray board={board}/>);
 await waitFor(()=>expect(call).toHaveBeenCalled());await waitFor(()=>expect(failed.container.textContent).toBe(''));
 cleanup();call.mockReset();
 const via=[{pinId:'p1',threadId:'old',mechanism:'M',direction:'drives'}];
 call.mockResolvedValue({recordAvailable:true,since:'2026-10-18',arrivals:[{threadId:'a',title:'New one',date:'2026-10-22',strength:'strong',unseen:true,via},{threadId:'b',title:'Older one',date:'2026-10-19',strength:'strong',unseen:false,via}]});
 render(<MemoryRouter><ArrivalsTray board={board}/></MemoryRouter>);
 expect(await screen.findByText('1 unseen')).toBeInTheDocument();expect(screen.getAllByRole('button',{name:'Turn over'})).toHaveLength(2);
});
it('cards show recorded grounds and dismiss action',async()=>{
 const dismiss=vi.fn();call.mockResolvedValue({recordAvailable:true,since:'2026-10-18',arrivals:[{threadId:'story-a',title:'Recorded line',date:'2026-10-19',strength:'strong',via:[{pinId:'p1',threadId:'old',mechanism:'Recorded mechanism',direction:'driven_by'}]}]});
 render(<MemoryRouter><ArrivalsTray board={board} onDismiss={dismiss}/></MemoryRouter>);
 fireEvent.click(await screen.findByRole('button',{name:'Turn over'}));
 expect(await screen.findByText('Recorded line')).toBeInTheDocument();expect(screen.getByText(/Recorded mechanism \(driven by\)/)).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Dismiss arrival'}));expect(dismiss).toHaveBeenCalledWith('story-a');
});
it('the header count and the card labels agree: a card not new since the visit is face down but not "unseen"',async()=>{
 const via=[{pinId:'p1',threadId:'old',mechanism:'M',direction:'drives'}];
 call.mockResolvedValue({recordAvailable:true,since:'2026-10-18',arrivals:[{threadId:'b',title:'Older one',date:'2026-10-19',strength:'strong',unseen:false,via}]});
 render(<MemoryRouter><ArrivalsTray board={board}/></MemoryRouter>);
 expect(await screen.findByText('0 unseen')).toBeInTheDocument();
 expect(screen.getByText('Face down')).toBeInTheDocument();expect(screen.queryByText('Face down · unseen')).toBeNull();
});
it('via text leaves out a missing mechanism and its direction',()=>{
 expect(viaText({mechanism:'Oil prices',direction:'driven_by'},'Hormuz')).toBe('Via Hormuz: Oil prices (driven by)');
 expect(viaText({mechanism:'Oil prices'},'Hormuz')).toBe('Via Hormuz: Oil prices');
 expect(viaText({direction:'driven_by'},'Hormuz')).toBe('Via Hormuz');
});
