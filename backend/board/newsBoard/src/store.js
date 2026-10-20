'use strict';

// The DynamoDB access newsBoard needs, behind one small interface so tests inject an in-memory store.
//   store.getBoards(uid) -> item[]            store.getBoard(uid, boardId) -> item | null
//   store.putBoard(item)                      store.deleteBoard(uid, boardId)
//   store.getFollows(uid) -> {followedThreads, followedActors}
//   store.setFollows(uid, {followedThreads?, followedActors?})   SET on exactly the attributes given
//   store.getItem(table, key) -> item | null  store.batchGet(table, keys) -> item[]
//   store.query(table, pk, skPrefix, pkName='PK', skName='SK') -> item[]

const BOARD_PREFIX = 'board#';

function makeStore(env = process.env) {
  const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, QueryCommand, UpdateCommand, BatchGetCommand } = require('@aws-sdk/lib-dynamodb');
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: env.AWS_REGION || 'ap-northeast-1' }), { marshallOptions: { removeUndefinedValues: true } });
  return makeStoreOn((cmd) => ddb.send(cmd), { GetCommand, PutCommand, DeleteCommand, QueryCommand, UpdateCommand, BatchGetCommand }, env);
}

// Split from makeStore so a test can pass a fake `send` and read the command inputs.
function makeStoreOn(send, C, env = process.env) {
  const SAVED = env.SAVED_ITEMS_TABLE;
  const PREFS = env.USER_PREFS_TABLE;

  async function query(table, pk, skPrefix, pkName = 'PK', skName = 'SK') {
    const items = [];
    let ExclusiveStartKey;
    do {
      const out = await send(new C.QueryCommand({
        TableName: table,
        KeyConditionExpression: `#pk = :pk AND begins_with(#sk, :sk)`,
        ExpressionAttributeNames: { '#pk': pkName, '#sk': skName },
        ExpressionAttributeValues: { ':pk': pk, ':sk': skPrefix },
        ExclusiveStartKey,
      }));
      items.push(...(out.Items || []));
      ExclusiveStartKey = out.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    return items;
  }

  return {
    getBoards: (uid) => query(SAVED, uid, BOARD_PREFIX, 'uid', 'savedKey'),
    async getBoard(uid, boardId) {
      const out = await send(new C.GetCommand({ TableName: SAVED, Key: { uid, savedKey: `${BOARD_PREFIX}${boardId}` } }));
      return out.Item || null;
    },
    async setLastVisited(uid, boardId, stamp) {
      await send(new C.UpdateCommand({TableName:SAVED, Key:{uid,savedKey:`${BOARD_PREFIX}${boardId}`},
        UpdateExpression:'SET lastVisitedAt = :stamp', ExpressionAttributeValues:{':stamp':stamp},
        ConditionExpression:'attribute_exists(uid) AND attribute_exists(savedKey)'}));
    },
    async putBoard(item) { await send(new C.PutCommand({ TableName: SAVED, Item: item })); },
    async deleteBoard(uid, boardId) { await send(new C.DeleteCommand({ TableName: SAVED, Key: { uid, savedKey: `${BOARD_PREFIX}${boardId}` } })); },
    async getFollows(uid) {
      const out = await send(new C.GetCommand({ TableName: PREFS, Key: { uid }, ProjectionExpression: 'followedThreads, followedActors' }));
      const it = out.Item || {};
      return { followedThreads: it.followedThreads || [], followedActors: it.followedActors || [] };
    },
    // SET only the attributes given: followedCountries, the opt-ins and everything else stay untouched.
    async setFollows(uid, fields) {
      const keys = Object.keys(fields).filter((k) => k === 'followedThreads' || k === 'followedActors');
      if (!keys.length) return;
      await send(new C.UpdateCommand({
        TableName: PREFS,
        Key: { uid },
        UpdateExpression: `SET ${keys.map((k) => `${k} = :${k}`).join(', ')}`,
        ExpressionAttributeValues: Object.fromEntries(keys.map((k) => [`:${k}`, fields[k]])),
      }));
    },
    query,
    async getItem(table, key) {
      const out = await send(new C.GetCommand({ TableName: table, Key: key }));
      return out.Item || null;
    },
    async batchGet(table, keys) {
      const items = [];
      for (let i = 0; i < keys.length; i += 100) {
        let req = { [table]: { Keys: keys.slice(i, i + 100) } };
        for (let attempt = 0; attempt < 4 && req && Object.keys(req).length; attempt += 1) {
          const out = await send(new C.BatchGetCommand({ RequestItems: req }));
          items.push(...((out.Responses && out.Responses[table]) || []));
          req = out.UnprocessedKeys && Object.keys(out.UnprocessedKeys).length ? out.UnprocessedKeys : null;
        }
      }
      return items;
    },
  };
}

module.exports = { makeStore, makeStoreOn, BOARD_PREFIX };
