#!/usr/bin/env node
// Builds dist/world_radio.html: one self-contained page (core + UI inlined, no build deps).
//   node scripts/build.mjs [--title "YYYY-MM-DD - world_radio"]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dayIn } from './snapshot.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const BUILD = { out: 'dist/world_radio.html', page: 'src/page.html', core: 'src/core.mjs', app: 'src/app.js' };

// `export` keywords out, so the module's functions are plain declarations inside the page's one script.
export function inlineCore(src) {
  if (/^\s*import\s/m.test(src)) throw new Error('core.mjs must not import anything');
  return src.replace(/^export\s+(?=(async\s+)?(function|const|let|class)\b)/gm, '');
}

export function render({ page, core, app, title }) {
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  for (const mark of ['__TITLE__', '__CORE__', '__APP__']) if (!page.includes(mark)) throw new Error(`page.html lacks ${mark}`);
  if (/<\/script/i.test(core + app)) throw new Error('script source must not contain </script');
  return page.replace('__TITLE__', () => esc(title)).replace('__CORE__', () => inlineCore(core)).replace('__APP__', () => app);
}

export function build({ title } = {}) {
  const cfg = JSON.parse(readFileSync(join(root, 'sprint.config.json'), 'utf8'));
  const html = render({
    page: readFileSync(join(root, BUILD.page), 'utf8'),
    core: readFileSync(join(root, BUILD.core), 'utf8'),
    app: readFileSync(join(root, BUILD.app), 'utf8'),
    title: title ?? `${dayIn(cfg.timeZone)} - ${cfg.project}`,
  });
  const out = join(root, BUILD.out);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const i = process.argv.indexOf('--title');
  console.log(`build: ${build({ title: i > 0 ? process.argv[i + 1] : undefined })}`);
}
