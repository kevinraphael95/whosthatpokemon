/**
 * WHO'S THAT POKÉMON — game.js v2 pro
 * @module Game
 */

'use strict';

/* ================================================================
   CONFIG
   ================================================================ */
/** @type {Readonly<GameConfig>} */
const CONFIG = Object.freeze({
  MAX_POKEMON_ID  : 1025,
  LEVEL_THRESHOLD : 50,
  SAVE_KEY        : 'wtp_v2',
  SAVE_VERSION    : 2,
  HISTORY_MAX     : 8,
  HINT_STEPS      : [1, 3, 5],
  TOAST_DEFAULT   : 2200,
  TOAST_SHORT     : 1400,
  TOAST_LONG      : 3200,
  REVEAL_DELAY    : 1800,
  AUTO_NEXT_DELAY : 1400,
  LEVELUP_AUTO_CLOSE: 6000,
  XP_CIRC         : 150.796, /* 2π × 24 */
  LEVELUP_SOUNDS  : {
    picross : 'https://raw.githubusercontent.com/kevinraphael95/random-useful-stuff/main/pokemonlevelup/pok-mon-picross.mp3',
    bank    : 'https://raw.githubusercontent.com/kevinraphael95/random-useful-stuff/main/pokemonlevelup/pok-mon-bank.mp3',
  },
});

/* ================================================================
   TRANSLATIONS
   ================================================================ */
/** @type {Record<string, Translations>} */
const T = {
  fr: {
    inputLabel   : 'ENTREZ LE NOM',
    inputPH      : 'Tapez un nom...',
    statusReady  : 'PRÊT',
    statusLoad   : 'CHARGEMENT...',
    statusCorrect: 'CORRECT !',
    statusWrong  : 'RÉESSAIE !',
    statusReveal : 'RÉVÉLÉ',
    btnGuess     : 'DEVINER',
    btnNew       : '— NOUVEAU POKÉMON —',
    btnHint      : 'INDICE',
    btnReveal    : 'RÉVÉLER',
    popupEyebrow : 'LEVEL UP',
    popupLevel   : (lvl) => `NIVEAU ${lvl}`,
    levelLabel   : (lvl, xp) => `LVL ${lvl}  ·  ${xp}/${CONFIG.LEVEL_THRESHOLD} XP`,
    hint         : (l)   => `COMMENCE PAR : ${l}`,
    toastCorrect : '✓ BONNE RÉPONSE !',
    toastWrong   : '✗ RÉESSAIE !',
    toastReveal  : '👁 RÉVÉLÉ',
    toastHint    : (h)   => `💡 ${h}`,
    toastNoMore  : 'CHARGE UN NOUVEAU POKÉMON',
    toastLevelUp : (lvl) => `🏆 NIVEAU ${lvl} !`,
    errRetry     : 'ERREUR API — RÉESSAIE',
  },
  en: {
    inputLabel   : 'ENTER NAME',
    inputPH      : 'Type a name...',
    statusReady  : 'READY',
    statusLoad   : 'LOADING...',
    statusCorrect: 'CORRECT!',
    statusWrong  : 'TRY AGAIN!',
    statusReveal : 'REVEALED',
    btnGuess     : 'GUESS',
    btnNew       : '— NEW POKÉMON —',
    btnHint      : 'HINT',
    btnReveal    : 'REVEAL',
    popupEyebrow : 'LEVEL UP',
    popupLevel   : (lvl) => `LEVEL ${lvl}`,
    levelLabel   : (lvl, xp) => `LVL ${lvl}  ·  ${xp}/${CONFIG.LEVEL_THRESHOLD} XP`,
    hint         : (l)   => `STARTS WITH: ${l}`,
    toastCorrect : '✓ CORRECT!',
    toastWrong   : '✗ TRY AGAIN!',
    toastReveal  : '👁 REVEALED',
    toastHint    : (h)   => `💡 ${h}`,
    toastNoMore  : 'LOAD A NEW POKEMON',
    toastLevelUp : (lvl) => `🏆 LEVEL ${lvl}!`,
    errRetry     : 'API ERROR — RETRY',
  },
};

/* ================================================================
   STORAGE
   Versioned save avec migration automatique
   ================================================================ */
const Storage = (() => {
  /** @returns {SaveState|null} */
  function load() {
    try {
      const raw = localStorage.getItem(CONFIG.SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data?.version !== CONFIG.SAVE_VERSION) return null; // migration : reset
      return data;
    } catch {
      return null;
    }
  }

  /** @param {SaveState} state */
  function save(state) {
    try {
      localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify({
        version: CONFIG.SAVE_VERSION,
        ...state,
      }));
    } catch (e) {
      console.warn('[Storage] write failed:', e);
    }
  }

  return { load, save };
})();

/* ================================================================
   API
   Cache LRU simple + préchargement image
   ================================================================ */
const Api = (() => {
  /** @type {Map<string, any>} */
  const cache = new Map();
  const MAX_CACHE = 50;

  /**
   * @param {string} url
   * @returns {Promise<any>}
   */
  async function fetchJSON(url) {
    if (cache.has(url)) return cache.get(url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
    const data = await res.json();
    if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
    cache.set(url, data);
    return data;
  }

  /**
   * @param {string} url
   * @returns {Promise<string>}
   */
  function preloadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload  = () => resolve(url);
      img.onerror = () => reject(new Error(`Image load failed: ${url}`));
      img.src = url;
    });
  }

  /**
   * @param {number} id
   * @returns {Promise<PokemonPayload>}
   */
  async function loadPokemon(id) {
    const [data, species] = await Promise.all([
      fetchJSON(`https://pokeapi.co/api/v2/pokemon/${id}`),
      fetchJSON(`https://pokeapi.co/api/v2/pokemon-species/${id}`),
    ]);
    const imgUrl =
      data.sprites.other?.['official-artwork']?.front_default ||
      data.sprites.front_default;
    await preloadImage(imgUrl);
    return { data, species, imgUrl };
  }

  return { loadPokemon };
})();

/* ================================================================
   SFX
   Web Audio API — synthèse + buffers preloadés
   ================================================================ */
const Sfx = (() => {
  /** @type {AudioContext|null} */
  let ctx = null;
  /** @type {Record<string, AudioBuffer>} */
  const buffers = {};
  let muted = false;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  async function preload() {
    const c = getCtx();
    for (const [key, url] of Object.entries(CONFIG.LEVELUP_SOUNDS)) {
      try {
        const res = await fetch(url);
        const ab  = await res.arrayBuffer();
        buffers[key] = await c.decodeAudioData(ab);
      } catch (e) {
        console.warn(`[Sfx] preload failed [${key}]:`, e);
      }
    }
  }

  /**
   * @param {string} key
   * @param {number} [volume]
   */
  function playBuffer(key, volume = 0.7) {
    const c   = getCtx();
    const buf = buffers[key];
    if (!buf) return;
    const src  = c.createBufferSource();
    const gain = c.createGain();
    gain.gain.value = volume;
    src.buffer = buf;
    src.connect(gain);
    gain.connect(c.destination);
    src.start(0);
  }

  /* ── Définitions sons synthétisés ── */
  const DEFS = {
    ui() {
      const c = getCtx(), t = c.currentTime;
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(480, t);
      o.frequency.linearRampToValueAtTime(560, t + 0.08);
      g.gain.setValueAtTime(0.4, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + 0.12);
    },
    correct() {
      const c = getCtx(), t = c.currentTime;
      [523, 659, 784].forEach((freq, i) => {
        const o = c.createOscillator(), g = c.createGain();
        const st = t + i * 0.11;
        o.type = 'sine'; o.frequency.value = freq;
        g.gain.setValueAtTime(0, st);
        g.gain.linearRampToValueAtTime(0.55, st + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, st + 0.22);
        o.connect(g); g.connect(c.destination);
        o.start(st); o.stop(st + 0.22);
      });
    },
    wrong() {
      const c = getCtx(), t = c.currentTime;
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(280, t);
      o.frequency.exponentialRampToValueAtTime(160, t + 0.28);
      g.gain.setValueAtTime(0.35, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + 0.32);
    },
    reveal() {
      const c = getCtx(), t = c.currentTime;
      [[392, 0], [494, 0.11], [587, 0.22]].forEach(([freq, delay]) => {
        const o = c.createOscillator(), g = c.createGain();
        const st = t + delay;
        o.type = 'triangle'; o.frequency.value = freq;
        g.gain.setValueAtTime(0.45, st);
        g.gain.exponentialRampToValueAtTime(0.001, st + 0.28);
        o.connect(g); g.connect(c.destination);
        o.start(st); o.stop(st + 0.28);
      });
    },
    hint() {
      const c = getCtx(), t = c.currentTime;
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(580, t);
      o.frequency.linearRampToValueAtTime(720, t + 0.14);
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + 0.18);
    },
    newmon() {
      const c = getCtx(), t = c.currentTime;
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(460, t);
      o.frequency.exponentialRampToValueAtTime(200, t + 0.38);
      g.gain.setValueAtTime(0.45, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + 0.42);
    },
  };

  /**
   * @param {string} type
   */
  function play(type) {
    if (muted) return;
    try { DEFS[type]?.(); } catch (e) { console.warn('[Sfx] error:', e); }
  }

  function playLevelUp() {
    if (muted) return;
    const key = Math.random() < 0.99 ? 'picross' : 'bank';
    playBuffer(key);
  }

  /** @param {boolean} val */
  function setMuted(val) { muted = val; }
  function isMuted()     { return muted; }

  return { preload, play, playLevelUp, setMuted, isMuted };
})();

/* ================================================================
   DOM
   Accès centralisé + helpers typés
   ================================================================ */
const Dom = (() => {
  /** @type {Record<string, HTMLElement>} */
  const cache = {};

  /**
   * @template {HTMLElement} T
   * @param {string} id
   * @returns {T}
   */
  function get(id) {
    if (!cache[id]) {
      const el = document.getElementById(id);
      if (!el) console.warn(`[Dom] #${id} not found`);
      else cache[id] = el;
    }
    return /** @type {T} */ (cache[id]);
  }

  /** @param {string} id @param {string} text */
  function text(id, val) {
    const el = get(id);
    if (el) el.textContent = val;
  }

  /** @param {string} id @param {string} html */
  function html(id, val) {
    const el = get(id);
    if (el) el.innerHTML = val;
  }

  /**
   * @param {HTMLElement} el
   * @param {string} cls
   */
  function pulse(el, cls, duration = 400) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), duration);
  }

  /**
   * Shake animation sur un élément
   * @param {HTMLElement} el
   */
  function shake(el) {
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
    el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true });
  }

  return { get, text, html, pulse, shake };
})();

/* ================================================================
   TOAST
   ================================================================ */
const Toast = (() => {
  /** @type {HTMLElement|null} */
  let el    = null;
  let timer = null;

  /**
   * @param {string} msg
   * @param {number} [duration]
   */
  function show(msg, duration = CONFIG.TOAST_DEFAULT) {
    if (!el) el = Dom.get('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('show'), duration);
  }

  return { show };
})();

/* ================================================================
   LEVEL UP POPUP
   ================================================================ */
const LevelPopup = (() => {
  let closeTimer = null;

  /**
   * @param {number} lvl
   * @param {string} lang
   */
  function show(lvl, lang) {
    const popup = document.getElementById('popup-levelup');
    Dom.text('popup-title', T[lang].popupEyebrow);
    Dom.text('popup-level', T[lang].popupLevel(lvl));
    popup?.classList.add('show');
    clearTimeout(closeTimer);
    closeTimer = setTimeout(hide, CONFIG.LEVELUP_AUTO_CLOSE);
  }

  function hide() {
    document.getElementById('popup-levelup')?.classList.remove('show');
  }

  function init() {
    document.getElementById('popup-close')?.addEventListener('click', hide);
  }

  return { show, hide, init };
})();

/* ================================================================
   HISTORY
   Affiche les dernières réponses sous forme de chips
   ================================================================ */
const History = (() => {
  /** @type {Array<{name: string, correct: boolean}>} */
  const entries = [];

  /**
   * @param {string} name
   * @param {boolean} correct
   */
  function push(name, correct) {
    entries.unshift({ name, correct });
    if (entries.length > CONFIG.HISTORY_MAX) entries.pop();
    render();
  }

  function render() {
    const container = Dom.get('history');
    container.innerHTML = entries.map(e => `
      <span class="history__chip history__chip--${e.correct ? 'correct' : 'wrong'}">
        ${e.correct ? '✓' : '✗'} ${e.name}
      </span>
    `).join('');
  }

  return { push };
})();

/* ================================================================
   GAME
   Machine d'état principale
   ================================================================ */
const Game = (() => {

  /* ── State ── */
  /** @type {PokemonPayload|null} */
  let current       = null;
  /** @type {Promise<PokemonPayload>|null} */
  let nextPromise   = null;
  /** @type {'fr'|'en'} */
  let lang          = 'fr';
  let score         = { correct: 0, wrong: 0 };
  let hintStep      = 0;
  let revealed      = false;
  let loading       = false;
  let level         = 1;
  let xp            = 0;
  let lastPokemonId = null;
  let wasRevealed   = false;

  /* ── Helpers ── */
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function randomId() {
    return Math.floor(Math.random() * CONFIG.MAX_POKEMON_ID) + 1;
  }

  /**
   * Normalise une chaîne pour comparaison souple
   * @param {string} s
   * @returns {string}
   */
  function normalize(s) {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  /**
   * @returns {{en: string, fr: string}}
   */
  function getNames() {
    if (!current) return { en: '', fr: '' };
    const find = (lg) =>
      current.species.names.find(n => n.language.name === lg)?.name
      ?? current.data.name;
    return { en: find('en'), fr: find('fr') };
  }

  /* ── Compat IDs ── */
  // btn-hint / btn-reveal ont des tirets dans ce HTML
  function getHintBtn()   { return document.getElementById('btn-hint'); }
  function getRevealBtn() { return document.getElementById('btn-reveal'); }

  /* ── Persist ── */
  function persist() {
    Storage.save({
      level,
      xp,
      correct       : score.correct,
      wrong         : score.wrong,
      muted         : Sfx.isMuted(),
      lastPokemonId : current?.data?.id ?? lastPokemonId,
      wasRevealed   : revealed,
    });
  }

  function restoreSave() {
    const s = Storage.load();
    if (!s) return;
    level         = s.level   || 1;
    xp            = s.xp      || 0;
    score.correct = s.correct || 0;
    score.wrong   = s.wrong   || 0;
    lastPokemonId = s.lastPokemonId ?? null;
    wasRevealed   = s.wasRevealed   ?? false;
    if (s.muted) {
      Sfx.setMuted(true);
      syncMuteBtn();
    }
  }

  /* ── UI ── */
  function syncMuteBtn() {
    const btn = Dom.get('btn-mute');
    if (!btn) return;
    btn.querySelector('.btn__top').textContent = Sfx.isMuted() ? '🔇' : '🔊';
    btn.classList.toggle('btn--muted', Sfx.isMuted());
  }

  function updateScore() {
    Dom.html('score-display', `✓ ${score.correct} &nbsp;✗ ${score.wrong}`);
  }

  function updateXP() {
    const pct = xp / CONFIG.LEVEL_THRESHOLD;
    const bar = Dom.get('xp-bar-fill');
    if (bar) bar.style.width = `${pct * 100}%`;
    Dom.text('level-display', T[lang].levelLabel(level, xp));
  }

  function applyLang() {
    const t = T[lang];
    Dom.text('input-label', t.inputLabel);
    Dom.get('guess-input').placeholder = t.inputPH;
    Dom.get('btn-guess').querySelector('.btn__top').textContent = t.btnGuess;
    Dom.get('btn-new').querySelector('.btn__top').textContent   = t.btnNew;
    const bh = getHintBtn();   if (bh) bh.querySelector('.btn__top').textContent   = t.btnHint;
    const br = getRevealBtn(); if (br) br.querySelector('.btn__top').textContent   = t.btnReveal;
    const st = Dom.get('status-text')?.textContent;
    if (st === T.fr.statusReady || st === T.en.statusReady) Dom.text('status-text', t.statusReady);
    updateScore();
    updateXP();
    if (revealed && current) {
      const names = getNames();
      Dom.text('pokemon-name', (lang === 'fr' ? names.fr : names.en).toUpperCase());
    }
  }

  /* ── Statut écran ── */
  function setStatus(msg, _type = '') {
    Dom.text('status-text', msg);
  }

  /* ── Screen states ── */
  const SCREEN_CLASSES = ['screen--exit', 'screen--revealed', 'screen--correct', 'screen--loading'];

  function clearScreen(...keep) {
    const s = Dom.get('screen');
    SCREEN_CLASSES.forEach(c => { if (!keep.includes(c)) s.classList.remove(c); });
  }

  async function exitScreen() {
    clearScreen();
    Dom.get('screen').classList.add('screen--exit');
    await sleep(280);
  }

  /* ── Reveal ── */
  function revealPokemon(correct) {
    revealed = true;
    const screen = Dom.get('screen');
    clearScreen();
    screen.classList.add('screen--revealed');
    if (correct) screen.classList.add('screen--flash');
    const img = Dom.get('pokemon-img');
    img.style.filter = 'none';

    const names = getNames();
    const displayName = (lang === 'fr' ? names.fr : names.en).toUpperCase();
    Dom.text('pokemon-name', displayName);
    if (correct) Dom.get('pokemon-name').classList.add('correct');
    persist();
  }

  /* ── Prefetch ── */
  function prefetchNext() {
    nextPromise = Api.loadPokemon(randomId()).catch(() => { nextPromise = null; });
  }

  /* ── XP ── */
  function addXP() {
    xp++;
    if (xp >= CONFIG.LEVEL_THRESHOLD) {
      xp = 0;
      level++;
      onLevelUp();
    }
    updateXP();
  }

  function onLevelUp() {
    Sfx.playLevelUp();
    LevelPopup.show(level, lang);
    const el = Dom.get('level-display');
    if (el) Dom.pulse(el, 'level-up-flash', 1500);
    Toast.show(T[lang].toastLevelUp(level), CONFIG.TOAST_LONG);
  }

  /* ── New Pokémon ── */
  async function newPokemon() {
    if (loading) return;
    loading  = true;
    hintStep = 0;

    const input = Dom.get('guess-input');

    await exitScreen();

    clearScreen();
    Dom.text('pokemon-name', '');
    Dom.get('pokemon-name').classList.remove('correct');
    setStatus(T[lang].statusLoad);
    input.value = '';
    input.classList.remove('shake');
    input.blur();

    try {
      const payload = nextPromise ? await nextPromise : await Api.loadPokemon(randomId());
      nextPromise = null;
      current     = payload;
      revealed    = false;

      const img = Dom.get('pokemon-img');
      img.src           = payload.imgUrl;
      img.style.filter  = 'brightness(0) drop-shadow(0 0 30px rgba(255,255,255,0.08))';
      img.style.opacity = '';
      img.style.transform = '';

      setStatus(T[lang].statusReady);
      loading = false;
      persist();
      prefetchNext();

      if (!('ontouchstart' in window)) input.focus();
    } catch (err) {
      loading = false;
      console.error('[Game] newPokemon error:', err);
      setStatus(T[lang].errRetry, 'wrong');
      Toast.show(T[lang].errRetry, CONFIG.TOAST_LONG);
    }
  }

  /* ── Check guess ── */
  function check() {
    if (!current || revealed || loading) return;
    const input = Dom.get('guess-input');
    const guess = input.value.trim();
    if (!guess) return;

    input.blur();

    const names     = getNames();
    const isCorrect =
      normalize(guess) === normalize(names.en) ||
      normalize(guess) === normalize(names.fr);

    if (isCorrect) {
      score.correct++;
      addXP();
      Sfx.play('correct');
      revealPokemon(true);
      setStatus(T[lang].statusCorrect);
      Toast.show(T[lang].toastCorrect);
      updateScore();
      setTimeout(newPokemon, CONFIG.AUTO_NEXT_DELAY);
    } else {
      score.wrong++;
      Sfx.play('wrong');
      Dom.shake(input);
      setStatus(T[lang].statusWrong);
      Toast.show(T[lang].toastWrong, CONFIG.TOAST_SHORT);
      updateScore();
      persist();
      if (!('ontouchstart' in window)) setTimeout(() => input.focus(), 50);
    }
  }

  function reveal() {
    if (!current || loading) return;
    if (revealed) {
      Sfx.play('ui');
      Toast.show(T[lang].toastNoMore, CONFIG.TOAST_SHORT);
      return;
    }
    Sfx.play('reveal');
    revealPokemon(false);
    setStatus(T[lang].statusReveal);
    Toast.show(T[lang].toastReveal, CONFIG.REVEAL_DELAY);
  }

  function hint() {
    if (!current || loading) return;
    if (revealed) {
      Sfx.play('ui');
      Toast.show(T[lang].toastNoMore, CONFIG.TOAST_SHORT);
      return;
    }
    Sfx.play('hint');
    const names   = getNames();
    const name    = lang === 'fr' ? names.fr : names.en;
    const len     = CONFIG.HINT_STEPS[Math.min(hintStep, CONFIG.HINT_STEPS.length - 1)];
    hintStep      = Math.min(hintStep + 1, CONFIG.HINT_STEPS.length - 1);
    const hintStr = name.slice(0, len).toUpperCase() + '...';
    const hintMsg = T[lang].hint(hintStr);
    setStatus(hintMsg);
    Toast.show(T[lang].toastHint(hintMsg), CONFIG.TOAST_LONG);
  }

  /* ── Toggle lang ── */
  function toggleLang() {
    Sfx.play('ui');
    lang = lang === 'fr' ? 'en' : 'fr';
    requestAnimationFrame(applyLang);
  }

  /* ── Toggle mute ── */
  function toggleMute() {
    Sfx.setMuted(!Sfx.isMuted());
    syncMuteBtn();
    persist();
  }

  /* ── Event binding ── */
  function bindEvents() {
    Dom.get('btn-guess').addEventListener('click',  () => { Sfx.play('ui'); check(); });
    Dom.get('btn-new').addEventListener('click',    () => { Sfx.play('newmon'); newPokemon(); });
    Dom.get('btn-lang').addEventListener('click',   toggleLang);
    Dom.get('btn-mute').addEventListener('click',   toggleMute);
    getHintBtn()?.addEventListener('click',   hint);
    getRevealBtn()?.addEventListener('click', reveal);

    Dom.get('guess-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { Sfx.play('ui'); check(); }
    });

    document.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });
    });
  }

  /* ── Init ── */
  async function init() {
    restoreSave();
    applyLang();
    updateScore();
    LevelPopup.init();
    Sfx.preload();

    if (lastPokemonId !== null) {
      try {
        const payload = await Api.loadPokemon(lastPokemonId);
        current  = payload;
        revealed = wasRevealed;
        const img = Dom.get('pokemon-img');
        img.src = payload.imgUrl;

        if (revealed) {
          revealPokemon(false);
        } else {
          img.style.filter = 'brightness(0) drop-shadow(0 0 30px rgba(255,255,255,0.08))';
          setStatus(T[lang].statusReady);
        }
        prefetchNext();
      } catch {
        newPokemon();
      }
    } else {
      newPokemon();
    }

    bindEvents();
  }

  document.addEventListener('DOMContentLoaded', init);

  /* API publique minimale */
  return { newPokemon, check, reveal, hint, toggleLang };
})();
