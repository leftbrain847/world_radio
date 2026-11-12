import { test } from 'node:test';
import assert from 'node:assert';
import { CONFIG, searchUrl, countriesUrl, clickUrl, normalizeStations, normalizeCountries, filterCountries, roulettePool, nameOf, flag, makeRound, scoreGuess, rng, toggleFavorite, isHttpsUrl } from '../src/core.mjs';
import { FIXTURE, COUNTRIES } from './fixture.mjs';

test('search asks for working https stations by votes, any language', () => {
  const u = new URL(searchUrl(CONFIG.servers[0], 'JP'));
  assert.equal(u.origin, 'https://de1.api.radio-browser.info');
  assert.equal(u.searchParams.get('countrycode'), 'JP');
  assert.equal(u.searchParams.get('language'), null, 'no language filter');
  assert.equal(u.searchParams.get('hidebroken'), 'true');
  assert.equal(u.searchParams.get('is_https'), 'true');
  assert.equal(u.searchParams.get('order'), 'votes');
  assert.match(countriesUrl('https://x'), /^https:\/\/x\/json\/countries\?/);
  assert.match(clickUrl('https://x', 'a b'), /\/json\/url\/a%20b$/);
});

test('countries: valid codes only, merged, empty ones hidden, sorted by name', () => {
  const c = normalizeCountries(COUNTRIES);
  assert.deepEqual(c.map((x) => x.code), ['JP', 'NG', 'US', 'TI'].sort((a, b) => nameOf(a, c).localeCompare(nameOf(b, c))));
  assert.equal(c.find((x) => x.code === 'JP').count, 410, 'duplicate codes merged');
  assert.ok(!c.some((x) => x.code === 'EL' || x.code === 'XYZ'));
  assert.equal(c.find((x) => x.code === 'US').name, 'United States', 'short English names');
  assert.deepEqual(normalizeCountries(null), []);
});

test('country search by name or code', () => {
  const c = normalizeCountries(COUNTRIES);
  assert.deepEqual(filterCountries(c, 'nig').map((x) => x.code), ['NG']);
  assert.deepEqual(filterCountries(c, 'us').map((x) => x.code), ['US']);
  assert.equal(filterCountries(c, '').length, c.length);
});

test('roulette pool skips small countries', () => {
  const pool = roulettePool(normalizeCountries(COUNTRIES));
  assert.ok(pool.includes('US') && pool.includes('NG'));
  assert.ok(!pool.includes('TI'));
});

test('flags from country codes', () => {
  assert.equal(flag('JP'), '\u{1F1EF}\u{1F1F5}');
  assert.equal(flag('xyz'), '');
});

test('keeps https streams only, dedupes, sorts by votes, cleans text', () => {
  const s = normalizeStations(FIXTURE.JP, 'JP');
  assert.equal(s.length, 3);
  assert.ok(s.every((x) => x.stream.startsWith('https://')));
  assert.equal(s.filter((x) => x.name === 'Radio One').length, 1, 'duplicate removed');
  for (let i = 1; i < s.length; i++) assert.ok(s[i - 1].votes >= s[i].votes);
  assert.ok(s.every((x) => !/[\u0000-\u001f]/.test(x.name)));
  assert.equal(s[0].language, 'japanese');
});

test('bad input yields an empty list, never a throw', () => {
  assert.deepEqual(normalizeStations(null, 'JP'), []);
  assert.deepEqual(normalizeStations([{ name: 'x' }, { url: 'javascript:alert(1)', name: 'y', stationuuid: '1' }], 'JP'), []);
  assert.ok(!isHttpsUrl('http://a'));
  assert.ok(!isHttpsUrl('nope'));
});

test('roulette round: answer among choices, station from that country, distractors from the pool', () => {
  const by = { JP: normalizeStations(FIXTURE.JP, 'JP'), NG: normalizeStations(FIXTURE.NG, 'NG'), US: [] };
  const pool = ['JP', 'NG', 'US', 'FR', 'BR'];
  for (let seed = 1; seed < 50; seed++) {
    const r = makeRound(by, pool, rng(seed));
    assert.ok(r.choices.includes(r.answer));
    assert.equal(new Set(r.choices).size, CONFIG.rouletteChoices);
    assert.equal(r.station.country, r.answer);
    assert.notEqual(r.answer, 'US', 'country with no stations never picked');
    assert.ok(r.choices.every((c) => pool.includes(c)));
  }
  assert.equal(makeRound({}, pool, rng(1)), null);
  assert.deepEqual(makeRound(by, pool, rng(7)), makeRound(by, pool, rng(7)), 'reproducible from a seed');
});

test('streak grows on a right guess and resets on a wrong one', () => {
  assert.deepEqual(scoreGuess({ answer: 'NG' }, 'NG', 2), { correct: true, streak: 3 });
  assert.deepEqual(scoreGuess({ answer: 'NG' }, 'JP', 5), { correct: false, streak: 0 });
});

test('favorites toggle and store only what playback needs', () => {
  const [a] = normalizeStations(FIXTURE.JP, 'JP');
  const on = toggleFavorite([], a);
  assert.deepEqual(Object.keys(on[0]).sort(), ['country', 'id', 'name', 'stream']);
  assert.deepEqual(toggleFavorite(on, a), []);
});
