// world_radio core: pure logic, no DOM. Tested in Node, inlined into the page by scripts/build.mjs.

export const CONFIG = {
  // Radio Browser mirrors, tried in order. Its docs ask apps to use a named server, not the bare domain.
  servers: ['https://de1.api.radio-browser.info', 'https://nl1.api.radio-browser.info', 'https://at1.api.radio-browser.info'],
  language: 'spanish',
  stationsPerCountry: 60,
  rouletteTopN: 25,
  rouletteChoices: 4,
  requestTimeoutMs: 8000,
  storageKeys: { favorites: 'world_radio.favorites', streak: 'world_radio.streak', best: 'world_radio.best' },
  countries: [
    { code: 'MX', name: 'México', speech: 'es-MX' },
    { code: 'PE', name: 'Perú', speech: 'es-PE' },
    { code: 'EC', name: 'Ecuador', speech: 'es-EC' },
    { code: 'CO', name: 'Colombia', speech: 'es-CO' },
    { code: 'AR', name: 'Argentina', speech: 'es-AR' },
    { code: 'CL', name: 'Chile', speech: 'es-CL' },
    { code: 'ES', name: 'España', speech: 'es-ES' },
    { code: 'CU', name: 'Cuba', speech: 'es-CU' },
    { code: 'VE', name: 'Venezuela', speech: 'es-VE' },
    { code: 'GT', name: 'Guatemala', speech: 'es-GT' },
    { code: 'DO', name: 'Rep. Dominicana', speech: 'es-DO' },
    { code: 'PR', name: 'Puerto Rico', speech: 'es-PR' },
  ],
};

export function countryByCode(code, cfg = CONFIG) {
  return cfg.countries.find((c) => c.code === code) ?? null;
}

export function searchUrl(server, countryCode, cfg = CONFIG) {
  const q = new URLSearchParams({
    countrycode: countryCode,
    language: cfg.language,
    hidebroken: 'true',
    is_https: 'true',
    order: 'votes',
    reverse: 'true',
    limit: String(cfg.stationsPerCountry * 2), // headroom for the https / dedupe filter
  });
  return `${server}/json/stations/search?${q}`;
}

export function clickUrl(server, uuid) {
  return `${server}/json/url/${encodeURIComponent(uuid)}`;
}

const clean = (s, max = 80) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export function isHttpsUrl(u) {
  try {
    return new URL(u).protocol === 'https:';
  } catch {
    return false;
  }
}

// Raw API rows -> playable stations: https streams only, no duplicates, best-voted first.
export function normalizeStations(rows, countryCode, cfg = CONFIG) {
  const seen = new Set();
  const out = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    const stream = r?.url_resolved || r?.url;
    if (!isHttpsUrl(stream)) continue;
    const name = clean(r.name);
    if (!name || !r.stationuuid) continue;
    const key = `${name.toLowerCase()}|${stream}`;
    const nameKey = name.toLowerCase();
    if (seen.has(key) || seen.has(nameKey)) continue;
    seen.add(key);
    seen.add(nameKey);
    out.push({
      id: String(r.stationuuid),
      name,
      stream,
      country: countryCode,
      city: clean(r.state, 40),
      tags: clean(r.tags, 120).split(',').map((t) => t.trim()).filter(Boolean).slice(0, 3),
      codec: clean(r.codec, 12),
      bitrate: Number.isFinite(+r.bitrate) ? +r.bitrate : 0,
      votes: Number.isFinite(+r.votes) ? +r.votes : 0,
      homepage: isHttpsUrl(r.homepage) ? r.homepage : '',
    });
  }
  out.sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name));
  return out.slice(0, cfg.stationsPerCountry);
}

// Small seeded PRNG so roulette rounds are testable.
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// One accent-roulette round: a hidden station plus country choices that include the answer.
export function makeRound(stationsByCountry, rand, cfg = CONFIG) {
  const pool = Object.entries(stationsByCountry).filter(([, list]) => list.length);
  if (!pool.length) return null;
  const [answer, list] = pool[Math.floor(rand() * pool.length)];
  const top = list.slice(0, cfg.rouletteTopN);
  const station = top[Math.floor(rand() * top.length)];
  const others = shuffle(cfg.countries.map((c) => c.code).filter((c) => c !== answer), rand).slice(0, cfg.rouletteChoices - 1);
  return { station, answer, choices: shuffle([answer, ...others], rand) };
}

export function scoreGuess(round, guess, streak) {
  const correct = guess === round.answer;
  return { correct, streak: correct ? streak + 1 : 0 };
}

export function toggleFavorite(favs, station) {
  const has = favs.some((f) => f.id === station.id);
  return has ? favs.filter((f) => f.id !== station.id) : [...favs, { id: station.id, name: station.name, stream: station.stream, country: station.country }];
}
