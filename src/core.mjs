// world_radio core: pure logic, no DOM. Tested in Node, inlined into the page by scripts/build.mjs.

export const CONFIG = {
  // Radio Browser mirrors, tried in order. Its docs ask apps to use a named server, not the bare domain.
  servers: ['https://de1.api.radio-browser.info', 'https://nl1.api.radio-browser.info', 'https://at1.api.radio-browser.info'],
  stationsPerCountry: 300,     // cap per country (the directory returns up to 2x this before the https/dedupe filter)
  minStationsPerCountry: 1,     // countries with fewer https stations are hidden from the picker
  rouletteMinStations: 20,      // roulette only draws from countries with at least this many stations
  rouletteCountriesPerSpin: 4,  // countries loaded per spin (answer is one of them)
  rouletteTopN: 25,
  rouletteChoices: 4,
  requestTimeoutMs: 8000,
  featured: ['US', 'GB', 'FR', 'DE', 'BR', 'JP', 'IN', 'NG', 'MX', 'AU'],
  storageKeys: { favorites: 'world_radio.favorites', streak: 'world_radio.streak', best: 'world_radio.best' },
};

export function countriesUrl(server) {
  return `${server}/json/countries?hidebroken=true&order=name`;
}

export function searchUrl(server, countryCode, cfg = CONFIG) {
  const q = new URLSearchParams({
    countrycode: countryCode,
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

// Emoji flag from an ISO 3166-1 alpha-2 code (two regional-indicator letters).
export function flag(code) {
  if (!/^[A-Z]{2}$/.test(code ?? '')) return '';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

// Short English country name from the code (the directory's names are long official ones); falls back to its name.
let regionNames = null;
export function displayName(code, fallback) {
  try {
    regionNames ??= new Intl.DisplayNames(['en'], { type: 'region' });
    const n = regionNames.of(code);
    if (n && n !== code) return n;
  } catch { /* old browser: use the directory's name */ }
  return fallback || code;
}

// Raw /json/countries rows -> [{code, name, count}] with valid codes, merged, sorted by name.
export function normalizeCountries(rows, cfg = CONFIG) {
  const by = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    const code = String(r?.iso_3166_1 ?? '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) continue;
    const count = Number.isFinite(+r.stationcount) ? +r.stationcount : 0;
    const prev = by.get(code);
    by.set(code, { code, name: prev?.name || displayName(code, clean(r.name, 60)), count: (prev?.count ?? 0) + count });
  }
  return [...by.values()].filter((c) => c.count >= cfg.minStationsPerCountry).sort((a, b) => a.name.localeCompare(b.name));
}

export function nameOf(code, countries) {
  return countries.find((c) => c.code === code)?.name ?? code;
}

// Continent of every ISO 3166-1 alpha-2 code (Central America and the Caribbean count as North America).
export const CONTINENTS = {
  Africa: 'DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU YT MA MZ NA NE NG RE RW SH ST SN SC SL SO ZA SS SD TZ TG TN UG EH ZM ZW',
  Asia: 'AF AM AZ BH BD BT BN KH CN CY GE HK IN ID IR IQ IL JP JO KZ KW KG LA LB MO MY MV MN MM NP KP OM PK PS PH QA SA SG KR LK SY TW TJ TH TL TR TM AE UZ VN YE',
  Europe: 'AX AL AD AT BY BE BA BG HR CZ DK EE FO FI FR DE GI GR GG HU IS IE IM IT JE XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SJ SE CH UA GB VA',
  'North America': 'AI AG AW BS BB BZ BM BQ VG CA KY CR CU CW DM DO SV GL GD GP GT HT HN JM MQ MX MS NI PA PR BL KN LC MF PM VC SX TT TC US VI UM',
  'South America': 'AR BO BR CL CO EC FK GF GY PY PE SR UY VE',
  Oceania: 'AS AU CK FJ PF GU KI MH FM NR NC NZ NU NF MP PW PG PN WS SB TK TO TV VU WF',
};
const CONTINENT_OF = Object.fromEntries(Object.entries(CONTINENTS).flatMap(([k, v]) => v.split(' ').map((c) => [c, k])));

export function continentOf(code) {
  return CONTINENT_OF[code] ?? 'Other';
}

export function countriesIn(countries, continent) {
  return countries.filter((c) => continentOf(c.code) === continent);
}

// No query: featured countries first, then every other country by name.
export function orderCountries(countries, featured = CONFIG.featured) {
  const first = featured.map((code) => countries.find((c) => c.code === code)).filter(Boolean);
  return [...first, ...countries.filter((c) => !featured.includes(c.code))];
}

export function filterCountries(countries, query) {
  const q = clean(query, 40).toLowerCase();
  if (!q) return countries;
  return countries.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q);
}

// Raw station rows -> playable stations: https streams only, no duplicates, best-voted first.
export function normalizeStations(rows, countryCode, cfg = CONFIG) {
  const seen = new Set();
  const out = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    const stream = r?.url_resolved || r?.url;
    if (!isHttpsUrl(stream)) continue;
    const name = clean(r.name);
    if (!name || !r.stationuuid) continue;
    const key = name.toLowerCase();
    if (seen.has(key) || seen.has(stream)) continue;
    seen.add(key);
    seen.add(stream);
    out.push({
      id: String(r.stationuuid),
      name,
      stream,
      country: countryCode,
      city: clean(r.state, 40),
      language: clean(r.language, 40).split(',')[0].trim(),
      tags: clean(r.tags, 120).split(',').map((t) => t.trim()).filter(Boolean).slice(0, 3),
      bitrate: Number.isFinite(+r.bitrate) ? +r.bitrate : 0,
      votes: Number.isFinite(+r.votes) ? +r.votes : 0,
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

export function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Countries big enough to make a fair roulette draw.
export function roulettePool(countries, cfg = CONFIG) {
  return countries.filter((c) => c.count >= cfg.rouletteMinStations).map((c) => c.code);
}

// One roulette round: a hidden station plus country choices (from allCodes) that include the answer.
export function makeRound(stationsByCountry, allCodes, rand, cfg = CONFIG) {
  const pool = Object.entries(stationsByCountry).filter(([, list]) => list.length);
  if (!pool.length) return null;
  const [answer, list] = pool[Math.floor(rand() * pool.length)];
  const top = list.slice(0, cfg.rouletteTopN);
  const station = top[Math.floor(rand() * top.length)];
  const others = shuffle([...new Set(allCodes)].filter((c) => c !== answer), rand).slice(0, cfg.rouletteChoices - 1);
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
