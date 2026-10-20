'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const {readFileSync}=require('node:fs');const {resolve}=require('node:path');const {createRequire}=require('node:module');
// Same existing frontend Ajv used by the board/weekly schema tests. An isolated worktree
// can point FRONTEND_NODE_MODULES at the main checkout's installed dependencies.
const requireFrontend=createRequire(resolve(process.env.FRONTEND_NODE_MODULES || 'global-perspectives-starter/frontend/node_modules','ajv/package.json'));
const Ajv=requireFrontend('ajv');const ajv=new Ajv({allErrors:true,strict:false});
const load=name=>JSON.parse(readFileSync(resolve(__dirname,'../schema',name),'utf8'));
const validate=ajv.compile(load('story-record.schema.json'));
for(const [file,valid] of [['valid-story',true],['valid-index',true],['invalid-status',false],['invalid-index',false]])test(`schema ${file}`,()=>assert.equal(validate(load(`examples/${file}.json`)),valid,JSON.stringify(validate.errors)));
module.exports={validate};
