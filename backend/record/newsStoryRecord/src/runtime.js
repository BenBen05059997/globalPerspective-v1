'use strict';
const {makeHandler} = require('./index');
const {makeStore} = require('./store');
const world = require('./_shared/world');
const {makeS3Json} = require('./_shared/s3json');

exports.handler = async (event = {}) => {
  const {DynamoDBClient} = require('@aws-sdk/client-dynamodb');
  const {DynamoDBDocumentClient, GetCommand, QueryCommand, BatchGetCommand, ScanCommand} = require('@aws-sdk/lib-dynamodb');
  const {S3Client, GetObjectCommand, PutObjectCommand} = require('@aws-sdk/client-s3');
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  const s3json = makeS3Json({client: new S3Client({}), GetObjectCommand, PutObjectCommand, bucket: process.env.WORLD_BUCKET});
  const client = world.makeClient(world.makeDynamoClient({client: ddb, GetCommand, QueryCommand, BatchGetCommand, ScanCommand}), {getS3Json: s3json.getJson});
  return makeHandler({store: makeStore(client, {env: process.env}), s3json})(event);
};
