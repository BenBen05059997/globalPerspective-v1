'use strict';

// DynamoDB record IO for the settle flow. Every write is a conditional put that refuses to
// overwrite (immutable rows). All record families live in GlobalPerspectivePredictionLog; none of
// them carries `methodologyVersion`, so the legacy aggregators and resolve-v1-*.js ignore them.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

function makeStore(table, region) {
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), { marshallOptions: { removeUndefinedValues: true } });

  async function scan(params) {
    const items = [];
    let ExclusiveStartKey;
    do {
      const r = await ddb.send(new ScanCommand({ TableName: table, ExclusiveStartKey, ...params }));
      items.push(...(r.Items || []));
      ExclusiveStartKey = r.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    return items;
  }

  return {
    async putOnce(item) {
      try {
        await ddb.send(new PutCommand({ TableName: table, Item: item, ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)' }));
        return true;
      } catch (e) {
        if (e.name === 'ConditionalCheckFailedException') return false;
        throw e;
      }
    },
    async get(PK, SK) {
      const r = await ddb.send(new GetCommand({ TableName: table, Key: { PK, SK } }));
      return r.Item || null;
    },
    // COMMIT rows of every week (small).
    listCommits() {
      return scan({ FilterExpression: 'begins_with(PK, :p) AND SK = :s', ExpressionAttributeValues: { ':p': 'SEED#', ':s': 'COMMIT' } });
    },
    // PRED rows issued in [fromDay, toDay] that use the question schema.
    predRows(fromDay, toDay) {
      return scan({
        FilterExpression: 'begins_with(PK, :p) AND SK BETWEEN :a AND :b AND attribute_exists(questionSchema)',
        ExpressionAttributeValues: { ':p': 'PRED#', ':a': fromDay, ':b': toDay },
      });
    },
    // every Q# row (SAMPLED / DRAFT# / VERDICT), grouped by the caller
    listQuestionRows() {
      return scan({ FilterExpression: 'begins_with(PK, :p)', ExpressionAttributeValues: { ':p': 'Q#' } });
    },
    async queryPK(PK) {
      const r = await ddb.send(new QueryCommand({ TableName: table, KeyConditionExpression: 'PK = :p', ExpressionAttributeValues: { ':p': PK } }));
      return r.Items || [];
    },
  };
}

module.exports = { makeStore };
