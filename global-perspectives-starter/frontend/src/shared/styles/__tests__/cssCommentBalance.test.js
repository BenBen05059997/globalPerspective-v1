// Guards against a CSS comment closed early by a stray "*/" (e.g. writing "--sh-*/--hue-*"
// inside a comment), which silently drops the declarations after it. Found in M1 review.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILES = ['../tokens.css', '../../../features/map/SituationHome.css'];

describe('CSS comments are balanced', () => {
  for (const f of FILES) {
    it(f, () => {
      const css = readFileSync(path.resolve(HERE, f), 'utf8');
      let depthOk = true;
      let open = false;
      for (let i = 0; i < css.length - 1; i++) {
        const two = css[i] + css[i + 1];
        if (!open && two === '/*') { open = true; i++; }
        else if (open && two === '*/') { open = false; i++; }
        else if (!open && two === '*/') { depthOk = false; break; }
      }
      expect(depthOk).toBe(true);
      expect(open).toBe(false);
    });
  }
});
