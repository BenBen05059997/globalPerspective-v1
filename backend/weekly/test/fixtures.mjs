import {readInputs} from '../pull.mjs';
import {selectInputs} from '../selection.mjs';
export function fakeClient(raw) {
  const rows=[...(raw.archives || []),...(raw.summary || []),...(raw.predictions || [])];
  const sameKey=(r,k)=>Object.entries(k).every(([key,value])=>r[key]===value);
  return {
    async getItem(table,key){return rows.find(r=>sameKey(r,key)) || null;},
    async batchGet(table,keys){return keys.map(k=>rows.find(r=>sameKey(r,k))).filter(Boolean);},
    async query(table,pk,prefix){return rows.filter(r=>r.PK===pk && (!prefix || r.SK?.startsWith(prefix)));},
    async scan(){throw Error('Unexpected table scan in fixture');},
    async getS3Json(key){return raw.objects?.[key] || (key==='web/latest.json'?raw.web:null) || null;},
  };
}
export const readerOptions=raw=>({countries:[],readQuestions:async()=>raw.questions || []});
export async function normalized(raw,week='2026-10-18'){return readInputs(week,fakeClient(raw),readerOptions(raw));}
export async function selected(raw,week='2026-10-18'){return selectInputs(await normalized(raw,week),week);}
export const entry=(id,title='Police arrested suspects',outlets=['A','B'])=>({threadId:id,topicId:id,title,sources:outlets.map(source=>({source,url:`https://${source}.test/${id}`}))});
export const history=(id,date,score,trajectory='The talks continue')=>({PK:`THREAD#${id}`,SK:`THREAD_HISTORY#${date}`,riskScore:score,trajectory});
export function rawFixture(){return {archives:[{id:'archive#2026-10-01',entries:[entry('old')]},{id:'archive#2026-10-12',entries:[entry('linked','Navy seized a ship',['A']),entry('risk'),entry('report','Annual report warns of losses'),entry('noise')]},{id:'archive#2026-10-18',entries:[entry('old')]}],summary:[history('old','2026-10-11',40),history('old','2026-10-16',52),history('old','2026-10-18',53),history('risk','2026-10-18',65),history('report','2026-10-18',90),history('noise','2026-10-18',24),{PK:'THREAD#old',SK:'DRIFT#2026-10-16',whyChanged:'Talks stalled'}],predictions:[],web:{index:{links:[{from:'linked',to:'old'}]}}};}
