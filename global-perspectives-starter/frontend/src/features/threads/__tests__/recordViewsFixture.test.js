// The local record-views fixture (`npm run dev:fixture`, fixtures/record-views/) has the shape the builder writes: every file passes
// newsStoryRecord's view schema, so the story page is checked locally against data it could really receive.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.resolve(here, '../../../../fixtures/record-views');
const schemas = path.resolve(here, '../../../../../../backend/record/newsStoryRecord/schema/views');
const load = (dir, file) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
const ajv = new Ajv({ allErrors: true });
ajv.addSchema(load(schemas, 'story-stamp.schema.json'));
const SCHEMA = { stories: 'story', links: 'links', 'index/weekly.json': 'weekly-index', 'index/analyses.json': 'analyses-index', 'manifest.json': 'manifest' };
const files = (dir) => fs.readdirSync(path.join(fixtures, dir)).map((f) => `${dir}/${f}`);

describe('record-views fixture', () => {
  it.each([...files('stories'), ...files('links'), 'index/weekly.json', 'index/analyses.json', 'manifest.json'])('%s passes its view schema', (file) => {
    const validate = ajv.compile(load(schemas, `${SCHEMA[file] || SCHEMA[file.split('/')[0]]}.schema.json`));
    expect(validate(load(fixtures, file)), JSON.stringify(validate.errors)).toBe(true);
  });

  it('the story carries every case the page shows: start, moves, a measure, a late entry, an article row and a merged-in entry', () => {
    const story = load(fixtures, 'stories/thread-fixture-harbour-plan.json');
    const rows = story.entries;
    expect(rows.filter((e) => e.kind !== 'article').map((e) => e.role)).toEqual(['start', 'move', 'measure', 'move', 'move', 'move']);
    expect(rows.find((e) => e.role === 'measure').eventType).toBe('measure');
    expect(rows.some((e) => e.writtenLate)).toBe(true);
    expect(rows.some((e) => e.fromThreadId)).toBe(true);
    const article = rows.find((e) => e.kind === 'article');
    expect(article && 'role' in article).toBe(false);
    for (const e of rows) expect(e.title.startsWith('Fixture')).toBe(true); // plainly test text, never real news
  });

  it('the links file holds both directions', () => {
    const { threadId, judgedLinks } = load(fixtures, 'links/thread-fixture-harbour-plan.json');
    expect(judgedLinks.some((l) => l.from === threadId)).toBe(true);
    expect(judgedLinks.some((l) => l.to === threadId)).toBe(true);
  });
});
