import { test } from 'node:test';
import assert from 'node:assert';
import { CONFIG, searchUrl, clickUrl, normalizeStations, makeRound, scoreGuess, rng, toggleFavorite, isHttpsUrl, countryByCode } from '../src/core.mjs';
import { FIXTURE } from './fixture.mjs';

test('search asks for Spanish, https, working stations by votes', () => {
  const u = new URL(searchUrl(CONFIG.servers[0], 'PE'));
  assert.equal(u.origin, 'https://de1.api.radio-browser.info');
  assert.equal(u.searchParams.get('countrycode'), 'PE');
  assert.equal(u.searchParams.get('language'), 'spanish');
  assert.equal(u.searchParams.get('hidebroken'), 'true');
  assert.equal(u.searchParams.get('is_https'), 'true');
  assert.equal(u.searchParams.get('order'), 'votes');
  assert.match(clickUrl('https://x', 'a b'), /\/json\/url\/a%20b$/);
});

test('keeps https streams only, dedupes, sorts by votes, cleans text', () => {
  const s = normalizeStations(FIXTURE.MX, 'MX');
  assert.ok(s.length >= 3);
  assert.ok(s.every((x) => x.stream.startsWith('https://')));
  assert.ok(!s.some((x) => x.name.includes('HTTP Only')));
  assert.equal(s.filter((x) => x.name === 'Radio Uno').length, 1, 'duplicate removed');
  for (let i = 1; i < s.length; i++) assert.ok(s[i - 1].votes >= s[i].votes);
  assert.ok(s.every((x) => !/[\u0000-\u001f]/.test(x.name)));
  assert.ok(s.every((x) => x.homepage === '' || x.homepage.startsWith('https://')), 'non-https homepages dropped');
});

test('bad input yields an empty list, never a throw', () => {
  assert.deepEqual(normalizeStations(null, 'MX'), []);
  assert.deepEqual(normalizeStations([{ name: 'x' }, { url: 'javascript:alert(1)', name: 'y', stationuuid: '1' }], 'MX'), []);
  assert.ok(!isHttpsUrl('http://a'));
  assert.ok(!isHttpsUrl('nope'));
});

test('roulette round: answer is among choices, station from that country', () => {
  const by = { MX: normalizeStations(FIXTURE.MX, 'MX'), PE: normalizeStations(FIXTURE.PE, 'PE'), AR: [] };
  for (let seed = 1; seed < 50; seed++) {
    const r = makeRound(by, rng(seed));
    assert.ok(r.choices.includes(r.answer));
    assert.equal(new Set(r.choices).size, CONFIG.rouletteChoices);
    assert.equal(r.station.country, r.answer);
    assert.notEqual(r.answer, 'AR', 'empty country never picked');
    assert.ok(r.choices.every((c) => countryByCode(c)));
  }
  assert.equal(makeRound({}, rng(1)), null);
});

test('rounds are reproducible from a seed', () => {
  const by = { MX: normalizeStations(FIXTURE.MX, 'MX'), PE: normalizeStations(FIXTURE.PE, 'PE') };
  assert.deepEqual(makeRound(by, rng(7)), makeRound(by, rng(7)));
});

test('streak grows on a right guess and resets on a wrong one', () => {
  const r = { answer: 'PE' };
  assert.deepEqual(scoreGuess(r, 'PE', 2), { correct: true, streak: 3 });
  assert.deepEqual(scoreGuess(r, 'MX', 5), { correct: false, streak: 0 });
});

test('favorites toggle and store only what playback needs', () => {
  const [a] = normalizeStations(FIXTURE.MX, 'MX');
  const on = toggleFavorite([], a);
  assert.deepEqual(Object.keys(on[0]).sort(), ['country', 'id', 'name', 'stream']);
  assert.deepEqual(toggleFavorite(on, a), []);
});
