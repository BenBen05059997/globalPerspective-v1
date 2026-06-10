// Standalone unit test for the breaking-news significance scorer + renderer.
// No AWS, no network — run with: node test-significance.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { scoreStory, isBreaking, effectiveThreshold, SIGNIFICANCE_THRESHOLD, CONTINUATION_THRESHOLD_MULT } = require('./significance.js');
const { renderAlert } = require('./render.js');

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}`); }
}

console.log('significance.scoreStory');

// An ordinary, low-signal story must NOT clear the threshold (silence is correct).
const ordinary = scoreStory({ sourceCount: 2, topicCount: 1, riskScore: 10, econMagnitude: null });
ok('ordinary story stays below threshold', !isBreaking(ordinary));

// A war/crisis story (high country risk) should clear it on risk alone.
const crisis = scoreStory({ sourceCount: 5, topicCount: 2, riskScore: 85, econMagnitude: null });
ok('high-risk crisis clears threshold', isBreaking(crisis));
ok('crisis reasons mention country risk', crisis.reasons.some((r) => r.includes('risk')));

// A widely-covered, multi-angle market shock should clear via popularity+breadth+econ.
const shock = scoreStory({ sourceCount: 9, topicCount: 4, riskScore: 30, econMagnitude: 'large' });
ok('broad market shock clears threshold', isBreaking(shock));
ok('shock reasons mention market impact', shock.reasons.some((r) => r.includes('market')));

// Monotonicity: more sources never lowers the score.
const a = scoreStory({ sourceCount: 3, topicCount: 1, riskScore: 0, econMagnitude: null });
const b = scoreStory({ sourceCount: 8, topicCount: 1, riskScore: 0, econMagnitude: null });
ok('more sources → higher (or equal) score', b.score >= a.score);

// Magnitude ordering: large > moderate > small > none.
const mNone = scoreStory({ econMagnitude: null }).score;
const mSmall = scoreStory({ econMagnitude: 'small' }).score;
const mMod = scoreStory({ econMagnitude: 'moderate' }).score;
const mLarge = scoreStory({ econMagnitude: 'large' }).score;
ok('magnitude ordering large>moderate>small>none', mLarge > mMod && mMod > mSmall && mSmall > mNone);

// Empty input must not throw and must be below threshold.
const empty = scoreStory({});
ok('empty signals → 0-ish, not breaking', empty.score >= 0 && !isBreaking(empty));

console.log('\nnovelty / velocity / continuation');

// Velocity raises the score: a story accelerating beats the same story flat.
const flat = scoreStory({ sourceCount: 6, topicCount: 4, riskScore: 20, velocity: 0 });
const accelerating = scoreStory({ sourceCount: 6, topicCount: 4, riskScore: 20, velocity: 5 });
ok('velocity raises score', accelerating.score > flat.score);
ok('high velocity shows in reasons', accelerating.reasons.some((r) => r.includes('accelerating')));

// Continuation faces a raised bar.
ok('continuation threshold is higher', effectiveThreshold(2.0, true) === 2.0 * CONTINUATION_THRESHOLD_MULT);
ok('new-event threshold is the base', effectiveThreshold(2.0, false) === 2.0);

// A modest story that clears as a NEW event must NOT clear as a continuation (no escalation)...
const modest = scoreStory({ sourceCount: 7, topicCount: 3, riskScore: 40, velocity: 0 });
ok('modest story clears as new event', modest.score >= effectiveThreshold(SIGNIFICANCE_THRESHOLD, false));
ok('same story suppressed as a flat continuation', modest.score < effectiveThreshold(SIGNIFICANCE_THRESHOLD, true));
// ...but a genuine escalation (high velocity) carries a continuation over the raised bar.
const escalating = scoreStory({ sourceCount: 9, topicCount: 6, riskScore: 70, velocity: 6 });
ok('escalating continuation still clears the raised bar', escalating.score >= effectiveThreshold(SIGNIFICANCE_THRESHOLD, true));

console.log(`\nthreshold = ${SIGNIFICANCE_THRESHOLD}`);
console.log('  ordinary:', ordinary.score, '| crisis:', crisis.score, '| shock:', shock.score);

console.log('\nrender.renderAlert');

// Renderer only includes sections with content (honesty contract).
const full = renderAlert({
  title: 'Strait of Hormuz closure threatens oil supply',
  category: 'conflict',
  regions: ['Iran', 'United States'],
  threadUrl: 'https://globalperspective.net/weekly/thread/thread-hormuz-abc',
  summary: '- Iran announced a partial closure.\n- Brent jumped on the open.',
  prediction: 'Expect coordinated naval response within days.',
  economic: { direction: 'up', magnitude: 'large' },
  traceCause: {
    proximate: { what: 'New sanctions took effect', when: 'this week' },
    contributing: [{ factor: 'Talks stalled', evidence: 'Vienna lapsed' }],
    structural: { factor: 'Chokepoint with no substitute', depth: 'decades' },
    alternativePerspective: 'Tehran calls it defensive.',
    signalVsNoise: { verdict: 'True Signal', confidence: 'High' },
  },
  sources: [{ title: 'Reuters', url: 'https://reuters.com/x' }],
  editorNote: 'This is the story to watch this week.',
});
ok('subject is prefixed Breaking:', full.subject.startsWith('Breaking:'));
ok('body includes editor note', full.text.includes('story to watch'));
ok('body includes WHAT HAPPENED', full.text.includes('WHAT HAPPENED'));
ok('body includes OUR READ', full.text.includes('OUR READ'));
ok('body includes market impact', full.text.includes('MARKET IMPACT'));
ok('body includes source link', full.text.includes('reuters.com/x'));
ok('text includes HOW WE GOT HERE (trace)', full.text.includes('HOW WE GOT HERE'));
ok('text trace shows root cause', full.text.includes('Root cause:') && full.text.includes('no substitute'));
ok('text trace shows signal verdict', full.text.includes('Signal vs noise: True Signal'));
ok('html includes How we got here', full.html.includes('How we got here'));
ok('html trace shows underreported angle', full.html.includes('Underreported angle') && full.html.includes('defensive'));

// Trace omitted entirely when absent (honesty).
const noTrace = renderAlert({ title: 'No trace', summary: '- a thing happened' });
ok('no trace section when traceCause missing', !noTrace.text.includes('HOW WE GOT HERE') && !noTrace.html.includes('How we got here'));
// Unusable trace object → omitted, not rendered empty.
const emptyTrace = renderAlert({ title: 'Empty trace', traceCause: { contributing: [] } });
ok('unusable trace omitted', !emptyTrace.text.includes('HOW WE GOT HERE'));

// Sparse story: missing sections must simply be absent, not show placeholders.
const sparse = renderAlert({ title: 'Quiet development', sources: [] });
ok('sparse: no WHAT HAPPENED section', !sparse.text.includes('WHAT HAPPENED'));
ok('sparse: no SOURCES section', !sparse.text.includes('SOURCES'));
ok('sparse: no empty placeholder text', !/undefined|null|\[object/.test(sparse.text));

console.log('\nrender HTML');
ok('html is a full document', full.html.startsWith('<!doctype html>'));
ok('html carries brand masthead', full.html.includes('Global Perspectives'));
ok('html has a CTA to the thread', full.html.includes('Read the full analysis') && full.html.includes('thread-hormuz-abc'));
ok('html uses table layout (email-safe)', full.html.includes('role="presentation"'));
ok('html has no undefined/null leakage', !/>(\s*)(undefined|null)(\s*)</.test(full.html));
// XSS / injection safety: angle brackets in story fields must be escaped.
const evil = renderAlert({ title: 'Hack <script>alert(1)</script>', summary: 'a & b < c' });
ok('html escapes <script> in title', !evil.html.includes('<script>alert(1)</script>') && evil.html.includes('&lt;script&gt;'));
ok('html escapes ampersand in body', evil.html.includes('a &amp; b &lt; c'));
ok('sparse html omits Sources section', !sparse.html.includes('>Sources<') && !sparse.html.toLowerCase().includes('what happened'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
