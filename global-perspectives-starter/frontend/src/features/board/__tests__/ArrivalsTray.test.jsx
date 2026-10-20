import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup,fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router';
import ArrivalsTray from '../components/ArrivalsTray.jsx';
const {call}=vi.hoisted(()=>({call:vi.fn()}));
vi.mock('../lib/boardApi.js',()=>({callBoard:call}));
vi.mock('@/shared/api/errorSink',()=>({reportFetchError:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
const board={boardId:'b',pins:[],dismissed:[]};
it('missing record shows its exact reason and no cards',async()=>{
 call.mockResolvedValue({recordAvailable:false});render(<ArrivalsTray board={board}/>);
 expect(await screen.findByText('Arrivals start when the story record goes live.')).toBeInTheDocument();expect(screen.queryByRole('button')).toBeNull();
});
it('empty record shows the actual prior visit',async()=>{
 call.mockResolvedValue({recordAvailable:true,since:'2026-10-18T01:00:00Z',arrivals:[]});render(<ArrivalsTray board={board}/>);
 expect(await screen.findByText('No new story touches your board since 2026-10-18.')).toBeInTheDocument();
});
it('cards show recorded grounds and dismiss action',async()=>{
 const dismiss=vi.fn();call.mockResolvedValue({recordAvailable:true,since:'2026-10-18',arrivals:[{threadId:'story-a',title:'Recorded line',date:'2026-10-19',strength:'strong',via:[{pinId:'p1',threadId:'old',mechanism:'Recorded mechanism'}]}]});
 render(<MemoryRouter><ArrivalsTray board={board} onDismiss={dismiss}/></MemoryRouter>);
 expect(await screen.findByText('Recorded line')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Dismiss arrival'}));expect(dismiss).toHaveBeenCalledWith('story-a');
});
