/* ============================================================
   WHO'S THAT POKÉMON — game.js (v3)
   ============================================================ */

/* ── CONFIG ─────────────────────────────────────────────────── */
const CONFIG = {
  MAX_POKEMON_ID : 1025,
  LEVEL_THRESHOLD: 50,
  MASTER_VOLUME  : 0.95,
  SAVE_KEY       : 'wtp_save',
  LEVELUP_HIDE   : 6000,
  HINT_STEPS     : [1, 3, 5],
  LEVELUP_SOUNDS : {
    picross: 'https://raw.githubusercontent.com/kevinraphael95/random-useful-stuff/main/pokemonlevelup/pok-mon-picross.mp3',
    bank   : 'https://raw.githubusercontent.com/kevinraphael95/random-useful-stuff/main/pokemonlevelup/pok-mon-bank.mp3',
  },
  GRAPHQL: 'https://beta.pokeapi.co/graphql/v1beta',
};

/* ── DRAPEAUX (SVG : les emojis drapeaux ne s'affichent pas sous Windows) ── */
const FLAGS = {
  fr: '<svg viewBox="0 0 3 2" aria-hidden="true"><rect width="1" height="2" fill="#0055a4"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ef4135"/></svg>',
  en: '<svg viewBox="0 0 60 40" aria-hidden="true"><rect width="60" height="40" fill="#012169"/><path d="M0 0l60 40M60 0L0 40" stroke="#fff" stroke-width="8"/><path d="M0 0l60 40M60 0L0 40" stroke="#c8102e" stroke-width="3"/><path d="M30 0v40M0 20h60" stroke="#fff" stroke-width="13"/><path d="M30 0v40M0 20h60" stroke="#c8102e" stroke-width="8"/></svg>',
};

/* ── TEXTES ─────────────────────────────────────────────────── */
const T = {
  fr: {
    lab: 'Nom du Pokémon', ph: 'Écris le nom ici…', ask: 'Qui est ce Pokémon ?', load: 'Chargement…',
    guess: 'Valider ✓', hint: '💡 Indice', reveal: '👁 Voir la réponse', revealSub: 'compte comme raté',
    skip: '⏭ Passer', skipSub: 'sans pénalité', next: '▶ Suivant', nextSub: 'nouveau Pokémon',
    hintSteps: ['1ʳᵉ lettre', '3 premières lettres', '5 premières lettres'],
    lblOk: 'Trouvés', lblKo: 'Ratés', lblStreak: 'Série',
    langLabel: 'Langue : français. Passer en anglais',
    soundOn: 'Son activé. Couper le son', soundOff: 'Son coupé. Activer le son',
    good: 'Bravo !', bad: 'Raté, essaie encore.', done: 'Voici la réponse. Clique sur « Suivant ».',
    empty: 'Écris un nom avant de valider.', hintTxt: 'Indice :', err: 'Erreur de chargement. Clique sur « Suivant ».',
    keys: '<kbd>Entrée</kbd> valider · <kbd>Tab</kbd> indice · <kbd>Échap</kbd> passer',
    level: (l) => `NIVEAU ${l}`,
    xp: (x, l) => `${x} / ${CONFIG.LEVEL_THRESHOLD} bonnes réponses avant le niveau ${l + 1}`,
    popupTitle: 'NIVEAU SUPÉRIEUR', popupSub: (l) => `NIVEAU ${l} ATTEINT`,
  },
  en: {
    lab: 'Pokémon name', ph: 'Type the name here…', ask: "Who's that Pokémon?", load: 'Loading…',
    guess: 'Submit ✓', hint: '💡 Hint', reveal: '👁 Show answer', revealSub: 'counts as a miss',
    skip: '⏭ Skip', skipSub: 'no penalty', next: '▶ Next', nextSub: 'new Pokémon',
    hintSteps: ['1st letter', 'First 3 letters', 'First 5 letters'],
    lblOk: 'Found', lblKo: 'Missed', lblStreak: 'Streak',
    langLabel: 'Language: English. Switch to French',
    soundOn: 'Sound on. Mute', soundOff: 'Sound off. Turn on',
    good: 'Well done!', bad: 'Not quite, try again.', done: 'Here is the answer. Press “Next”.',
    empty: 'Type a name first.', hintTxt: 'Hint:', err: 'Loading error. Press “Next”.',
    keys: '<kbd>Enter</kbd> submit · <kbd>Tab</kbd> hint · <kbd>Esc</kbd> skip',
    level: (l) => `LEVEL ${l}`,
    xp: (x, l) => `${x} / ${CONFIG.LEVEL_THRESHOLD} correct answers to level ${l + 1}`,
    popupTitle: 'LEVEL UP', popupSub: (l) => `LEVEL ${l} REACHED`,
  },
};

/* ── STORAGE ────────────────────────────────────────────────── */
const Storage = {
  load() {
    try { return JSON.parse(localStorage.getItem(CONFIG.SAVE_KEY)) || null; }
    catch { return null; }
  },
  save(state) {
    try { localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(state)); }
    catch (e) { console.error('Save error:', e); }
  },
};

/* ── API : PokéAPI + cache + noms pour l'autocomplétion ─────── */
const Api = (() => {
  const cache = new Map();

  async function fetchJSON(url) {
    if (cache.has(url)) return cache.get(url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
    const data = await res.json();
    cache.set(url, data);
    return data;
  }

  function preloadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload  = () => resolve(url);
      img.onerror = () => reject(new Error(`Image failed: ${url}`));
      img.src = url;
    });
  }

  async function loadPokemon(id) {
    const data    = await fetchJSON(`https://pokeapi.co/api/v2/pokemon/${id}`);
    const species = await fetchJSON(data.species.url);
    const imgUrl  = data.sprites.other?.['official-artwork']?.front_default || data.sprites.front_default;
    await preloadImage(imgUrl);
    return { data, species, imgUrl };
  }

  /* Tous les noms FR/EN en une requête (language_id 5 = fr, 9 = en).
     Si ça échoue, le jeu marche pareil, juste sans suggestions. */
  async function loadNames() {
    const query = '{ pokemon_v2_pokemonspeciesname(where:{language_id:{_in:[5,9]}}) { name language_id } }';
    const res = await fetch(CONFIG.GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error(`GraphQL ${res.status}`);
    const rows = (await res.json()).data.pokemon_v2_pokemonspeciesname;
    const out = { fr: [], en: [] };
    rows.forEach(r => out[r.language_id === 5 ? 'fr' : 'en'].push(r.name));
    out.fr.sort((a, b) => a.localeCompare(b, 'fr'));
    out.en.sort();
    return out;
  }

  return { loadPokemon, loadNames };
})();

/* ── SONS ───────────────────────────────────────────────────── */
const Sfx = (() => {
  let actx = null, muted = false;
  const buffers = {};
  const ctx = () => (actx ??= new (window.AudioContext || window.webkitAudioContext)());

  /* Chaque son = liste de notes : f (Hz), f2 (glissando), t (début), d (durée), v (volume) */
  const SOUNDS = {
    ui     : [{ type: 'sine',     f: 520, f2: 620, t: 0,   d: .12, v: .5 }],
    correct: [523, 659, 784].map((f, i) => ({ type: 'sine', f, t: i * .12, d: .2, v: .6 })),
    wrong  : [{ type: 'sine',     f: 300, f2: 180, t: 0,   d: .3,  v: .4 }],
    reveal : [392, 494, 587].map((f, i) => ({ type: 'triangle', f, t: i * .12, d: .25, v: .5 })),
    hint   : [{ type: 'sine',     f: 600, f2: 740, t: 0,   d: .2,  v: .35 }],
    newmon : [{ type: 'sine',     f: 500, f2: 220, t: 0,   d: .4,  v: .5 }],
    levelup: [[523, 0], [659, .15], [784, .3], [988, .5], [784, .75]].map(([f, t]) => ({ type: 'triangle', f, t, d: .5, v: .6 })),
  };

  function play(name) {
    if (muted) return;
    try {
      const c = ctx(), now = c.currentTime;
      SOUNDS[name].forEach(({ type, f, f2, t, d, v }) => {
        const osc = c.createOscillator(), gain = c.createGain(), s = now + t;
        osc.type = type;
        osc.frequency.setValueAtTime(f, s);
        if (f2) osc.frequency.exponentialRampToValueAtTime(f2, s + d);
        gain.gain.setValueAtTime(CONFIG.MASTER_VOLUME * v, s);
        gain.gain.exponentialRampToValueAtTime(0.001, s + d);
        osc.connect(gain); gain.connect(c.destination);
        osc.start(s); osc.stop(s + d);
      });
    } catch (e) { console.warn('Audio error:', e); }
  }

  async function preload() {
    for (const [key, url] of Object.entries(CONFIG.LEVELUP_SOUNDS)) {
      try {
        const ab = await (await fetch(url)).arrayBuffer();
        buffers[key] = await ctx().decodeAudioData(ab);
      } catch (e) { console.warn(`Audio preload failed [${key}]:`, e); }
    }
  }

  function playLevelUp() {
    if (muted) return;
    const buf = buffers[Math.random() < 0.99 ? 'picross' : 'bank'];
    if (!buf) return play('levelup');
    const c = ctx(), src = c.createBufferSource(), gain = c.createGain();
    gain.gain.value = 0.6;
    src.buffer = buf; src.connect(gain); gain.connect(c.destination); src.start(0);
  }

  return {
    play, preload, playLevelUp,
    setMuted: (v) => { muted = v; },
    isMuted : () => muted,
  };
})();

/* ── DOM ────────────────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);

/* ── JEU ────────────────────────────────────────────────────── */
const Game = (() => {
  /* État */
  let current = null, nextPromise = null, lang = 'fr';
  let ok = 0, ko = 0, streak = 0, level = 1, xp = 0;
  let hintStep = 0, revealed = false, loading = false;
  let lastPokemonId = null, wasRevealed = false;
  let names = { fr: [], en: [] }, matches = [], sel = -1;
  let bannerState = ['info', '❔', 'ask'];
  let levelupTimer = null;

  const t = () => T[lang];
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const randomId = () => Math.floor(Math.random() * CONFIG.MAX_POKEMON_ID) + 1;
  const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

  function getNames() {
    if (!current) return { en: '', fr: '' };
    const find = (l) => current.species.names.find(n => n.language.name === l)?.name ?? current.data.name;
    return { en: find('en'), fr: find('fr') };
  }
  const currentName = () => getNames()[lang];

  /* ── Sauvegarde ── */
  function persist() {
    Storage.save({
      level, xp, correct: ok, wrong: ko, streak,
      muted: Sfx.isMuted(),
      lastPokemonId: current?.data?.id ?? lastPokemonId,
      wasRevealed: revealed,
    });
  }

  function loadSave() {
    const s = Storage.load();
    if (!s) return;
    level = s.level || 1; xp = s.xp || 0;
    ok = s.correct || 0;  ko = s.wrong || 0; streak = s.streak || 0;
    lastPokemonId = s.lastPokemonId || null;
    wasRevealed   = s.wasRevealed || false;
    if (s.muted) Sfx.setMuted(true);
  }

  /* ── Affichage ── */
  /* « idle » = message d'attente (« Qui est ce Pokémon ? ») : le CSS le masque sur mobile */
  function banner(kind, icon, key, extra = '') {
    bannerState = [kind, icon, key, extra];
    const b = $('banner');
    b.className = `banner ${kind}`;
    b.classList.toggle('idle', key === 'ask');
    $('banner-icon').textContent = icon;
    $('banner-text').textContent = (t()[key] ?? key) + extra;
  }

  /* Petit écran : tirets (nombre de lettres) + lettres d'indice, puis nom complet */
  function renderName() {
    const el = $('lcd-name');
    el.classList.toggle('hidden', !revealed);
    if (!current) { el.textContent = '_ _ _'; return; }
    const n = currentName(), shown = hintStep ? CONFIG.HINT_STEPS[hintStep - 1] : 0;
    el.textContent = revealed
      ? n.toUpperCase()
      : [...n].map((c, i) => (c === ' ' || c === '-') ? c : (i < shown ? c.toUpperCase() : '_')).join('');
  }

  function renderStats() {
    $('level-display').textContent = t().level(level);
    $('ok-n').textContent = ok;
    $('ko-n').textContent = ko;
    $('streak-n').textContent = streak;
    $('xp-fill').style.width = `${(xp / CONFIG.LEVEL_THRESHOLD) * 100}%`;
    $('xp-label').textContent = t().xp(xp, level);
    $('xp-bar').setAttribute('aria-valuenow', xp);
  }

  function renderSkip() {
    const b = $('btn-skip');
    $('skip-label').textContent = revealed ? t().next : t().skip;
    $('skip-sub').textContent   = revealed ? t().nextSub : t().skipSub;
    b.classList.toggle('go', revealed);
  }

  /* Réglages : drapeau = langue actuelle, icône = état du son */
  function renderSettings() {
    const lb = $('btn-lang');
    lb.innerHTML = FLAGS[lang];
    lb.setAttribute('aria-label', t().langLabel);
    lb.title = t().langLabel;

    const mb = $('btn-mute'), muted = Sfx.isMuted();
    mb.firstElementChild.textContent = muted ? '🔇' : '🔊';
    mb.classList.toggle('off', muted);
    mb.setAttribute('aria-pressed', !muted);
    mb.setAttribute('aria-label', muted ? t().soundOff : t().soundOn);
    mb.title = muted ? t().soundOff : t().soundOn;
  }

  function renderTexts() {
    document.querySelectorAll('[data-t]').forEach(el => { el.innerHTML = t()[el.dataset.t]; });
    $('guess-input').placeholder = t().ph;
    $('hint-cost').textContent = hintStep >= CONFIG.HINT_STEPS.length ? '—' : t().hintSteps[hintStep];
    document.documentElement.lang = lang;
    renderSettings();
    banner(...bannerState);
    renderStats(); renderSkip(); renderName();
  }

  function setPlayable(on) {
    ['btn-guess', 'btn-hint', 'btn-reveal'].forEach(id => { $(id).disabled = !on; });
    $('guess-input').disabled = !on;
  }

  /* ── Suggestions ── */
  function closeSugg() {
    $('sugg').hidden = true;
    $('guess-input').setAttribute('aria-expanded', 'false');
    $('guess-input').removeAttribute('aria-activedescendant');
    sel = -1;
  }
  function openSugg() {
    const q = normalize($('guess-input').value);
    if (!q) return closeSugg();
    matches = names[lang].filter(n => normalize(n).startsWith(q)).slice(0, 5);
    if (!matches.length || (matches.length === 1 && normalize(matches[0]) === q)) return closeSugg();
    $('sugg').innerHTML = matches.map((m, i) => `<li role="option" id="opt${i}" data-i="${i}">${m}</li>`).join('');
    $('sugg').hidden = false;
    $('guess-input').setAttribute('aria-expanded', 'true');
    sel = -1;
  }
  function pick(i) { $('guess-input').value = matches[i]; closeSugg(); $('guess-input').focus(); }
  function moveSel(d) {
    const items = [...$('sugg').children];
    if (!items.length) return;
    sel = (sel + d + items.length) % items.length;
    items.forEach((li, i) => li.setAttribute('aria-selected', i === sel));
    $('guess-input').setAttribute('aria-activedescendant', `opt${sel}`);
  }

  /* ── XP / niveau ── */
  function addXP() {
    xp++;
    if (xp >= CONFIG.LEVEL_THRESHOLD) { xp = 0; level++; levelUp(); }
  }
  function levelUp() {
    Sfx.playLevelUp();
    $('levelup-title').textContent = t().popupTitle;
    $('levelup-sub').textContent   = t().popupSub(level);
    $('levelup').classList.add('show');
    $('levelup-ok').focus();
    clearTimeout(levelupTimer);
    levelupTimer = setTimeout(hideLevelUp, CONFIG.LEVELUP_HIDE);
    const lvl = $('level-display');
    lvl.classList.add('flash');
    setTimeout(() => lvl.classList.remove('flash'), 1500);
  }
  function hideLevelUp() { $('levelup').classList.remove('show'); }

  /* ── Fin de manche ── */
  function endRound(correct) {
    revealed = true;
    $('screen').classList.add('revealed');
    if (correct) $('screen').classList.add('flash');
    $('lcd-name').classList.toggle('correct', !!correct);
    setPlayable(false);
    closeSugg();
    renderName(); renderSkip(); renderStats();
    persist();
    $('btn-skip').focus({ preventScroll: true });
  }

  /* ── Nouveau Pokémon ── */
  async function newPokemon() {
    if (loading) return;
    loading = true;
    hintStep = 0;
    const screen = $('screen');
    screen.classList.remove('revealed', 'flash');
    screen.classList.add('loading');
    $('lcd-name').classList.remove('correct');
    $('guess-input').value = '';
    $('guess-input').classList.remove('shake', 'wrong');
    closeSugg();
    setPlayable(false);
    $('btn-skip').disabled = true;
    banner('info', '⏳', 'load');
    await sleep(250);

    try {
      const payload = nextPromise ? await nextPromise : await Api.loadPokemon(randomId());
      nextPromise = null;
      if (!payload) throw new Error('prefetch failed');
      current = payload; revealed = false;
      $('pokemon-img').src = payload.imgUrl;
      screen.classList.remove('loading');
      setPlayable(true);
      banner('info', '❔', 'ask');
      renderName(); renderSkip(); renderTexts();
      persist();
      prefetchNext();
      if (!('ontouchstart' in window)) $('guess-input').focus({ preventScroll: true });
    } catch (err) {
      console.error('newPokemon error:', err);
      nextPromise = null;
      screen.classList.remove('loading');
      banner('ko', '⚠', 'err');
    } finally {
      loading = false;
      $('btn-skip').disabled = false;
    }
  }

  function prefetchNext() {
    nextPromise = Api.loadPokemon(randomId()).catch(() => null);
  }

  /* ── Actions ── */
  function check() {
    if (!current || revealed) return;
    const input = $('guess-input'), guess = input.value.trim();
    if (!guess) return banner('info', '✏️', 'empty');

    const n = getNames();
    if (normalize(guess) === normalize(n.en) || normalize(guess) === normalize(n.fr)) {
      ok++; streak++; addXP();
      Sfx.play('correct');
      banner('ok', '✔', 'good');
      endRound(true);
    } else {
      ko++; streak = 0;
      Sfx.play('wrong');
      banner('ko', '✖', 'bad');
      input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake', 'wrong');
      input.select();
      renderStats(); persist();
    }
  }

  function hint() {
    if (!current || revealed || hintStep >= CONFIG.HINT_STEPS.length) return;
    Sfx.play('hint');
    hintStep++;
    const start = currentName().slice(0, CONFIG.HINT_STEPS[hintStep - 1]).toUpperCase();
    banner('info', '💡', 'hintTxt', ` ${start}…`);
    $('hint-cost').textContent = hintStep >= CONFIG.HINT_STEPS.length ? '—' : t().hintSteps[hintStep];
    renderName();
  }

  function reveal() {
    if (!current || revealed) return;
    ko++; streak = 0;
    Sfx.play('reveal');
    banner('info', '👁', 'done');
    endRound(false);
  }

  /* « Passer » avant la fin de manche, « Suivant » après : même bouton */
  function skipOrNext() {
    Sfx.play('newmon');
    newPokemon();
  }

  /* Un seul bouton : le drapeau affiché est la langue actuelle, un clic bascule */
  function toggleLang() {
    lang = lang === 'fr' ? 'en' : 'fr';
    Sfx.play('ui');
    closeSugg();
    renderTexts();
  }

  function toggleMute() {
    Sfx.setMuted(!Sfx.isMuted());
    renderSettings();
    persist();
  }

  /* ── Init ── */
  async function init() {
    loadSave();
    renderTexts();
    Sfx.preload();
    Api.loadNames().then(n => { names = n; }).catch(e => console.warn('Noms indisponibles (pas de suggestions):', e));

    /* Écouteurs */
    $('btn-guess').addEventListener('click', () => { Sfx.play('ui'); check(); });
    $('btn-hint').addEventListener('click', hint);
    $('btn-reveal').addEventListener('click', reveal);
    $('btn-skip').addEventListener('click', skipOrNext);
    $('btn-lang').addEventListener('click', toggleLang);
    $('btn-mute').addEventListener('click', toggleMute);
    $('levelup-ok').addEventListener('click', hideLevelUp);

    const input = $('guess-input');
    input.addEventListener('input', () => { input.classList.remove('wrong'); openSugg(); });
    $('sugg').addEventListener('mousedown', (e) => {
      const li = e.target.closest('li');
      if (li) { e.preventDefault(); pick(+li.dataset.i); }
    });
    input.addEventListener('keydown', (e) => {
      const open = !$('sugg').hidden;
      if (e.key === 'ArrowDown' && open)      { e.preventDefault(); moveSel(1); }
      else if (e.key === 'ArrowUp' && open)   { e.preventDefault(); moveSel(-1); }
      else if (e.key === 'Enter')             { e.preventDefault(); open && sel >= 0 ? pick(sel) : (Sfx.play('ui'), check()); }
      else if (e.key === 'Tab' && !e.shiftKey && !revealed) { e.preventDefault(); hint(); }
      else if (e.key === 'Escape')            { open ? closeSugg() : skipOrNext(); }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideLevelUp();
      if (e.key === 'Enter' && revealed && document.activeElement === document.body) skipOrNext();
    });

    /* Reprend la session précédente si possible */
    if (lastPokemonId !== null) {
      try {
        current = await Api.loadPokemon(lastPokemonId);
        $('pokemon-img').src = current.imgUrl;
        revealed = wasRevealed;
        if (revealed) {
          $('screen').classList.add('revealed');
          setPlayable(false);
          banner('info', '👁', 'done');
        } else {
          setPlayable(true);
          banner('info', '❔', 'ask');
        }
        renderName(); renderSkip(); renderTexts();
        prefetchNext();
        return;
      } catch { /* on retombe sur un nouveau Pokémon */ }
    }
    newPokemon();
  }

  document.addEventListener('DOMContentLoaded', init);
  return { newPokemon, check, reveal, hint };
})();
