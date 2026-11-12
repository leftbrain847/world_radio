# world_radio

Live radio from every country on Earth. Search any country and play its most-voted stations, try the roulette (a mystery station plays; guess the country), and keep favorites on your device.

Stations come from the free, open [Radio Browser](https://www.radio-browser.info/) directory. Only https streams are listed (phone browsers block plain-http audio on an https page). The page plays each station's own public stream; nothing is rebroadcast or stored.

## Run
```
npm run build          # writes dist/world_radio.html (one self-contained page, no dependencies)
```
Open `dist/world_radio.html` in a browser. It needs network access to `*.api.radio-browser.info` and the stations' stream hosts.

## Test
```
npm test               # builds the page, then runs node --test (CI runs the same)
```

## Deployed
- Live: https://leftbrain847.github.io/world_radio/ (GitHub Pages; once the Pages workflow is merged and Pages source is set to GitHub Actions). A Claude artifact can't play stations: its sandbox blocks outside requests and audio.
- Day snapshot: `2026-11-11 - world_radio` (frozen; never edited)

## Layout
- `src/core.mjs` — pure logic and the `CONFIG` object (mirrors, featured countries, roulette and list limits). Tested in Node.
- `src/app.js` — the UI. Station text goes in as text, never HTML.
- `src/page.html` — markup and styles; `scripts/build.mjs` inlines core + UI into it.

## Ship a sprint day
```
node scripts/snapshot.mjs dist/world_radio.html            # private
node scripts/snapshot.mjs dist/world_radio.html --public   # opts in to the public sprint site
```
Commit `snapshots/` to `main` (via PR). The index's nightly refresh logs the day automatically; public pages still have to pass its UAT and secret scan.
