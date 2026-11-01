'use strict';

// httpReply(statusCode, body): the JSON reply of a Function-URL Lambda, `body` serialised with JSON.stringify.
// It sets Content-Type only, never a CORS header: a Function-URL Lambda whose code emits CORS headers must have an empty
// Function-URL CORS config, otherwise the config must be populated, and the Lambdas that use this helper (newsClientErrors,
// newsSavedItems, newsRecommend) rely on the config. test/httpReply.test.js fails if a CORS header is ever added here.

function httpReply(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

module.exports = { httpReply };
