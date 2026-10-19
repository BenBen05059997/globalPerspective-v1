import test from 'node:test';
import assert from 'node:assert/strict';
import { safeHttpUrl } from '../src/urls.js';

test('http and https pass, normalised', () => {
  assert.equal(safeHttpUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1');
  assert.equal(safeHttpUrl('HTTP://Example.COM'), 'http://example.com/');
  assert.equal(safeHttpUrl('  https://example.com/x  '), 'https://example.com/x');
});
test('javascript:, data:, file:, ftp:, mailto:, about: and protocol-relative are refused', () => {
  for (const u of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>1</script>', 'file:///etc/passwd', 'ftp://x.com', 'mailto:a@b.c', 'about:blank', '//evil.example/x', 'vbscript:x']) {
    assert.equal(safeHttpUrl(u), null, u);
  }
});
test('credentials in the URL, whitespace/control characters, overlong and non-strings are refused', () => {
  assert.equal(safeHttpUrl('https://user:pw@example.com/'), null);
  assert.equal(safeHttpUrl('https://exa mple.com/'), null);
  assert.equal(safeHttpUrl('https://example.com/\u0000'), null);
  assert.equal(safeHttpUrl(`https://example.com/${'a'.repeat(2100)}`), null);
  for (const v of [null, undefined, 42, {}, [], '']) assert.equal(safeHttpUrl(v), null);
});
