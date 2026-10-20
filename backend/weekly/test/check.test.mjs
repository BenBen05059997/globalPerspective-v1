import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectInputs} from '../selection.mjs';
import {checkWeekly} from '../check.mjs';
export function fixture(){
 const source={outlet:'A',url:'https://a.test/story',archive:'archive#2026-10-18',topicId:'topic'};
 const inputs=selectInputs({archives:[{id:'archive#2026-10-01',entries:[{threadId:'old',topicId:'prior',title:'Talks began',sources:[{source:'A'}]}]},{id:'archive#2026-10-18',entries:[{threadId:'old',topicId:'topic',title:'Police arrested 2 suspects',sources:[{source:'A',url:source.url,snippet:'Police arrested 2 suspects after the attack.'}]}]}],summary:[],predictions:[],web:{}},'2026-10-18');
 const j=text=>({text,label:'judgment',confidence:'low'});
 const week={weekEnding:inputs.weekEnding,status:'draft',generatedAt:'2026-10-20T00:00:00Z',producer:'test',inputsHash:inputs.inputsHash,lead:{headline:'Police arrests',threadId:'old',happened:{text:'Police arrested 2 suspects after the attack.',sources:[source]},argument:j('The arrests may constrain the attackers because police can question the suspects.'),expect:j('We expect further investigation because police have suspects in custody.'),wouldProveWrong:{condition:'The suspects are released without charges.',by:'2026-10-25'}},moved:[],trace:[],dates:[],new:[],coverage:{...inputs.coverage},notes:{unconfirmed:[]}};
 return {week,inputs};
}
test('checked draft passes, word reports do not enforce email caps',()=>{const {week,inputs}=fixture();week.lead.argument.text='Because police have suspects, further questioning may follow '+ 'carefully '.repeat(150);const r=checkWeekly(week,inputs);assert.equal(r.ok,true,r.errors.join('\n'));assert.ok(r.reports[0].includes('over target'));});
test('hash tampering and mismatched weekly hash are rejected',()=>{const {week,inputs}=fixture();inputs.coverage.entries++;assert.ok(checkWeekly(week,inputs).errors.some(e=>e.includes('modified')));week.inputsHash='bad';assert.ok(checkWeekly(week,inputs).errors.some(e=>e.includes('does not match')));});
test('schema labels, unknown threads, invented numbers and foreign citations fail',()=>{for(const mutate of [w=>delete w.lead.expect.label,w=>w.lead.threadId='invented',w=>w.lead.happened.text='Police arrested 999 suspects',w=>w.lead.happened.sources[0].url='https://forged.test']){const {week,inputs}=fixture();mutate(week);const r=checkWeekly(week,inputs);assert.equal(r.ok,false);}});
test('past test dates and impossible dates fail',()=>{for(const by of ['2026-10-18','2026-02-30']){const {week,inputs}=fixture();week.lead.wouldProveWrong.by=by;assert.ok(checkWeekly(week,inputs).errors.some(e=>e.includes('after the week')));}});
test('coverage, candidate membership, and unsupported due dates fail',()=>{const {week,inputs}=fixture();week.coverage.stories=500;week.dates=[{date:'2026-10-25',what:'Invented deadline',kind:'scheduled'}];week.new=[{threadId:'old'}];const e=checkWeekly(week,inputs).errors;assert.ok(e.some(s=>s.includes('coverage.stories')));assert.ok(e.some(s=>s.includes('selected candidates')));assert.ok(e.some(s=>s.includes('logged next-week')));});

test('a future but ungrounded test date is rejected',()=>{const {week,inputs}=fixture();week.lead.wouldProveWrong.by='2026-12-31';assert.ok(checkWeekly(week,inputs).errors.some(e=>e.includes('date is absent')));});
