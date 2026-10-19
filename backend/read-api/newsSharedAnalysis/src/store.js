// DynamoDB access for shares (table GlobalPerspectiveShares: PK `id`; GSI `uid-createdAt-index`, KEYS_ONLY).
// Every function takes the document client so tests can inject a fake; index.js builds the real one lazily.
export function makeStore({ client, table, commands }) {
  const { GetCommand, PutCommand, DeleteCommand, QueryCommand } = commands;
  return {
    async put(item) {
      try {
        await client.send(new PutCommand({ TableName: table, Item: item, ConditionExpression: 'attribute_not_exists(id)' }));
        return true;
      } catch (e) {
        if (e && e.name === 'ConditionalCheckFailedException') return false;
        throw e;
      }
    },
    async get(id) {
      const r = await client.send(new GetCommand({ TableName: table, Key: { id } }));
      return r.Item || null;
    },
    // the caller has already checked ownership; the condition makes the delete race-safe
    async deleteOwned(id, uid) {
      try {
        await client.send(new DeleteCommand({ TableName: table, Key: { id }, ConditionExpression: 'uid = :u', ExpressionAttributeValues: { ':u': uid } }));
        return true;
      } catch (e) {
        if (e && e.name === 'ConditionalCheckFailedException') return false;
        throw e;
      }
    },
    async countSince(uid, sinceIso) {
      const r = await client.send(new QueryCommand({
        TableName: table, IndexName: 'uid-createdAt-index', Select: 'COUNT',
        KeyConditionExpression: 'uid = :u AND createdAt >= :s', ExpressionAttributeValues: { ':u': uid, ':s': sinceIso },
      }));
      return r.Count || 0;
    },
  };
}
