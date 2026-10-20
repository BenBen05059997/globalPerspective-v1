'use strict';

// The injected-client contract. world/ never imports the AWS SDK and never shells out to the aws CLI: the caller
// passes a client, so the same readers run in a Lambda, in a local script and in a test with a fake.
//
//   client.getItem(table, key)                 -> item | null          key = { PK, SK } or { id }
//   client.query(table, pk, skPrefix?)         -> item[]               every item of partition `pk` whose SK starts
//                                                                      with skPrefix (all of them when omitted); the
//                                                                      adapter paginates
//   client.batchGet(table, keys)               -> item[]               missing keys are simply absent; the adapter
//                                                                      chunks by 100 and retries unprocessed keys
//   client.scan(table, spec)                   -> item[]               RARELY; bounded. spec = { expression, values,
//                                                                      names?, maxItems? }. Used only to list PRED#
//                                                                      rows of a date range (no index exists)
//   client.getS3Json(key)                      -> object | null        null when the key does not exist
//
// A client may leave out what its caller never reads (newsBoard's store has no scan or getS3Json).

const { makeS3Json } = require('../s3json');

const REQUIRED = ['getItem', 'query', 'batchGet', 'scan', 'getS3Json'];

/** Throws a clear error when a reader needs a client method the client lacks. */
function need(client, method) {
  if (!client || typeof client[method] !== 'function') throw new Error(`world: the client has no ${method}()`);
  return client[method].bind(client);
}

/**
 * DynamoDB adapter. `client` is a DynamoDBDocumentClient (anything with send()); the command constructors come
 * from @aws-sdk/lib-dynamodb and are passed in, so this file needs no SDK. `maxScanItems` bounds scan().
 */
function makeDynamoClient({ client, GetCommand, QueryCommand, BatchGetCommand, ScanCommand, maxScanItems = 20000 }) {
  const send = (cmd) => client.send(cmd);
  return {
    async getItem(table, key) {
      const out = await send(new GetCommand({ TableName: table, Key: key }));
      return out.Item || null;
    },
    async query(table, pk, skPrefix) {
      const items = [];
      let ExclusiveStartKey;
      do {
        const out = await send(new QueryCommand({
          TableName: table,
          KeyConditionExpression: skPrefix ? '#pk = :pk AND begins_with(#sk, :sk)' : '#pk = :pk',
          ExpressionAttributeNames: skPrefix ? { '#pk': 'PK', '#sk': 'SK' } : { '#pk': 'PK' },
          ExpressionAttributeValues: skPrefix ? { ':pk': pk, ':sk': skPrefix } : { ':pk': pk },
          ExclusiveStartKey,
        }));
        items.push(...(out.Items || []));
        ExclusiveStartKey = out.LastEvaluatedKey;
      } while (ExclusiveStartKey);
      return items;
    },
    async batchGet(table, keys) {
      const items = [];
      for (let i = 0; i < keys.length; i += 100) {
        let req = { [table]: { Keys: keys.slice(i, i + 100) } };
        for (let attempt = 0; attempt < 4 && req && Object.keys(req).length; attempt += 1) {
          const out = await send(new BatchGetCommand({ RequestItems: req }));
          items.push(...((out.Responses && out.Responses[table]) || []));
          req = out.UnprocessedKeys && Object.keys(out.UnprocessedKeys).length ? out.UnprocessedKeys : null;
        }
        if (req) throw new Error('world: batchGet left unprocessed keys after 4 attempts');
      }
      return items;
    },
    async scan(table, spec) {
      const cap = Math.min(spec.maxItems || maxScanItems, maxScanItems);
      const items = [];
      let ExclusiveStartKey;
      do {
        const out = await send(new ScanCommand({
          TableName: table,
          FilterExpression: spec.expression,
          ExpressionAttributeValues: spec.values,
          ...(spec.names ? { ExpressionAttributeNames: spec.names } : {}),
          ExclusiveStartKey,
        }));
        items.push(...(out.Items || []));
        ExclusiveStartKey = out.LastEvaluatedKey;
      } while (ExclusiveStartKey && items.length < cap);
      return items.slice(0, cap);
    },
  };
}

/** S3 adapter over s3json.getJson (null on a missing key; any other error throws, never "absence"). */
function makeS3Client({ client, GetObjectCommand, bucket }) {
  const { getJson } = makeS3Json({ client, GetObjectCommand, PutObjectCommand: null, bucket });
  return { getS3Json: getJson };
}

/** One client from a DynamoDB adapter and an S3 adapter. */
const makeClient = (dynamo, s3) => ({ ...dynamo, ...s3 });

module.exports = { REQUIRED, need, makeDynamoClient, makeS3Client, makeClient };
