// The AWS SDK for the record CLIs: the Lambdas get it from the runtime, a local run loads it from the working directory or from
// RECORD_SDK_DIR (RECOVER_SDK_DIR still works), a scratch directory with `npm i --no-save @aws-sdk/client-s3 @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb`.
import { createRequire } from 'node:module';
import path from 'node:path';

export function requireSdk(name) {
  const dirs = [process.cwd(), process.env.RECORD_SDK_DIR, process.env.RECOVER_SDK_DIR].filter(Boolean);
  for (const d of dirs) {
    try { return createRequire(path.join(d, 'x.js'))(name); } catch { /* try next */ }
  }
  throw new Error(`${name} not found: run \`npm i --no-save ${name}\` in a scratch directory and set RECORD_SDK_DIR to it`);
}

export const REGION = process.env.AWS_REGION || 'ap-northeast-1';
