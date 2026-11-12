// End to end from a clean clone: npm test builds the page first; this checks the built page is whole and safe.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { BUILD, inlineCore, render } from '../scripts/build.mjs';

const html = readFileSync(new URL(`../${BUILD.out}`, import.meta.url), 'utf8');

test('built page is one self-contained document', () => {
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /<title>\d{4}-\d{2}-\d{2} - world_radio<\/title>/);
  assert.ok(!/__(TITLE|CORE|APP)__/.test(html));
  assert.ok(!/<script[^>]+src=/i.test(html), 'no external scripts');
  assert.ok(!/<link[^>]+stylesheet/i.test(html), 'no external styles');
  assert.ok(!/\bexport\s+(function|const)/.test(html), 'core inlined without exports');
});

test('built script parses and core functions are present', () => {
  const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
  assert.doesNotThrow(() => new Function(script));
  for (const fn of ['normalizeStations', 'normalizeCountries', 'makeRound', 'searchUrl']) assert.ok(script.includes(`function ${fn}`));
});

test('station text never goes in as HTML', () => {
  const app = readFileSync(new URL(`../${BUILD.app}`, import.meta.url), 'utf8');
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(app));
});

test('private snapshot rule: page never mentions the public tag', () => {
  assert.ok(!/sprint-public/i.test(html));
});

test('build refuses broken templates', () => {
  assert.throws(() => render({ page: '<html></html>', core: '', app: '', title: 't' }), /lacks/);
  assert.throws(() => inlineCore("import x from 'y'"), /must not import/);
});
