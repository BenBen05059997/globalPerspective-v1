'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validate,load}=require('./schema-validator');
for (const [file, valid] of [['valid-story', true], ['valid-index', true], ['invalid-status', false], ['invalid-index', false]]) test(`schema ${file}`, () => assert.equal(validate(load(`examples/${file}.json`)), valid, JSON.stringify(validate.errors)));
module.exports = {
  validate
};
