'use strict';
const {makeHandler} = require('./index');
const {makeStore} = require('./store');
const {makeS3Json} = require('./_shared/s3json');
const {chat} = require('./_shared/llm');

exports.handler = async (event = {}, context = {}) => {
  const {S3Client, GetObjectCommand, PutObjectCommand} = require('@aws-sdk/client-s3');
  const client = new S3Client({});
  const bucket = process.env.WORLD_BUCKET;
  const s3json = makeS3Json({client, GetObjectCommand, PutObjectCommand, bucket});
  const timeLeft = typeof context.getRemainingTimeInMillis === 'function' ? () => context.getRemainingTimeInMillis() : undefined;
  return makeHandler({store: makeStore({s3json, client, PutObjectCommand, bucket}), chat, model: process.env.REVIEW_MODEL, concurrency: Number(process.env.REVIEW_CONCURRENCY) || undefined, timeLeft})(event);
};
