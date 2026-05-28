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
    lblCorrect   : 'CORRECT',
    lblWrong     : 'RATÉ',
    lblLevel     : 'NIVEAU',
    lblNew       : 'NOUVEAU POKÉMON',
    lblHint      : 'INDICE',
    lblReveal    : 'RÉVÉLER',
    popupEyebrow : 'LEVEL UP',
    popupLevel   : (lvl) => `NIVEAU ${lvl}`,
    hint         : (l)   => `COMMENCE PAR : ${l}`,
    toastCorrect : '✓ BONNE RÉPONSE !',
    toastWrong   : '✗ RÉESSAIE !',
    toastReveal  : '👁 RÉVÉLÉ',
    toastHint    : (h)   => `💡 ${h}`,
    toastNoMore  : 'CHARGE UN NOUVEAU POKÉMON',
    toastLevelUp : (lvl) => `🏆 NIVEAU ${lvl} !`,
    xpLabel      : (xp)  => `${xp} / ${CONFIG.LEVEL_THRESHOLD} XP`,
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
    lblCorrect   : 'CORRECT',
    lblWrong     : 'WRONG',
    lblLevel     : 'LEVEL',
    lblNew       : 'NEW POKÉMON',
    lblHint      : 'HINT',
    lblReveal    : 'REVEAL',
    popupEyebrow : 'LEVEL UP',
    popupLevel   : (lvl) => `LEVEL ${lvl}`,
    hint         : (l)   => `STARTS WITH: ${l}`,
    toastCorrect : '✓ CORRECT!',
    toastWrong   : '✗ TRY AGAIN!',
    toastReveal  : '👁 REVEALED',
    toastHint    : (h)   => `💡 ${h}`,
    toastNoMore  : 'LOAD A NEW POKEMON',
    toastLevelUp : (lvl) => `🏆 LEVEL ${lvl}!`,
    xpLabel      : (xp)  => `${xp} / ${CONFIG.LEVEL_THRESHOLD} XP`,
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
    el.classList.add('toast--show');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('toast--show'), duration);
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
    const popup = Dom.get('popup-levelup');
    Dom.text('popup-eyebrow', T[lang].popupEyebrow);
    Dom.text('popup-level',   T[lang].popupLevel(lvl));
    popup.hidden = false;
    clearTimeout(closeTimer);
    closeTimer = setTimeout(hide, CONFIG.LEVELUP_AUTO_CLOSE);
  }

  function hide() {
    Dom.get('popup-levelup').hidden = true;
  }

  function init() {
    Dom.get('popup-close').addEventListener('click', hide);
    Dom.get('popup-levelup').addEventListener('click', (e) => {
      if (e.target === Dom.get('popup-levelup') ||
          e.target.classList.contains('popup__backdrop')) hide();
    });
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
    const on  = document.getElementById('icon-sound-on');
    const off = document.getElementById('icon-sound-off');
    if (!on || !off) return;
    on.style.display  = Sfx.isMuted() ? 'none'  : '';
    off.style.display = Sfx.isMuted() ? ''      : 'none';
  }

  function updateScore() {
    Dom.text('score-correct', score.correct);
    Dom.text('score-wrong',   score.wrong);
  }

  function updateXP() {
    const pct    = xp / CONFIG.LEVEL_THRESHOLD;
    const offset = CONFIG.XP_CIRC * (1 - pct);
    const fill   = Dom.get('xp-ring-fill');
    if (fill) fill.style.strokeDashoffset = offset;
    Dom.text('level-num', level);
    Dom.text('xp-label',  T[lang].xpLabel(xp));
    const bar = Dom.get('xp-bar-fill');
    if (bar) bar.style.width = `${pct * 100}%`;
  }

  function applyLang() {
    const t = T[lang];
    Dom.text('input-label', t.inputLabel);
    Dom.get('guess-input').placeholder = t.inputPH;
    Dom.text('lbl-correct', t.lblCorrect);
    Dom.text('lbl-wrong',   t.lblWrong);
    Dom.text('lbl-level',   t.lblLevel);
    Dom.text('lbl-new',     t.lblNew);
    Dom.text('lbl-hint',    t.lblHint);
    Dom.text('lbl-reveal',  t.lblReveal);
    Dom.text('lang-label',  lang.toUpperCase());
    updateXP();
    updateScore();
    if (revealed && current) {
      const names = getNames();
      Dom.text('pokemon-name', (lang === 'fr' ? names.fr : names.en).toUpperCase());
    }
  }

  /* ── Statut écran ── */
  const STATUS_CLASSES = ['screen__status--correct', 'screen__status--wrong', 'screen__status--reveal'];

  /**
   * @param {string} msg
   * @param {'correct'|'wrong'|'reveal'|''} [type]
   */
  function setStatus(msg, type = '') {
    const el = Dom.get('screen-status');
    STATUS_CLASSES.forEach(c => el.classList.remove(c));
    if (type) el.classList.add(`screen__status--${type}`);
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
    if (correct) {
      screen.classList.add('screen--correct');
      Dom.get('pokemon-img').style.filter = 'none drop-shadow(0 0 40px rgba(0,229,160,0.4))';
    } else {
      Dom.get('pokemon-img').style.filter = 'none';
    }
    const names = getNames();
    const displayName = (lang === 'fr' ? names.fr : names.en).toUpperCase();
    Dom.text('pokemon-name', displayName);
    const revealEl = Dom.get('reveal-name');
    revealEl.classList.remove('reveal-name--show');
    void revealEl.offsetWidth;
    revealEl.classList.add('reveal-name--show');
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
    const el = Dom.get('level-num');
    if (el) Dom.pulse(el, 'level-flash', 1200);
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
    Dom.get('reveal-name').classList.remove('reveal-name--show');
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
      setStatus(T[lang].statusCorrect, 'correct');
      Toast.show(T[lang].toastCorrect);
      History.push((lang === 'fr' ? names.fr : names.en).toUpperCase(), true);
      updateScore();
      setTimeout(newPokemon, CONFIG.AUTO_NEXT_DELAY);
    } else {
      score.wrong++;
      Sfx.play('wrong');
      Dom.shake(input);
      setStatus(T[lang].statusWrong, 'wrong');
      Toast.show(T[lang].toastWrong, CONFIG.TOAST_SHORT);
      History.push(guess.toUpperCase(), false);
      updateScore();
      persist();
      if (!('ontouchstart' in window)) setTimeout(() => input.focus(), 50);
    }
  }

  /* ── Reveal button ── */
  function reveal() {
    if (!current || loading) return;
    if (revealed) {
      Sfx.play('ui');
      Toast.show(T[lang].toastNoMore, CONFIG.TOAST_SHORT);
      return;
    }
    Sfx.play('reveal');
    revealPokemon(false);
    setStatus(T[lang].statusReveal, 'reveal');
    Toast.show(T[lang].toastReveal, CONFIG.REVEAL_DELAY);
  }

  /* ── Hint ── */
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
    Dom.get('btn-hint').addEventListener('click',   hint);
    Dom.get('btn-reveal').addEventListener('click', reveal);
    Dom.get('btn-mute').addEventListener('click',   toggleMute);

    Dom.get('guess-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { Sfx.play('ui'); check(); }
    });

    /* Empêche zoom iOS sur double-tap boutons */
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
