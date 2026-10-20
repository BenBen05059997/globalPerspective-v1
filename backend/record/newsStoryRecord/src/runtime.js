'use strict';

// Deployment entry point; never imported by the local runner. No credentials are read locally.
const {
  makeHandler
} = require('./index');
const {
  makeStore
} = require('./store');
const {
  makeS3Json
} = require('./_shared/s3json');
exports.handler = async (event = {}) => {
  const {
    DynamoDBClient
  } = require('@aws-sdk/client-dynamodb');
  const {
    DynamoDBDocumentClient,
    GetCommand,
    QueryCommand,
    ScanCommand
  } = require('@aws-sdk/lib-dynamodb');
  const {
    S3Client,
    GetObjectCommand,
    PutObjectCommand
  } = require('@aws-sdk/client-s3');
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  const s3json = makeS3Json({
    client: new S3Client({}),
    GetObjectCommand,
    PutObjectCommand,
    bucket: process.env.WORLD_BUCKET
  });
  const all = async (Command, args) => {
    const rows = [];
    let key;
    do {
      const r = await ddb.send(new Command({
        ...args,
        Limit: 100,
        ...(key ? {
          ExclusiveStartKey: key
        } : {})
      }));
      rows.push(...(r.Items || []));
      key = r.LastEvaluatedKey;
    } while (key);
    return rows;
  };
  const io = {
    get: async (TableName, Key) => (await ddb.send(new GetCommand({
      TableName,
      Key
    }))).Item,
    scan: (TableName, FilterExpression, ExpressionAttributeValues) => all(ScanCommand, {
      TableName,
      FilterExpression,
      ExpressionAttributeValues
    }),
    query: (TableName, pk) => all(QueryCommand, {
      TableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': pk
      }
    }),
    web: async date => {
      const dated = await s3json.getJson(`web/${date.replaceAll('-', '/')}.json`);
      if (dated) return dated;
      const latest = await s3json.getJson('web/latest.json');
      return String(latest?.generatedAt || latest?.index?.generatedAt || '').slice(0, 10) <= date ? latest : null;
    }
  };
  const {
    chat,
    parseJsonContent
  } = require('./_shared/llm');
  // No default model choice: coordinator must set the operator's selected model.
  if (!process.env.RECORD_LLM_MODEL && !event.noLlm) throw Error('RECORD_LLM_MODEL required');
  const llm = event.noLlm ? null : async prompt => {
    const r = await chat({
      step: `record_${prompt.task}`,
      model: process.env.RECORD_LLM_MODEL,
      user: JSON.stringify(prompt),
      maxTokens: 1200,
      temperature: 0,
      json: true
    });
    return parseJsonContent(r.content);
  };
  return makeHandler({
    store: makeStore(io, {
      cache: process.env.TOPICS_DDB_TABLE,
      summary: process.env.SUMMARIZE_PREDICT_TABLE,
      predictions: process.env.PREDICTION_LOG_TABLE
    }),
    s3json,
    llm
  })({
    ...event,
    shadow: event.shadow ?? true
  });
};
