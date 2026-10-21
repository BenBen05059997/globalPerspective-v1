'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { registrableDomain, TWO_LEVEL_SUFFIXES, getOutletMeta } = require('../src/outlets');

test('registrableDomain: last two labels, three after a listed two-level suffix, www/m/amp dropped, hosts and urls accepted', () => {
  const cases = {
    'https://www.nytimes.com/a': 'nytimes.com', 'edition.cnn.com': 'cnn.com', 'M.Reuters.com': 'reuters.com', 'amp.theguardian.com': 'theguardian.com',
    'bbc.co.uk': 'bbc.co.uk', 'news.bbc.co.uk': 'bbc.co.uk', 'www.japantimes.co.jp': 'japantimes.co.jp', 'abc.net.au': 'abc.net.au',
    'www.smh.com.au': 'smh.com.au', 'x.y.com.br': 'y.com.br', 'localhost': 'localhost', '10.0.0.1': '10.0.0.1', 'm.com': 'm.com', '': '', 'https://': '',
  };
  for (const [input, want] of Object.entries(cases)) assert.strictEqual(registrableDomain(input), want, input);
});

test('the two-level suffix list is the one in decision 0036 plus net.au (abc.net.au is in the outlet table)', () => {
  assert.deepStrictEqual(TWO_LEVEL_SUFFIXES, ['co.uk', 'org.uk', 'ac.uk', 'co.jp', 'co.kr', 'co.in', 'co.za', 'com.au', 'com.br', 'com.cn', 'com.mx', 'com.ar', 'com.tr', 'net.au']);
});

test('outlet names still resolve by the stored host', () => {
  assert.strictEqual(getOutletMeta('www.bbc.co.uk').outlet, 'BBC');
  assert.strictEqual(getOutletMeta('unknown.example'), null);
});
