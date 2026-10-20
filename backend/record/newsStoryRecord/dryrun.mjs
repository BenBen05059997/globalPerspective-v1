#!/usr/bin/env node
// Read-only AWS CLI adapter. No SDK, API keys, LLM imports, or AWS mutation commands.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  makeHandler,
  validDate
} = require('./src/index');
const {
  makeStore
} = require('./src/store');
const {
  makeS3Json
} = require('./src/_shared/s3json');
const args = process.argv.slice(2);
const flag = n => args[args.indexOf(n) + 1];
if (!args.includes('--date') || !args.includes('--out') || !args.includes('--no-llm')) throw Error('usage: dryrun.mjs --date YYYY-MM-DD --out <dir> --no-llm');
const date = flag('--date');
validDate(date);
const out = resolve(flag('--out'));
mkdirSync(out, {
  recursive: true
});
const bucket = 'globalperspective-world-280362093938';
const region = 'ap-northeast-1';
const aws = (service, op, values) => {
  if (!['dynamodb:get-item', 'dynamodb:query', 'dynamodb:scan', 's3api:get-object'].includes(`${service}:${op}`)) throw Error('read-only adapter rejected operation');
  return JSON.parse(execFileSync('aws', [service, op, ...values, '--region', region, '--output', 'json', '--no-cli-pager'], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024
  }));
};
function unmarshal(v) {
  if ('S' in v) return v.S;
  if ('N' in v) return Number(v.N);
  if ('BOOL' in v) return v.BOOL;
  if ('NULL' in v) return null;
  if ('SS' in v) return v.SS;
  if ('NS' in v) return v.NS.map(Number);
  if ('L' in v) return v.L.map(unmarshal);
  if ('M' in v) return Object.fromEntries(Object.entries(v.M).map(([k, v]) => [k, unmarshal(v)]));
  throw Error('unsupported DynamoDB value');
}
const marshal = o => JSON.stringify(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, {
  S: v
}])));
function pages(op, base) {
  let key;
  const items = [];
  do {
    const r = aws('dynamodb', op, [...base, '--limit', '100', '--no-paginate', ...(key ? ['--exclusive-start-key', JSON.stringify(key)] : [])]);
    items.push(...(r.Items || []).map(r => unmarshal({
      M: r
    })));
    key = r.LastEvaluatedKey;
  } while (key);
  return items;
}
const temp = mkdtempSync(join(tmpdir(), 'record-read-'));
const webRead = key => {
  const file = join(temp, 'web.json');
  try {
    aws('s3api', 'get-object', ['--bucket', bucket, '--key', key, file]);
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    if (/NoSuchKey|Not Found|\(404\)/.test(String(e.stderr))) return null;
    throw e;
  }
};
const io = {
  get: async (table, key) => {
    const r = aws('dynamodb', 'get-item', ['--table-name', table, '--key', marshal(key)]);
    return r.Item ? unmarshal({
      M: r.Item
    }) : null;
  },
  scan: async (table, filter, values) => pages('scan', ['--table-name', table, '--filter-expression', filter, '--expression-attribute-values', marshal(values)]),
  query: async (table, pk) => pages('query', ['--table-name', table, '--key-condition-expression', 'PK = :pk', '--expression-attribute-values', marshal({
    ':pk': pk
  })]),
  web: async date => {
    let web = webRead(`web/${date.replaceAll('-', '/')}.json`);
    if (web) return web;
    web = webRead('web/latest.json');
    return String(web?.generatedAt || web?.index?.generatedAt || '').slice(0, 10) <= date ? web : null;
  }
};
// Route would-be S3 commands through the actual shared helper to a local-only fake client.
class Get {
  constructor(input) {
    this.input = input;
  }
}
class Put {
  constructor(input) {
    this.input = input;
  }
}
const s3json = makeS3Json({
  bucket,
  GetObjectCommand: Get,
  PutObjectCommand: Put,
  client: {
    async send(command) {
      const i = command.input;
      const path = resolve(out, i.Key);
      if (!path.startsWith(`${out}/`)) throw Error('unsafe object key');
      if (command instanceof Get) {
        if (!existsSync(path)) throw Object.assign(Error('missing'), {
          name: 'NoSuchKey'
        });
        return {
          Body: {
            transformToString: async () => readFileSync(path, 'utf8')
          }
        };
      }
      mkdirSync(dirname(path), {
        recursive: true
      });
      try {
        writeFileSync(path, i.Body, {
          flag: i.IfNoneMatch ? 'wx' : 'w'
        });
      } catch (e) {
        if (e.code === 'EEXIST') throw Object.assign(e, {
          name: 'PreconditionFailed'
        });
        throw e;
      }
      return {};
    }
  }
});
console.error(`Reading live stores for ${date}; AWS read-only, local shadow output ${out}`);
const report = await makeHandler({
  store: makeStore(io),
  s3json,
  llm: null,
  now: () => `${date}T05:45:00Z`
})({
  date,
  shadow: true
});
writeFileSync(join(out, `report-${date}.json`), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
