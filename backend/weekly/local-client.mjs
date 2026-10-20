// Local runner transport only. world/ owns all table schemas, query rules and normalization.
// These generic AttributeValue conversions replace the SDK transport when it is not installed locally.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';
const {makeDynamoClient,makeClient}=createRequire(import.meta.url)('../shared/src/world');
const exec=promisify(execFile);
export function decode(v) {
  if(v.S!==undefined)return v.S;if(v.N!==undefined)return Number(v.N);if(v.BOOL!==undefined)return v.BOOL;if(v.NULL)return null;
  if(v.L)return v.L.map(decode);if(v.M)return unmarshall(v.M);if(v.SS)return [...v.SS];if(v.NS)return v.NS.map(Number);throw Error('Unsupported DynamoDB AttributeValue');
}
const unmarshall=x=>Object.fromEntries(Object.entries(x).map(([k,v])=>[k,decode(v)]));
const encode=v=>v===null?{NULL:true}:typeof v==='string'?{S:v}:typeof v==='number'?{N:String(v)}:typeof v==='boolean'?{BOOL:v}:Array.isArray(v)?{L:v.map(encode)}:{M:marshall(v)};
const marshall=x=>Object.fromEntries(Object.entries(x).filter(([,v])=>v!==undefined).map(([k,v])=>[k,encode(v)]));
class Command {constructor(input){this.input=input;}}
class GetCommand extends Command {operation='get-item';}
class QueryCommand extends Command {operation='query';}
class BatchGetCommand extends Command {operation='batch-get-item';}
class ScanCommand extends Command {operation='scan';}
export function makeCliClient({run=exec,region=process.env.AWS_REGION || 'ap-northeast-1',bucket=process.env.WORLD_BUCKET || 'globalperspective-world-280362093938'}={}) {
  async function invoke(args) {return run('aws',[...args,'--region',region,'--output','json','--no-cli-pager','--cli-connect-timeout','10','--cli-read-timeout','30'],{maxBuffer:64*1024*1024,timeout:120000});}
  const transport={async send(command){
    const input={...command.input};
    for(const k of ['Key','ExpressionAttributeValues','ExclusiveStartKey'])if(input[k])input[k]=marshall(input[k]);
    if(input.RequestItems)input.RequestItems=Object.fromEntries(Object.entries(input.RequestItems).map(([table,r])=>[table,{...r,Keys:r.Keys.map(marshall)}]));
    if(command.operation==='scan' || command.operation==='query')input.Limit=100;
    const {stdout}=await invoke(['dynamodb',command.operation,'--cli-input-json',JSON.stringify(input),'--no-paginate']);
    const out=stdout.trim()?JSON.parse(stdout):{};
    if(out.Item)out.Item=unmarshall(out.Item);if(out.Items)out.Items=out.Items.map(unmarshall);
    if(out.LastEvaluatedKey)out.LastEvaluatedKey=unmarshall(out.LastEvaluatedKey);
    if(out.Responses)out.Responses=Object.fromEntries(Object.entries(out.Responses).map(([t,rs])=>[t,rs.map(unmarshall)]));
    if(out.UnprocessedKeys)out.UnprocessedKeys=Object.fromEntries(Object.entries(out.UnprocessedKeys).map(([t,r])=>[t,{...r,Keys:r.Keys.map(unmarshall)}]));
    return out;
  }};
  return makeClient(makeDynamoClient({client:transport,GetCommand,QueryCommand,BatchGetCommand,ScanCommand}),{
    async getS3Json(key){try{const {stdout}=await invoke(['s3','cp',`s3://${bucket}/${key}`,'-']);return JSON.parse(stdout);}catch(e){if(/\(404\)|NoSuchKey|Not Found/.test(e.stderr || ''))return null;throw e;}}
  });
}
