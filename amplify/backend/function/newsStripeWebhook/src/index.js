'use strict';

// Paddle webhook handler — creates and manages user tier records in DynamoDB.
// Replaces the previous Stripe webhook handler.
//
// Required env vars:
//   PADDLE_WEBHOOK_SECRET  — from Paddle Dashboard → Notifications → webhook secret
//   USERS_DDB_TABLE        — DynamoDB table name for user records
//
// Paddle signature header format: "ts=<unix_ts>;h1=<hmac_sha256_hex>"
// Verification: HMAC-SHA256 of "<ts>:<rawBody>" using webhook secret.

const crypto = require('crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-northeast-1';
const USERS_TABLE = process.env.USERS_DDB_TABLE;
const PADDLE_WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET;

let ddbClient = null;
const getClient = () => {
  if (!ddbClient) {
    ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return ddbClient;
};

// Verify Paddle webhook signature.
// Returns true if the signature is valid.
function verifyPaddleSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  const parts = {};
  for (const segment of signatureHeader.split(';')) {
    const idx = segment.indexOf('=');
    if (idx > 0) parts[segment.slice(0, idx)] = segment.slice(idx + 1);
  }
  const { ts, h1 } = parts;
  if (!ts || !h1) return false;
  const payload = `${ts}:${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(h1, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

// Map Paddle subscription status to our tier.
function tierFromStatus(status) {
  return (status === 'active' || status === 'trialing') ? 'member' : 'free';
}

exports.handler = async (event) => {
  if (!PADDLE_WEBHOOK_SECRET) {
    console.error('newsPaddleWebhook: missing PADDLE_WEBHOOK_SECRET');
    return { statusCode: 500, body: 'Webhook not configured' };
  }
  if (!USERS_TABLE) {
    console.error('newsPaddleWebhook: missing USERS_DDB_TABLE');
    return { statusCode: 500, body: 'Users table not configured' };
  }

  const rawBody = event.body || '';
  const sigHeader =
    event.headers?.['paddle-signature'] ||
    event.headers?.['Paddle-Signature'] ||
    '';

  if (!verifyPaddleSignature(rawBody, sigHeader, PADDLE_WEBHOOK_SECRET)) {
    console.error('newsPaddleWebhook: signature verification failed');
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid signature' }) };
  }

  let paddleEvent;
  try {
    paddleEvent = JSON.parse(rawBody);
  } catch (err) {
    console.error('newsPaddleWebhook: failed to parse body:', err.message);
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { event_type: eventType, data } = paddleEvent;
  console.info('newsPaddleWebhook received event', { eventType, eventId: paddleEvent.event_id });

  try {
    const client = getClient();

    // ── New subscription → create/upgrade user to member ───────────────────
    if (eventType === 'subscription.created') {
      const uid = data?.custom_data?.uid;
      const email = data?.customer_email || null;
      const paddleCustomerId = data?.customer_id;
      const paddleSubscriptionId = data?.id;
      const status = data?.status || 'active';

      if (!uid) {
        console.error('newsPaddleWebhook: no uid in subscription.created custom_data', {
          subscriptionId: paddleSubscriptionId,
          email,
        });
        return { statusCode: 200, body: 'ok' };
      }

      await client.send(new PutCommand({
        TableName: USERS_TABLE,
        Item: {
          uid,
          email,
          tier: tierFromStatus(status),
          paddleCustomerId,
          paddleSubscriptionId,
          subscriptionStatus: status,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }));

      console.info('newsPaddleWebhook: user created/upgraded to member', { uid, email, status });
    }

    // ── Subscription updated (payment failed, reactivated, plan change, etc.) ──
    if (eventType === 'subscription.updated') {
      const uid = data?.custom_data?.uid;
      if (!uid) {
        console.warn('newsPaddleWebhook: no uid in subscription.updated custom_data', {
          subscriptionId: data?.id,
        });
        return { statusCode: 200, body: 'ok' };
      }

      const status = data?.status || 'active';
      const tier = tierFromStatus(status);

      await client.send(new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { uid },
        UpdateExpression: 'SET tier = :tier, subscriptionStatus = :status, updatedAt = :now',
        ExpressionAttributeValues: {
          ':tier': tier,
          ':status': status,
          ':now': new Date().toISOString(),
        },
      }));

      console.info('newsPaddleWebhook: subscription updated', { uid, status, tier });
    }

    // ── Subscription cancelled → downgrade to free ─────────────────────────
    if (eventType === 'subscription.canceled') {
      const uid = data?.custom_data?.uid;
      if (!uid) {
        console.warn('newsPaddleWebhook: no uid in subscription.canceled custom_data', {
          subscriptionId: data?.id,
        });
        return { statusCode: 200, body: 'ok' };
      }

      await client.send(new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { uid },
        UpdateExpression: 'SET tier = :free, subscriptionStatus = :canceled, updatedAt = :now',
        ExpressionAttributeValues: {
          ':free': 'free',
          ':canceled': 'canceled',
          ':now': new Date().toISOString(),
        },
      }));

      console.info('newsPaddleWebhook: user downgraded to free', {
        uid,
        subscriptionId: data?.id,
      });
    }

    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    console.error('newsPaddleWebhook: processing error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Webhook processing failed' }) };
  }
};
