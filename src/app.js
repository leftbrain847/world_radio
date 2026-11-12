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
    country: null,
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

  async function loadCountry(code) {
    if (state.cache[code]) return state.cache[code];
    const servers = state.server ? [state.server, ...CONFIG.servers.filter((s) => s !== state.server)] : CONFIG.servers;
    let lastErr;
    for (const server of servers) {
      try {
        const rows = await getJson(searchUrl(server, code));
        state.server = server;
        return (state.cache[code] = normalizeStations(rows, code));
      } catch (e) { lastErr = e; }
    }
    throw lastErr ?? new Error('sin conexión');
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

  function renderCountries() {
    const box = $('countries');
    box.replaceChildren(...CONFIG.countries.map((c) => el('button', {
      text: c.name, 'aria-pressed': String(state.country === c.code), 'data-code': c.code,
      on: { click: () => pickCountry(c.code) },
    })));
  }

  async function pickCountry(code) {
    state.country = code;
    renderCountries();
    const list = $('stations');
    list.replaceChildren(el('p', { class: 'msg', text: 'Buscando emisoras…' }));
    try {
      const stations = await loadCountry(code);
      if (state.country !== code) return;
      if (!stations.length) return list.replaceChildren(el('p', { class: 'msg', text: 'No hay emisoras https para este país ahora mismo.' }));
      list.replaceChildren(el('p', { class: 'msg', text: `${stations.length} emisoras https · las más votadas primero` }), ...stations.map(stationRow));
    } catch {
      list.replaceChildren(el('p', { class: 'msg err', text: 'No se pudo cargar el directorio de radios. Revisa tu conexión e inténtalo otra vez.' }));
    }
  }

  function stationRow(s) {
    const isFav = state.favs.some((f) => f.id === s.id);
    const info = [s.city, s.tags.join(' · '), s.bitrate ? `${s.bitrate} kbps` : ''].filter(Boolean).join(' — ');
    return el('div', { class: `st${state.current?.id === s.id ? ' playing' : ''}`, 'data-id': s.id }, [
      el('div', { class: 'meta' }, [el('div', { class: 'nm', text: s.name }), el('div', { class: 'tg', text: info || (countryByCode(s.country)?.name ?? '') })]),
      el('button', { text: isFav ? '★' : '☆', 'aria-label': 'Favorita', on: { click: (e) => { favorite(s); e.target.textContent = state.favs.some((f) => f.id === s.id) ? '★' : '☆'; } } }),
      el('button', { text: '▶', 'aria-label': 'Escuchar', on: { click: () => play(s, false) } }),
    ]);
  }

  function renderFavs() {
    const box = $('favs');
    if (!state.favs.length) return box.replaceChildren(el('p', { class: 'msg', text: 'Aún no tienes favoritas. Toca ☆ en una emisora.' }));
    box.replaceChildren(...state.favs.map((f) => stationRow({ ...f, city: '', tags: [], bitrate: 0 })));
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
    audio.play().catch(() => { $('npInfo').textContent = 'Toca ▶ para empezar.'; });
    if (state.server) fetch(clickUrl(state.server, s.id)).catch(() => {}); // Radio Browser's play counter
    $('player').classList.remove('hide');
    syncPlayer();
    document.querySelectorAll('.st').forEach((n) => n.classList.toggle('playing', n.dataset.id === s.id));
  }

  function syncPlayer() {
    const s = state.current;
    if (!s) return;
    $('npName').textContent = s.hidden ? '¿? Emisora misteriosa' : s.name;
    $('npInfo').textContent = s.hidden ? 'Escucha el acento…' : (countryByCode(s.country)?.name ?? '');
    $('favBtn').classList.toggle('hide', !!s.hidden);
    $('favBtn').textContent = state.favs.some((f) => f.id === s.id) ? '★' : '☆';
  }

  $('playBtn').addEventListener('click', () => {
    if (audio.paused) audio.play().catch(() => {}); else audio.pause();
  });
  $('favBtn').addEventListener('click', () => state.current && favorite(state.current));
  audio.addEventListener('playing', () => { $('playBtn').textContent = '❚❚'; $('eq').classList.remove('hide'); });
  audio.addEventListener('pause', () => { $('playBtn').textContent = '▶'; $('eq').classList.add('hide'); });
  audio.addEventListener('waiting', () => { $('npInfo').textContent = 'Conectando…'; });
  audio.addEventListener('error', () => {
    $('npInfo').textContent = 'Esta emisora no responde. Prueba otra.';
    $('eq').classList.add('hide');
  });

  // ---------- accent roulette ----------
  function paintStreak() { $('streak').textContent = state.streak; $('best').textContent = state.best; }

  async function spin() {
    $('spin').disabled = true;
    $('rqMsg').textContent = 'Girando…';
    $('choices').replaceChildren();
    try {
      // Load a handful of countries so the answer isn't always the one you browsed.
      const picks = shuffleCodes().slice(0, 4);
      const results = await Promise.allSettled(picks.map(loadCountry));
      const by = {};
      picks.forEach((c, i) => { if (results[i].status === 'fulfilled') by[c] = results[i].value; });
      const round = makeRound(by, state.rand);
      if (!round) throw new Error('empty');
      state.round = round;
      $('rqTitle').textContent = '¿De dónde es esta radio?';
      $('rqMsg').textContent = 'Escucha y elige un país.';
      $('choices').replaceChildren(...round.choices.map((code) => el('button', {
        text: countryByCode(code).name, 'data-code': code, on: { click: (e) => guess(code, e.target) },
      })));
      $('reveal').disabled = false;
      play(round.station, true);
    } catch {
      $('rqMsg').textContent = 'No se pudo cargar una emisora. Inténtalo otra vez.';
    } finally { $('spin').disabled = false; }
  }

  function shuffleCodes() {
    const codes = CONFIG.countries.map((c) => c.code);
    for (let i = codes.length - 1; i > 0; i--) { const j = Math.floor(state.rand() * (i + 1)); [codes[i], codes[j]] = [codes[j], codes[i]]; }
    return codes;
  }

  function guess(code, btn) {
    const r = state.round;
    if (!r || r.done) return;
    r.done = true;
    const res = scoreGuess(r, code, state.streak);
    state.streak = res.streak;
    state.best = Math.max(state.best, state.streak);
    store.set(K.streak, state.streak); store.set(K.best, state.best);
    paintStreak();
    btn.classList.add(res.correct ? 'right' : 'wrong');
    $('choices').querySelector(`[data-code="${r.answer}"]`)?.classList.add('right');
    reveal(res.correct ? '¡Correcto!' : 'Casi…');
  }

  function reveal(head = 'Era…') {
    const r = state.round;
    if (!r) return;
    r.done = true;
    $('rqTitle').textContent = `${head} ${countryByCode(r.answer).name}`;
    $('rqMsg').textContent = r.station.name;
    $('reveal').disabled = true;
    if (state.current?.id === r.station.id) { state.current.hidden = false; syncPlayer(); }
  }
  $('spin').addEventListener('click', spin);
  $('reveal').addEventListener('click', () => { if (state.round && !state.round.done) { state.streak = 0; store.set(K.streak, 0); paintStreak(); } reveal(); });

  // ---------- boot ----------
  renderCountries();
  paintStreak();
})();
