// Operator-only: mint a Signal API key and print the PutItem to register its hash.
// The raw key is shown ONCE — we only ever store the sha256 hash, so it can't be
// recovered. Hand the raw key to the customer; run the printed command to activate it.
//
//   node mint-key.mjs "Acme Corp" paid 120
//   node mint-key.mjs "Free tester" free 20
//
// Then (with AWS creds for the account):
//   aws dynamodb put-item --table-name GlobalPerspectiveApiKeys --item '<printed JSON>'
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { mintKey } = require('./src/apiKeys.js');

const label = process.argv[2] || 'unlabeled';
const tier = process.argv[3] === 'paid' ? 'paid' : 'free';
const rate = Number(process.argv[4]) || (tier === 'paid' ? 120 : 20);

const { raw, keyHash } = mintKey();
const item = {
  keyHash: { S: keyHash },
  label: { S: label },
  tier: { S: tier },
  rateLimitPerMin: { N: String(rate) },
  active: { BOOL: true },
  createdAt: { S: new Date().toISOString() },
};

console.log('\n=== HAND THIS TO THE CUSTOMER (shown once) ===');
console.log('API key:', raw);
console.log('\n=== ACTIVATE (store the hash, never the key) ===');
console.log(`aws dynamodb put-item --table-name GlobalPerspectiveApiKeys --item '${JSON.stringify(item)}'`);
console.log('\nUsage:  curl -H "Authorization: Bearer ' + raw + '" <FUNCTION_URL>/v1/signals\n');
