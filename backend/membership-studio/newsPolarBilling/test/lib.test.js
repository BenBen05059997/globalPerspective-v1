'use strict';

// Local logic test for the credit/billing helpers — run with `node --test` (no AWS, no
// network). Proves the bug-prone pure logic before the Polar sandbox round-trip: webhook
// signature verification, order→credits routing, pack parsing, and uid extraction.

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseCreditPacks, packCreditsByProduct, packCreditsForOrder,
  tierForStatus, extractUid, verifyPolarSignature, signPolarPayload,
} = require('../src/lib');

test('parseCreditPacks: valid object, junk, array, empty all behave', () => {
  assert.deepEqual(parseCreditPacks('{"s":{"productId":"p1","credits":50}}'), { s: { productId: 'p1', credits: 50 } });
  assert.deepEqual(parseCreditPacks('not json'), {});
  assert.deepEqual(parseCreditPacks('[1,2]'), {});      // array ⇒ {}
  assert.deepEqual(parseCreditPacks(''), {});
  assert.deepEqual(parseCreditPacks(undefined), {});
});

test('packCreditsByProduct: indexes by productId, drops malformed entries', () => {
  const packs = {
    small: { productId: 'p1', credits: 50 },
    big: { productId: 'p2', credits: 300 },
    bad1: { productId: 'p3', credits: 0 },     // 0 credits dropped
    bad2: { credits: 99 },                      // no productId dropped
  };
  assert.deepEqual(packCreditsByProduct(packs), { p1: 50, p2: 300 });
  assert.deepEqual(packCreditsByProduct({}), {});
  assert.deepEqual(packCreditsByProduct(undefined), {});
});

test('packCreditsForOrder: matches across order shapes; unknown ⇒ 0 (= membership path)', () => {
  const byProduct = { p1: 50, p2: 300 };
  assert.equal(packCreditsForOrder({ product_id: 'p1' }, byProduct), 50);
  assert.equal(packCreditsForOrder({ product: { id: 'p2' } }, byProduct), 300);
  assert.equal(packCreditsForOrder({ items: [{ product_id: 'p2' }] }, byProduct), 300);
  assert.equal(packCreditsForOrder({ line_items: [{ product: { id: 'p1' } }] }, byProduct), 50);
  assert.equal(packCreditsForOrder({ product_id: 'subscription-xyz' }, byProduct), 0); // not a pack
  assert.equal(packCreditsForOrder({}, byProduct), 0);
});

test('tierForStatus: active/trialing ⇒ member, everything else ⇒ free', () => {
  assert.equal(tierForStatus('active'), 'member');
  assert.equal(tierForStatus('trialing'), 'member');
  assert.equal(tierForStatus('canceled'), 'free');
  assert.equal(tierForStatus('past_due'), 'free');
  assert.equal(tierForStatus(undefined), 'free');
});

test('extractUid: recovers the Firebase uid from each Polar object shape', () => {
  assert.equal(extractUid({ customer: { external_id: 'u1' } }), 'u1');
  assert.equal(extractUid({ customer_external_id: 'u2' }), 'u2');
  assert.equal(extractUid({ metadata: { uid: 'u3' } }), 'u3');
  assert.equal(extractUid({ customer: { metadata: { uid: 'u4' } } }), 'u4');
  assert.equal(extractUid({}), null);
});

test('verifyPolarSignature: valid signature within the replay window passes', () => {
  const secret = 'whsec_testsecret';
  const ts = 1_700_000_000;
  const body = JSON.stringify({ type: 'order.paid', data: { id: 'ord_1' } });
  const sig = signPolarPayload(body, { id: 'msg_1', ts }, secret);
  const headers = { 'webhook-id': 'msg_1', 'webhook-timestamp': String(ts), 'webhook-signature': sig };
  assert.equal(verifyPolarSignature(body, headers, secret, ts), true);
});

test('verifyPolarSignature: tampered body, wrong secret, and replay-expired all fail', () => {
  const secret = 'whsec_testsecret';
  const ts = 1_700_000_000;
  const body = JSON.stringify({ type: 'order.paid', data: { id: 'ord_1' } });
  const sig = signPolarPayload(body, { id: 'msg_1', ts }, secret);
  const headers = { 'webhook-id': 'msg_1', 'webhook-timestamp': String(ts), 'webhook-signature': sig };

  assert.equal(verifyPolarSignature(body + 'x', headers, secret, ts), false);     // tampered body
  assert.equal(verifyPolarSignature(body, headers, 'whsec_other', ts), false);    // wrong secret
  assert.equal(verifyPolarSignature(body, headers, secret, ts + 400), false);     // >5min skew (replay)
  assert.equal(verifyPolarSignature(body, headers, '', ts), false);               // no secret
  assert.equal(verifyPolarSignature(body, { 'webhook-id': 'msg_1' }, secret, ts), false); // missing headers
});

test('verifyPolarSignature: accepts a header carrying multiple space-separated sigs', () => {
  const secret = 'whsec_testsecret';
  const ts = 1_700_000_000;
  const body = '{"ok":true}';
  const good = signPolarPayload(body, { id: 'm', ts }, secret);
  const headers = { 'webhook-id': 'm', 'webhook-timestamp': String(ts), 'webhook-signature': `v1,deadbeef ${good}` };
  assert.equal(verifyPolarSignature(body, headers, secret, ts), true);
});
