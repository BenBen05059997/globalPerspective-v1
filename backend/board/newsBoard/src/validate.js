'use strict';

// A small JSON Schema (draft-07 subset) validator for the board schema, so the Lambda ships no ajv. The schema
// file is the single source (src/board.schema.json is a symlink to backend/board/schema/board.schema.json).
// Supported keywords: type, enum, required, properties, additionalProperties (false | schema), items, $ref
// (#/definitions/..), minLength, maxLength, minItems, maxItems, minimum, maximum, format date-time. Anything
// else in the schema is ignored, and the test (validate.test.js) checks this agrees with ajv on the examples
// and on mutated boards, so a new keyword in the schema that is not handled here shows up there.

const SCHEMA = require('./board.schema.json');

const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const typeOk = (type, v) => {
  switch (type) {
    case 'object': return v !== null && typeof v === 'object' && !Array.isArray(v);
    case 'array': return Array.isArray(v);
    case 'string': return typeof v === 'string';
    case 'number': return typeof v === 'number' && Number.isFinite(v);
    case 'integer': return Number.isInteger(v);
    case 'boolean': return typeof v === 'boolean';
    default: return true;
  }
};

function resolve(ref, root) {
  const m = /^#\/definitions\/(.+)$/.exec(ref);
  if (!m || !root.definitions || !root.definitions[m[1]]) throw new Error(`unsupported $ref ${ref}`);
  return root.definitions[m[1]];
}

function walk(schema, value, path, errors, root) {
  if (schema.$ref) return walk(resolve(schema.$ref, root), value, path, errors, root);
  const at = path || '(board)';
  if (schema.type && !typeOk(schema.type, value)) { errors.push(`${at}: must be ${schema.type}`); return; }
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${at}: must be one of ${schema.enum.join(', ')}`);
  if (typeof value === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) errors.push(`${at}: too short (min ${schema.minLength})`);
    if (schema.maxLength != null && value.length > schema.maxLength) errors.push(`${at}: too long (max ${schema.maxLength})`);
    if (schema.format === 'date-time' && (!DATE_TIME.test(value) || Number.isNaN(Date.parse(value)))) errors.push(`${at}: must be an ISO date-time`);
  }
  if (typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum) errors.push(`${at}: must be >= ${schema.minimum}`);
    if (schema.maximum != null && value > schema.maximum) errors.push(`${at}: must be <= ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) errors.push(`${at}: needs at least ${schema.minItems} items`);
    if (schema.maxItems != null && value.length > schema.maxItems) errors.push(`${at}: at most ${schema.maxItems} items`);
    if (schema.items) value.forEach((v, i) => walk(schema.items, v, `${path}[${i}]`, errors, root));
  }
  if (typeOk('object', value)) {
    for (const k of schema.required || []) if (!(k in value)) errors.push(`${path ? `${path}.` : ''}${k}: required`);
    const props = schema.properties || {};
    for (const [k, v] of Object.entries(value)) {
      const sub = `${path ? `${path}.` : ''}${k}`;
      if (props[k]) walk(props[k], v, sub, errors, root);
      else if (schema.additionalProperties === false) errors.push(`${sub}: not allowed`);
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') walk(schema.additionalProperties, v, sub, errors, root);
    }
  }
}

/** validateBoard(board) -> { ok, errors: string[] } against board.schema.json. */
function validateBoard(board) {
  const errors = [];
  walk(SCHEMA, board, '', errors, SCHEMA);
  return { ok: errors.length === 0, errors };
}

module.exports = { validateBoard };
