import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const cors=JSON.parse(readFileSync(new URL('./client-errors-cors.json',import.meta.url)));
test('CORS preserves existing public origins and narrowly adds www/development origins',()=>{
 assert.deepEqual(cors.AllowMethods,['POST']);assert.deepEqual(cors.AllowHeaders,['content-type']);assert.equal(cors.MaxAge,3600);
 for(const origin of ['https://globalperspective.net','https://benben05059997.github.io','https://www.globalperspective.net','http://localhost:5173','http://localhost:5174','http://127.0.0.1:5173','http://127.0.0.1:5174'])assert.ok(cors.AllowOrigins.includes(origin));
 assert.equal(cors.AllowOrigins.length,7);assert.ok(!cors.AllowOrigins.includes('*'));assert.ok(!cors.AllowCredentials);
 const source=readFileSync(new URL('../../read-api/newsClientErrors/src/index.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/['"]Access-Control-Allow-Origin['"]\s*:/);
});
