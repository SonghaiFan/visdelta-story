import assert from 'node:assert/strict';
import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const installed = join(root, 'node_modules/visdelta/');
assert.equal(realpathSync(installed), installed.replace(/\/$/, ''), 'Install the package, not a symlink to the library checkout.');
const manifest = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'));
const publicPaths = new Set(Object.keys(manifest.exports).map(key => key === '.' ? 'visdelta' : `visdelta${key.slice(1)}`));
let checked = 0;
function scan(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { scan(path); continue; }
    if (!/\.(?:[cm]?[jt]sx?|mdx)$/.test(entry.name)) continue;
    const source = readFileSync(path, 'utf8');
    assert(!/(?:\.\.\/)+visdelta\/(?:src|dist|website)/.test(source), `Library checkout dependency: ${path}`);
    for (const match of source.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"](visdelta(?:\/[^'"\s]+)?)['"]/g)) {
      assert(publicPaths.has(match[1]), `Private VisDelta import ${match[1]} in ${path}`); checked++;
    }
  }
}
for (const directory of ['app', 'components', 'lib', 'tests']) scan(join(root, directory));
const { bar, render, transition } = await import('visdelta');
const chart = bar([{ region: 'North', revenue: 18 }]).x('region').y('revenue');
assert.equal(chart.toSpec().mark, 'bar');
assert.notEqual(chart.highlight({ region: 'North' }), chart);
assert.equal(typeof render, 'function'); assert.equal(typeof transition, 'function');
console.log(`Public API boundary verified: ${checked} imports; installed VisDelta ${manifest.version}; no checkout symlink.`);
