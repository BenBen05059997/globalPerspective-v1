'use strict';

// newsPredictionsSnapshot — precompute the forecast track-record aggregate to S3 (S8·T3).
//
// The /track-record page used to make the newsSensitiveData proxy Scan ~5.5k PredictionLog items
// on EVERY load (the table's 2nd-hottest read path, ~12.5k reads/day). This scheduled builder does
// that Scan ONCE per cadence and writes the finished aggregate to `predictions/track_record.json`;
// the proxy reads that object and only falls back to a live Scan if it is missing.
//
// PredictionLog STAYS in DynamoDB — it is a legitimately mutable per-record store (the resolver
// updates trigger verdicts in place; `prediction_snapshot` does point Queries). This is a
// read-optimization, not a table migration. See DATA_STRATEGY.md §6 + PREDICTION_METHODOLOGY_V1_PLAN.md.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { computeTrackRecord } = require('./trackRecord');

const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const PREDICTION_LOG_TABLE = process.env.PREDICTION_LOG_TABLE || 'GlobalPerspectivePredictionLog';
const WORLD_BUCKET = process.env.WORLD_BUCKET || 'globalperspective-world-280362093938';
const TRACK_RECORD_KEY = process.env.TRACK_RECORD_KEY || 'predictions/track_record.json';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});
const s3 = new S3Client({ region: REGION });

async function scanAll() {
  const items = [];
  let ExclusiveStartKey;
  do {
    const res = await ddb.send(new ScanCommand({
      TableName: PREDICTION_LOG_TABLE,
      ProjectionExpression: 'title, category, generatedAt, scenarios, methodologyVersion',
      ExclusiveStartKey,
    }));
    items.push(...(res.Items || []));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

exports.handler = async () => {
  const items = await scanAll();
  const data = computeTrackRecord(items);
  const body = JSON.stringify({ builtAt: new Date().toISOString(), data });
  await s3.send(new PutObjectCommand({
    Bucket: WORLD_BUCKET, Key: TRACK_RECORD_KEY, Body: body, ContentType: 'application/json',
  }));
  console.log(`[predictions-snapshot] scanned ${items.length} → v1=${data.totalPredictionsLogged} resolved=${data.resolvedTriggers} brier=${data.brierScore}`);
  return { ok: true, scanned: items.length, ...data };
};
