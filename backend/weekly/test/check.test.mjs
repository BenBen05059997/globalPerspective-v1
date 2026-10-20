import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectInputs,hashInputs} from '../selection.mjs';
import {checkWeekly} from '../check.mjs';
export function fixture(){
 const source={outlet:'a',url:'https://a.test/story',archive:'archive#2026-10-18',topicId:'topic'};
 const raw={archives:[{id:'archive#2026-10-01',entries:[{threadId:'old',topicId:'prior',title:'Talks began',sources:[{source:'A'}]}]},{id:'archive#2026-10-18',entries:[{threadId:'old',topicId:'topic',title:'Police arrested 2 suspects',sources:[{source:'A',url:source.url,snippet:'Police arrested 2 suspects after the attack.'}]}]}]};
 const days=raw.archives.map(a=>({date:a.id.slice(8),entries:a.entries.map(e=>({...e,date:a.id.slice(8),archive:a.id}))}));
 const range={from:'2026-09-12',to:'2026-10-18',days,missingDays:['2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-17']};
 const inputs=selectInputs({range,analyses:{},histories:{},driftByThread:{},snapshotsByThread:{},questions:[],web:{index:{links:[]}}},'2026-10-18');
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

test('a scenario probability cannot stand in for an absent trigger probability',()=>{
 const {week,inputs}=fixture(),story=inputs.candidates.lead[0];story.risk={score:50,tier:'elevated'};
 story.forks=[{branches:[{p:null,scenarioP:70,trigger:'A test',due:'2026-10-25'}]}];
 week.trace=[{threadId:story.threadId,title:'A trace',risk:story.risk,steps:[],branches:[{text:'A test because the mechanism persists.',p:.7,trigger:'A test',by:'2026-10-25',status:'not_checked'}]}];
 inputs.inputsHash=hashInputs(inputs);week.inputsHash=inputs.inputsHash;
 assert.ok(checkWeekly(week,inputs).errors.some(e=>e.includes('scenario probability is never substituted')));
 story.forks[0].branches[0].p=70;inputs.inputsHash=hashInputs(inputs);week.inputsHash=inputs.inputsHash;
 assert.equal(checkWeekly(week,inputs).ok,true,checkWeekly(week,inputs).errors.join('\n'));
});

test('legacy input artifacts fail with a readable migration error',()=>{const {week,inputs}=fixture();inputs.version=1;assert.match(checkWeekly(week,inputs).errors.join(' '),/normalized world/);});
