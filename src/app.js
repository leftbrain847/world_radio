// world_radio UI. Uses the core functions inlined above it. All station text goes into the page as text, never HTML.
(() => {
  const $ = (id) => document.getElementById(id);
  const el = (tag, props = {}, kids = []) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'text') n.textContent = v;
      else if (k === 'on') for (const [ev, fn] of Object.entries(v)) n.addEventListener(ev, fn);
      else n.setAttribute(k, v);
    }
    for (const c of kids) n.append(c);
    return n;
  };
  const store = {
    get(key, dflt) { try { const v = localStorage.getItem(key); return v == null ? dflt : JSON.parse(v); } catch { return dflt; } },
    set(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage off: fine */ } },
  };
  const K = CONFIG.storageKeys;

  const state = {
    countries: [],          // [{code, name, count}] from the directory
    country: null,
    query: '',
    continent: 'Popular',   // 'Popular' = CONFIG.featured, else a key of CONTINENTS
    cache: {},              // countryCode -> stations
    server: null,           // the mirror that answered last
    current: null,          // station playing
    favs: store.get(K.favorites, []),
    streak: store.get(K.streak, 0),
    best: store.get(K.best, 0),
    round: null,
    rand: rng(Date.now() & 0xffffffff),
  };
  const audio = $('audio');
  const label = (code) => `${flag(code)} ${nameOf(code, state.countries)}`.trim();

  // ---------- data ----------
  async function getJson(url) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), CONFIG.requestTimeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally { clearTimeout(t); }
  }

  async function fromAnyServer(makeUrl) {
    const servers = state.server ? [state.server, ...CONFIG.servers.filter((s) => s !== state.server)] : CONFIG.servers;
    let lastErr;
    for (const server of servers) {
      try {
        const data = await getJson(makeUrl(server));
        state.server = server;
        return data;
      } catch (e) { lastErr = e; }
    }
    throw lastErr ?? new Error('offline');
  }

  async function loadCountry(code) {
    if (state.cache[code]) return state.cache[code];
    const rows = await fromAnyServer((s) => searchUrl(s, code));
    return (state.cache[code] = normalizeStations(rows, code));
  }

  // ---------- views ----------
  const tabs = { Listen: 'viewListen', Roulette: 'viewRoulette', Favs: 'viewFavs' };
  function show(name) {
    for (const [t, v] of Object.entries(tabs)) {
      $(`tab${t}`).setAttribute('aria-pressed', String(t === name));
      $(v).classList.toggle('hide', t !== name);
    }
    if (name === 'Favs') renderFavs();
  }
  for (const t of Object.keys(tabs)) $(`tab${t}`).addEventListener('click', () => show(t));

  function countryButton(c) {
    return el('button', {
      text: `${flag(c.code)} ${c.name}`.trim(), 'aria-pressed': String(state.country === c.code), 'data-code': c.code,
      on: { click: () => pickCountry(c.code) },
    });
  }

  function renderContinents() {
    const names = ['Popular', ...Object.keys(CONTINENTS)];
    if (state.countries.some((c) => continentOf(c.code) === 'Other')) names.push('Other');
    $('continents').replaceChildren(...names.map((n) => el('button', {
      text: n, 'aria-pressed': String(!state.query && state.continent === n),
      on: { click: () => { state.continent = n; state.query = ''; $('search').value = ''; renderCountries(); } },
    })));
  }

  function renderCountries() {
    const box = $('countries');
    if (!state.countries.length) return;
    renderContinents();
    const list = state.query
      ? filterCountries(state.countries, state.query)
      : state.continent === 'Popular'
        ? orderCountries(state.countries).slice(0, CONFIG.featured.length)
        : countriesIn(state.countries, state.continent);
    if (!list.length) return box.replaceChildren(el('p', { class: 'msg', text: 'No country matches that.' }));
    box.replaceChildren(...list.map(countryButton));
    $('countryHint').textContent = state.query ? `${list.length} match` + (list.length === 1 ? '' : 'es') : `${state.continent} · ${list.length} of ${state.countries.length} countries · or search`;
  }

  async function loadCountries() {
    $('countryHint').textContent = 'Loading countries…';
    try {
      state.countries = normalizeCountries(await fromAnyServer(countriesUrl));
      renderCountries();
    } catch {
      $('countryHint').textContent = "Couldn't reach the radio directory. Check your connection and reload.";
    }
  }

  $('search').addEventListener('input', (e) => { state.query = e.target.value; renderCountries(); });

  async function pickCountry(code) {
    state.country = code;
    renderCountries();
    const list = $('stations');
    list.replaceChildren(el('p', { class: 'msg', text: 'Finding stations…' }));
    try {
      const stations = await loadCountry(code);
      if (state.country !== code) return;
      if (!stations.length) return list.replaceChildren(el('p', { class: 'msg', text: 'No https stations for this country right now.' }));
      list.replaceChildren(el('p', { class: 'msg', text: `${label(code)} · ${stations.length} https stations, most-voted first` }), ...stations.map(stationRow));
    } catch {
      list.replaceChildren(el('p', { class: 'msg err', text: "Couldn't load stations. Check your connection and try again." }));
    }
  }

  function stationRow(s) {
    const isFav = state.favs.some((f) => f.id === s.id);
    const info = [s.city, s.language, (s.tags ?? []).join(' · '), s.bitrate ? `${s.bitrate} kbps` : ''].filter(Boolean).join(' — ');
    return el('div', { class: `st${state.current?.id === s.id ? ' playing' : ''}`, 'data-id': s.id }, [
      el('div', { class: 'meta' }, [el('div', { class: 'nm', text: s.name }), el('div', { class: 'tg', text: info || label(s.country) })]),
      el('button', { text: isFav ? '★' : '☆', 'aria-label': 'Favorite', on: { click: (e) => { favorite(s); e.target.textContent = state.favs.some((f) => f.id === s.id) ? '★' : '☆'; } } }),
      el('button', { text: '▶', 'aria-label': 'Play', on: { click: () => play(s, false) } }),
    ]);
  }

  function renderFavs() {
    const box = $('favs');
    if (!state.favs.length) return box.replaceChildren(el('p', { class: 'msg', text: 'No favorites yet. Tap ☆ on a station.' }));
    box.replaceChildren(...state.favs.map((f) => stationRow({ ...f, city: '', language: '', tags: [], bitrate: 0 })));
  }

  function favorite(s) {
    state.favs = toggleFavorite(state.favs, s);
    store.set(K.favorites, state.favs);
    syncPlayer();
  }

  // ---------- player ----------
  function play(s, hidden) {
    state.current = { ...s, hidden };
    audio.src = s.stream;
    audio.play().catch(() => { $('npInfo').textContent = 'Tap ▶ to start.'; });
    if (state.server) fetch(clickUrl(state.server, s.id)).catch(() => {}); // Radio Browser's play counter
    $('player').classList.remove('hide');
    syncPlayer();
    document.querySelectorAll('.st').forEach((n) => n.classList.toggle('playing', n.dataset.id === s.id));
  }

  function syncPlayer() {
    const s = state.current;
    if (!s) return;
    $('npName').textContent = s.hidden ? 'Mystery station' : s.name;
    $('npInfo').textContent = s.hidden ? 'Listen closely…' : label(s.country);
    $('favBtn').classList.toggle('hide', !!s.hidden);
    $('favBtn').textContent = state.favs.some((f) => f.id === s.id) ? '★' : '☆';
  }

  $('playBtn').addEventListener('click', () => {
    if (audio.paused) audio.play().catch(() => {}); else audio.pause();
  });
  $('favBtn').addEventListener('click', () => state.current && favorite(state.current));
  audio.addEventListener('playing', () => { $('playBtn').textContent = '❚❚'; $('eq').classList.remove('hide'); syncPlayer(); });
  audio.addEventListener('pause', () => { $('playBtn').textContent = '▶'; $('eq').classList.add('hide'); });
  audio.addEventListener('waiting', () => { $('npInfo').textContent = 'Connecting…'; });
  audio.addEventListener('error', () => {
    $('npInfo').textContent = "This station isn't responding. Try another.";
    $('eq').classList.add('hide');
  });

  // ---------- roulette ----------
  function paintStreak() { $('streak').textContent = state.streak; $('best').textContent = state.best; }

  async function spin() {
    $('spin').disabled = true;
    $('rqMsg').textContent = 'Spinning…';
    $('choices').replaceChildren();
    try {
      if (!state.countries.length) await loadCountries();
      const pool = roulettePool(state.countries);
      const picks = shuffle(pool, state.rand).slice(0, CONFIG.rouletteCountriesPerSpin);
      const results = await Promise.allSettled(picks.map(loadCountry));
      const by = {};
      picks.forEach((c, i) => { if (results[i].status === 'fulfilled') by[c] = results[i].value; });
      const round = makeRound(by, pool, state.rand);
      if (!round) throw new Error('empty');
      state.round = round;
      $('rqTitle').textContent = 'Where is this station?';
      $('rqMsg').textContent = 'Listen, then pick a country.';
      $('choices').replaceChildren(...round.choices.map((code) => el('button', {
        text: label(code), 'data-code': code, on: { click: (e) => guess(code, e.currentTarget) },
      })));
      $('reveal').disabled = false;
      play(round.station, true);
    } catch {
      $('rqMsg').textContent = "Couldn't load a station. Try again.";
    } finally { $('spin').disabled = false; }
  }

  function guess(code, btn) {
    const r = state.round;
    if (!r || r.done) return;
    const res = scoreGuess(r, code, state.streak);
    state.streak = res.streak;
    state.best = Math.max(state.best, state.streak);
    store.set(K.streak, state.streak); store.set(K.best, state.best);
    paintStreak();
    btn.classList.add(res.correct ? 'right' : 'wrong');
    $('choices').querySelector(`[data-code="${r.answer}"]`)?.classList.add('right');
    reveal(res.correct ? 'Correct!' : 'Not quite —');
  }

  function reveal(head = 'It was') {
    const r = state.round;
    if (!r) return;
    r.done = true;
    $('rqTitle').textContent = `${head} ${label(r.answer)}`;
    $('rqMsg').textContent = r.station.name;
    $('reveal').disabled = true;
    if (state.current?.id === r.station.id) { state.current.hidden = false; syncPlayer(); }
  }
  $('spin').addEventListener('click', spin);
  $('reveal').addEventListener('click', () => {
    if (state.round && !state.round.done) { state.streak = 0; store.set(K.streak, 0); paintStreak(); }
    reveal();
  });

  // ---------- boot ----------
  paintStreak();
  loadCountries();
})();
