# world_radio

Live Spanish-language radio by country, for ear training: pick México, Perú, Ecuador, España… and hear how it's spoken there. Includes an accent roulette (guess the country of a mystery station) and favorites saved on your device.

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
- Live: not yet. A Claude artifact can't reach the station directory (its sandbox blocks outside requests), so a working link needs real hosting (GitHub Pages or Cloudflare Pages).
- Day snapshot: `2026-11-11 - world_radio` (frozen; never edited)

## Layout
- `src/core.mjs` — pure logic and the `CONFIG` object (countries, mirrors, limits). Tested in Node.
- `src/app.js` — the UI. Station text goes in as text, never HTML.
- `src/page.html` — markup and styles; `scripts/build.mjs` inlines core + UI into it.

## Ship a sprint day
```
node scripts/snapshot.mjs dist/world_radio.html            # private
node scripts/snapshot.mjs dist/world_radio.html --public   # opts in to the public sprint site
```
Commit `snapshots/` to `main` (via PR). The index's nightly refresh logs the day automatically; public pages still have to pass its UAT and secret scan.
