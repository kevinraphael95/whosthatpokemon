/* ============================================================
   WHO'S THAT POKÉMON — game.js  (refacto pro)
   ============================================================ */

/* ── CONFIG — toutes les constantes au même endroit ────────── */
const CONFIG = {
  MAX_POKEMON_ID   : 1025,
  LEVEL_THRESHOLD  : 50,
  MASTER_VOLUME    : 0.95,
  SAVE_KEY         : 'wtp_save',
  TOAST_DURATION   : 2200,
  TOAST_SHORT      : 1500,
  TOAST_LONG       : 3000,
  REVEAL_DELAY     : 2000,
  AUTO_NEXT_DELAY  : 1500,
  LEVELUP_HIDE     : 6000,
  HINT_STEPS       : [1, 3, 5],
  LEVELUP_SOUNDS   : {
    picross : 'https://raw.githubusercontent.com/kevinraphael95/random-useful-stuff/main/pokemonlevelup/pok-mon-picross.mp3',
    bank    : 'https://raw.githubusercontent.com/kevinraphael95/random-useful-stuff/main/pokemonlevelup/pok-mon-bank.mp3',
  },
};

/* ── TRANSLATIONS ────────────────────────────────────────────── */
const T = {
  fr: {
    inputLabel   : 'ENTREZ LE NOM',
    inputPH      : 'Tape le nom...',
    statusReady  : 'PRÊT',
    statusLoad   : 'CHARGEMENT...',
    statusCorrect: 'BONNE RÉP. !',
    statusWrong  : 'MAUVAISE RÉP.',
    statusReveal : 'RÉVÉLÉ',
    btnGuess     : 'DEVINER',
    btnNew       : '— NOUVEAU POKÉMON —',
    btnHint      : 'INDICE',
    btnReveal    : 'RÉVÉLER',
    btnLang      : 'FR / EN',
    screenLabel  : 'DISPLAY / AFFICHAGE',
    hint         : (l) => `COMMENCE PAR : ${l}`,
    toastCorrect : '✓ BONNE RÉPONSE !',
    toastWrong   : '✗ RÉESSAIE !',
    toastReveal  : '👁 RÉVÉLÉ',
    toastHint    : (h) => `💡 ${h}`,
    toastNoMore  : 'CHARGE UN NOUVEAU POKÉMON',
    toastLevelUp : (lvl) => `🏆 NIVEAU ${lvl} !`,
    levelLabel   : (lvl, xp) => `LVL ${lvl}  ·  ${xp}/${CONFIG.LEVEL_THRESHOLD} XP`,
    popupTitle   : 'NIVEAU SUPÉRIEUR',
    popupSub     : (lvl) => `NIVEAU ${lvl} ATTEINT`,
    errRetry     : 'API ERROR – RETRY',
    errLabel     : 'ERREUR',
  },
  en: {
    inputLabel   : 'ENTER NAME',
    inputPH      : 'Type a name...',
    statusReady  : 'READY',
    statusLoad   : 'LOADING...',
    statusCorrect: 'CORRECT !',
    statusWrong  : 'WRONG !',
    statusReveal : 'REVEALED',
    btnGuess     : 'GUESS',
    btnNew       : '— NEW POKÉMON —',
    btnHint      : 'HINT',
    btnReveal    : 'REVEAL',
    btnLang      : 'EN / FR',
    screenLabel  : 'DISPLAY / AFFICHAGE',
    hint         : (l) => `STARTS WITH: ${l}`,
    toastCorrect : '✓ CORRECT !',
    toastWrong   : '✗ TRY AGAIN !',
    toastReveal  : '👁 REVEALED',
    toastHint    : (h) => `💡 ${h}`,
    toastNoMore  : 'LOAD A NEW POKEMON',
    toastLevelUp : (lvl) => `🏆 LEVEL ${lvl} !`,
    levelLabel   : (lvl, xp) => `LVL ${lvl}  ·  ${xp}/${CONFIG.LEVEL_THRESHOLD} XP`,
    popupTitle   : 'LEVEL UP',
    popupSub     : (lvl) => `LEVEL ${lvl} REACHED`,
    errRetry     : 'API ERROR – RETRY',
    errLabel     : 'ERROR',
  },
};

/* ── STORAGE — lecture / écriture isolées ───────────────────── */
const Storage = {
  load() {
    try {
      const raw = localStorage.getItem(CONFIG.SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  save(state) {
    try {
      localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Save error:', e);
    }
  },
};

/* ── API — fetch + cache + préchargement image ──────────────── */
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
    const imgUrl  =
      data.sprites.other?.['official-artwork']?.front_default ||
      data.sprites.front_default;
    await preloadImage(imgUrl);
    return { data, species, imgUrl };
  }

  return { loadPokemon };
})();

/* ── AUDIO ──────────────────────────────────────────────────── */
const Audio = (() => {
  let actx = null;
  const buffers = {};

  function ctx() {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    return actx;
  }

  async function preload() {
    const c = ctx();
    for (const [key, url] of Object.entries(CONFIG.LEVELUP_SOUNDS)) {
      try {
        const res = await fetch(url);
        const ab  = await res.arrayBuffer();
        buffers[key] = await c.decodeAudioData(ab);
      } catch (e) {
        console.warn(`Audio preload failed [${key}]:`, e);
      }
    }
  }

  function playBuffer(key, volume = 0.6) {
    const c   = ctx();
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

  /* Toutes les définitions de sons en un seul endroit */
  const SOUNDS = {
    ui() {
      const c = ctx(), now = c.currentTime;
      const osc = c.createOscillator(), gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.linearRampToValueAtTime(620, now + 0.08);
      gain.gain.setValueAtTime(CONFIG.MASTER_VOLUME * 0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain); gain.connect(c.destination);
      osc.start(now); osc.stop(now + 0.12);
    },
    click() {
      const c = ctx(), now = c.currentTime;
      const osc = c.createOscillator(), gain = c.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(500, now + 0.06);
      gain.gain.setValueAtTime(CONFIG.MASTER_VOLUME * 0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain); gain.connect(c.destination);
      osc.start(now); osc.stop(now + 0.08);
    },
    correct() {
      const c = ctx(), now = c.currentTime;
      [523, 659, 784].forEach((freq, i) => {
        const osc = c.createOscillator(), gain = c.createGain();
        const t = now + i * 0.12;
        osc.type = 'sine'; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(CONFIG.MASTER_VOLUME * 0.6, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(gain); gain.connect(c.destination);
        osc.start(t); osc.stop(t + 0.2);
      });
    },
    wrong() {
      const c = ctx(), now = c.currentTime;
      const osc = c.createOscillator(), gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.25);
      gain.gain.setValueAtTime(CONFIG.MASTER_VOLUME * 0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain); gain.connect(c.destination);
      osc.start(now); osc.stop(now + 0.3);
    },
    reveal() {
      const c = ctx(), now = c.currentTime;
      [[392, 0], [494, 0.12], [587, 0.24]].forEach(([freq, delay]) => {
        const osc = c.createOscillator(), gain = c.createGain();
        const t = now + delay;
        osc.type = 'triangle'; osc.frequency.value = freq;
        gain.gain.setValueAtTime(CONFIG.MASTER_VOLUME * 0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.connect(gain); gain.connect(c.destination);
        osc.start(t); osc.stop(t + 0.25);
      });
    },
    hint() {
      const c = ctx(), now = c.currentTime;
      const osc = c.createOscillator(), gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.linearRampToValueAtTime(740, now + 0.15);
      gain.gain.setValueAtTime(CONFIG.MASTER_VOLUME * 0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain); gain.connect(c.destination);
      osc.start(now); osc.stop(now + 0.2);
    },
    newmon() {
      const c = ctx(), now = c.currentTime;
      const osc = c.createOscillator(), gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.35);
      gain.gain.setValueAtTime(CONFIG.MASTER_VOLUME * 0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain); gain.connect(c.destination);
      osc.start(now); osc.stop(now + 0.4);
    },
    levelup() {
      const c = ctx(), now = c.currentTime;
      [[523, 0], [659, 0.15], [784, 0.3], [988, 0.5], [784, 0.75]].forEach(([freq, delay]) => {
        const osc = c.createOscillator(), gain = c.createGain();
        const t = now + delay;
        osc.type = 'triangle'; osc.frequency.value = freq;
        gain.gain.setValueAtTime(CONFIG.MASTER_VOLUME * 0.6, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc.connect(gain); gain.connect(c.destination);
        osc.start(t); osc.stop(t + 0.5);
      });
    },
  };

  let muted = false;

  function play(type) {
    if (muted) return;
    try { SOUNDS[type]?.(); } catch (e) { console.warn('Audio error:', e); }
  }

  function playLevelUp() {
    if (muted) return;
    const key = Math.random() < 0.99 ? 'picross' : 'bank';
    playBuffer(key);
  }

  function setMuted(val) { muted = val; }
  function isMuted()     { return muted; }

  return { preload, play, playLevelUp, setMuted, isMuted };
})();

/* ── DOM — accès centralisé ─────────────────────────────────── */
const Dom = (() => {
  const ids = [
    'pokemon-img', 'screen', 'screen-overlay', 'screen-prompt',
    'status-text', 'pokemon-name', 'score-display',
    'guess-input', 'input-label', 'btn-guess', 'btn-new', 'btn-lang',
    'screen-label', 'level-display', 'btn-mute', 'xp-bar-fill',
  ];
  const el = {};

  function init() {
    ids.forEach(id => { el[id] = document.getElementById(id); });
    el.btnHint   = document.querySelector('.btn--hint');
    el.btnReveal = document.querySelector('.btn--reveal');
  }

  function get(id) { return el[id]; }

  function setText(id, text) {
    const node = el[id];
    if (node) node.textContent = text;
  }

  function setHtml(id, html) {
    const node = el[id];
    if (node) node.innerHTML = html;
  }

  return { init, get, setText, setHtml };
})();

/* ── TOAST ──────────────────────────────────────────────────── */
const Toast = (() => {
  let el    = null;
  let timer = null;

  function show(msg, duration = CONFIG.TOAST_DURATION) {
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('show'), duration);
  }

  return { show };
})();

/* ── LEVEL UP POPUP ─────────────────────────────────────────── */
const LevelUpPopup = (() => {
  let el = null;

  function init() {
    el = document.createElement('div');
    el.className = 'levelup-popup';
    el.innerHTML = `
      <div class="levelup-popup__inner">
        <div class="levelup-popup__title" id="popup-title"></div>
        <div class="levelup-popup__level" id="popup-level"></div>
        <button class="levelup-popup__close" id="popup-close">OK</button>
      </div>`;
    document.body.appendChild(el);
    document.getElementById('popup-close').addEventListener('click', hide);
  }

  function show(lvl, lang) {
    if (!el) init();
    document.getElementById('popup-title').textContent = T[lang].popupTitle;
    document.getElementById('popup-level').textContent = T[lang].popupSub(lvl);
    el.classList.add('show');
    setTimeout(hide, CONFIG.LEVELUP_HIDE);
  }

  function hide() { el?.classList.remove('show'); }

  return { show };
})();

/* ── GAME ───────────────────────────────────────────────────── */
const Game = (() => {
  /* State */
  let current       = null;
  let nextPromise   = null;
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

  function normalize(s) {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  function getNames() {
    if (!current) return { en: '', fr: '' };
    const find = (lang) =>
      current.species.names.find(n => n.language.name === lang)?.name
      ?? current.data.name;
    return { en: find('en'), fr: find('fr') };
  }

  /* ── Save / Load ── */
  function persist() {
    Storage.save({
      level,
      xp,
      correct       : score.correct,
      wrong         : score.wrong,
      muted         : Audio.isMuted(),
      lastPokemonId : current?.data?.id ?? lastPokemonId,
      wasRevealed   : revealed,
    });
  }

  function loadSave() {
    const s = Storage.load();
    if (!s) return;
    level         = s.level   || 1;
    xp            = s.xp      || 0;
    score.correct = s.correct || 0;
    score.wrong   = s.wrong   || 0;
    lastPokemonId = s.lastPokemonId || null;
    wasRevealed   = s.wasRevealed   || false;
    if (s.muted) {
      Audio.setMuted(true);
      const btnMute = Dom.get('btn-mute');
      if (btnMute) {
        btnMute.querySelector('.btn__top').textContent = '🔇';
        btnMute.classList.add('btn--muted');
      }
    }
  }

  /* ── UI updates ── */
  function updateScore() {
    Dom.setHtml('score-display', `✓ ${score.correct} &nbsp;✗ ${score.wrong}`);
  }

  function updateLevelDisplay() {
    Dom.setText('level-display', T[lang].levelLabel(level, xp));
    const fill = Dom.get('xp-bar-fill');
    if (fill) fill.style.width = `${(xp / CONFIG.LEVEL_THRESHOLD) * 100}%`;
  }

  function applyLang() {
    const t = T[lang];
    Dom.setText('input-label', t.inputLabel);
    Dom.get('guess-input').placeholder = t.inputPH;
    Dom.setText('screen-label', t.screenLabel);
    Dom.get('btn-guess').querySelector('.btn__top').textContent   = t.btnGuess;
    Dom.get('btn-new').querySelector('.btn__top').textContent     = t.btnNew;
    Dom.get('btnHint').querySelector('.btn__top').textContent     = t.btnHint;
    Dom.get('btnReveal').querySelector('.btn__top').textContent   = t.btnReveal;

    const status = Dom.get('status-text').textContent;
    if (status === T.fr.statusReady || status === T.en.statusReady) {
      Dom.setText('status-text', t.statusReady);
    }
    updateScore();
    updateLevelDisplay();
  }

  /* ── Screen transitions ── */
  async function exitScreen() {
    const img = Dom.get('pokemon-img');
    img.style.animation = 'none';
    img.style.filter    = 'brightness(0)';
    Dom.get('screen').classList.add('screen--exit');
    await sleep(300);
  }

  function resetImgStyle() {
    const img = Dom.get('pokemon-img');
    img.style.transition = '';
    img.style.filter     = '';
    img.style.opacity    = '';
    img.style.transform  = '';
  }

  /* ── Shake animation ── */
  function shake(node) {
    node.classList.remove('shake');
    void node.offsetWidth;
    node.classList.add('shake');
    node.addEventListener('animationend', () => node.classList.remove('shake'), { once: true });
  }

  /* ── XP / Level ── */
  function addXP() {
    xp++;
    if (xp >= CONFIG.LEVEL_THRESHOLD) {
      xp = 0;
      level++;
      triggerLevelUp();
    }
    updateLevelDisplay();
  }

  function triggerLevelUp() {
    Audio.playLevelUp();
    LevelUpPopup.show(level, lang);
    const lvlDisplay = Dom.get('level-display');
    if (lvlDisplay) {
      lvlDisplay.classList.add('level-up-flash');
      setTimeout(() => lvlDisplay.classList.remove('level-up-flash'), 1500);
    }
  }

  /* ── Reveal ── */
  function revealPokemon(correct) {
    revealed = true;
    resetImgStyle();
    const screen = Dom.get('screen');
    screen.classList.add('screen--revealed');
    if (correct) screen.classList.add('screen--flash');
    const names       = getNames();
    const displayName = (lang === 'fr' ? names.fr : names.en).toUpperCase();
    Dom.setText('pokemon-name', displayName);
    if (correct) Dom.get('pokemon-name').classList.add('correct');
    persist();
  }

  /* ── Prefetch ── */
  function prefetchNext() {
    nextPromise = Api.loadPokemon(randomId()).catch(() => { nextPromise = null; });
  }

  /* ── New Pokémon ── */
  async function newPokemon() {
    if (loading) return;
    loading  = true;
    hintStep = 0;

    const screen = Dom.get('screen');
    const input  = Dom.get('guess-input');

    await exitScreen();

    screen.classList.remove('screen--revealed', 'screen--flash', 'screen--exit');
    Dom.setText('pokemon-name', '');
    Dom.get('pokemon-name').classList.remove('correct');
    Dom.setText('status-text', T[lang].statusLoad);
    input.value = '';
    input.classList.remove('shake');
    input.blur();

    try {
      const payload = nextPromise ? await nextPromise : await Api.loadPokemon(randomId());
      nextPromise = null;
      current     = payload;
      revealed    = false;

      resetImgStyle();
      Dom.get('pokemon-img').src = payload.imgUrl;
      Dom.setText('status-text', T[lang].statusReady);
      loading = false;
      persist();
      prefetchNext();
    } catch (err) {
      loading = false;
      console.error('newPokemon error:', err);
      Dom.setText('status-text', T[lang].errLabel);
      Toast.show(T[lang].errRetry, CONFIG.TOAST_LONG);
    }
  }

  /* ── Check guess ── */
  function check() {
    if (!current || revealed) return;
    const input = Dom.get('guess-input');
    const guess = input.value.trim();
    if (!guess) return;

    input.blur(); /* ferme le clavier mobile */

    const names     = getNames();
    const isCorrect =
      normalize(guess) === normalize(names.en) ||
      normalize(guess) === normalize(names.fr);

    if (isCorrect) {
      score.correct++;
      addXP();
      Audio.play('correct');
      revealPokemon(true);
      Dom.setText('status-text', T[lang].statusCorrect);
      Toast.show(T[lang].toastCorrect);
      setTimeout(newPokemon, CONFIG.AUTO_NEXT_DELAY);
    } else {
      score.wrong++;
      Audio.play('wrong');
      shake(input);
      Dom.setText('status-text', T[lang].statusWrong);
      Toast.show(T[lang].toastWrong, CONFIG.TOAST_SHORT);
      input.select();
    }
    updateScore();
  }

  /* ── Reveal button ── */
  function reveal() {
    if (!current) return;
    if (revealed) {
      Audio.play('ui');
      Toast.show(T[lang].toastNoMore);
      return;
    }
    Audio.play('reveal');
    revealPokemon(false);
    Dom.setText('status-text', T[lang].statusReveal);
    Toast.show(T[lang].toastReveal, CONFIG.REVEAL_DELAY);
  }

  /* ── Hint ── */
  function hint() {
    if (!current) return;
    if (revealed) {
      Audio.play('ui');
      Toast.show(T[lang].toastNoMore);
      return;
    }
    Audio.play('hint');
    const names   = getNames();
    const name    = lang === 'fr' ? names.fr : names.en;
    const len     = CONFIG.HINT_STEPS[Math.min(hintStep, CONFIG.HINT_STEPS.length - 1)];
    hintStep      = Math.min(hintStep + 1, CONFIG.HINT_STEPS.length - 1);
    const hintStr = name.slice(0, len).toUpperCase() + '...';
    const hintMsg = T[lang].hint(hintStr);
    Dom.setText('status-text', hintMsg);
    Toast.show(T[lang].toastHint(hintMsg), CONFIG.TOAST_LONG);
  }

  /* ── Toggle lang ── */
  function toggleLang() {
    Audio.play('ui');
    lang = lang === 'fr' ? 'en' : 'fr';
    requestAnimationFrame(() => {
      applyLang();
      if (revealed && current) {
        const names = getNames();
        Dom.setText('pokemon-name', (lang === 'fr' ? names.fr : names.en).toUpperCase());
      }
    });
  }

  /* ── Toggle mute ── */
  function toggleMute() {
    Audio.setMuted(!Audio.isMuted());
    const btnMute = Dom.get('btn-mute');
    if (btnMute) {
      btnMute.querySelector('.btn__top').textContent = Audio.isMuted() ? '🔇' : '🔊';
      btnMute.classList.toggle('btn--muted', Audio.isMuted());
    }
    persist();
  }

  /* ── Init ── */
  async function init() {
    Dom.init();
    loadSave();
    applyLang();
    updateLevelDisplay();
    Audio.preload();

    /* Restaure la session précédente si possible */
    if (lastPokemonId !== null) {
      try {
        const payload = await Api.loadPokemon(lastPokemonId);
        current  = payload;
        revealed = wasRevealed;
        Dom.get('pokemon-img').src = payload.imgUrl;

        if (revealed) {
          revealPokemon(false);
        } else {
          resetImgStyle();
          Dom.get('pokemon-img').style.filter = 'brightness(0)';
          Dom.setText('status-text', T[lang].statusReady);
        }
        prefetchNext();
      } catch {
        newPokemon();
      }
    } else {
      newPokemon();
    }

    /* Écouteurs */
    Dom.get('btn-guess').addEventListener('click', () => { Audio.play('ui'); check(); });
    Dom.get('btn-new').addEventListener('click',   () => { Audio.play('newmon'); newPokemon(); });
    Dom.get('btn-lang').addEventListener('click',  toggleLang);
    Dom.get('btnHint').addEventListener('click',   hint);
    Dom.get('btnReveal').addEventListener('click', reveal);
    Dom.get('btn-mute')?.addEventListener('click', toggleMute);
    document.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
  }

  document.addEventListener('DOMContentLoaded', init);
  return { newPokemon, toggleLang, check, reveal, hint };
})();
