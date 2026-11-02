'use strict';

// s3NoteWriter(prefix): the note writer (notes.js makeNoteWriter) over the world bucket, built the one way every note-writing
// Lambda builds it: bucket env WORLD_BUCKET (default the world store), region env AWS_REGION (default ap-northeast-1), the S3
// client required on first use so a Lambda that never writes loads without the SDK. `prefix` is where the notes live
// ('record/' or 'record/shadow/'); the caller decides whether to write at all (NOTES_PREFIX gating stays in each caller).
// Used by briefNotes.js and the recordNotes.js of the five analysis Lambdas.
const notes = require('./notes');
const {makeS3Json} = require('./s3json');

const DEFAULT_WORLD_BUCKET = 'globalperspective-world-280362093938';

function s3NoteWriter(prefix) {
  const {S3Client, GetObjectCommand, PutObjectCommand} = require('@aws-sdk/client-s3');
  const client = new S3Client({region: process.env.AWS_REGION || 'ap-northeast-1'});
  const bucket = process.env.WORLD_BUCKET || DEFAULT_WORLD_BUCKET;
  return notes.makeNoteWriter({s3json: makeS3Json({client, GetObjectCommand, PutObjectCommand, bucket}), prefix});
}

module.exports = {s3NoteWriter, DEFAULT_WORLD_BUCKET};
