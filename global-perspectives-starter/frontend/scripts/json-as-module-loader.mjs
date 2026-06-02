// Test-only loader: lets unmodified `import x from './y.json'` work under plain node
// (Vite handles this natively; node 22 otherwise demands an import attribute).
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export async function load(url, context, next) {
  if (url.endsWith('.json')) {
    const source = await readFile(fileURLToPath(url), 'utf8');
    return { format: 'module', source: `export default ${source};`, shortCircuit: true };
  }
  return next(url, context);
}
