'use strict';

// The one reader of the world's raw tables. See README.md. Nobody else parses these rows.

const client = require('./client');
const dates = require('./dates');
const readers = require('./readers');
const derive = require('./derive');
const tier = require('./tier');

module.exports = { ...client, ...dates, ...readers, ...derive, ...tier };
