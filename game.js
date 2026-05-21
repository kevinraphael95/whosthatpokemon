/* ============================================================
   WHO'S THAT POKÉMON — game.js  (optimised)
   ============================================================ */

const Game = (() => {

  // ── State ──────────────────────────────────────────────────
  let current  = null;
  let next     = null;          // prefetch slot
  let lang     = 'fr';
  let score    = { correct: 0, wrong: 0 };
  let hintStep = 0;             // 0 = unused, 1 = first hint, 2 = extended
  let revealed = false;
  let loading  = false;

  // ── Translations ──────────────────────────────────────────
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
      hint         : (letters) => `COMMENCE PAR : ${letters}`,
      toastCorrect : '✓ BONNE RÉPONSE !',
      toastWrong   : '✗ RÉESSAIE !',
      toastReveal  : '👁 RÉVÉLÉ',
      toastHint    : (h) => `💡 ${h}`,
      toastNoMore  : 'CHARGE UN NOUVEAU POKÉMON D\'ABORD',
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
      hint         : (letters) => `STARTS WITH: ${letters}`,
      toastCorrect : '✓ CORRECT !',
      toastWrong   : '✗ TRY AGAIN !',
      toastReveal  : '👁 REVEALED',
      toastHint    : (h) => `💡 ${h}`,
      toastNoMore  : 'LOAD A NEW POKEMON FIRST',
    },
  };

  // ── DOM cache (initialised once) ──────────────────────────
  const el = {};

  function cacheDom() {
    const ids = [
      'pokemon-img', 'screen', 'screen-overlay', 'screen-prompt',
      'type-bar', 'status-text', 'pokemon-name', 'score-display',
      'guess-input', 'input-label', 'btn-guess', 'btn-new', 'btn-lang',
    ];
    ids.forEach(id => { el[id] = document.getElementById(id); });
    el.btnHint   = document.querySelector('.btn--hint');
    el.btnReveal = document.querySelector('.btn--reveal');
  }

  // ── Toast ─────────────────────────────────────────────────
  let toastEl    = null;
  let toastTimer = null;

  function showToast(msg, duration = 2200) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration);
  }

  // ── Language ──────────────────────────────────────────────
  function applyLang() {
    const t = T[lang];
    el['input-label'].textContent = t.inputLabel;
    el['guess-input'].placeholder = t.inputPH;
    el['btn-guess'].querySelector('.btn__top').textContent  = t.btnGuess;
    el['btn-new'].querySelector('.btn__top').textContent    = t.btnNew;
    el['btn-lang'].querySelector('.btn__top').textContent   = t.btnLang;
    el.btnHint.querySelector('.btn__top').textContent       = t.btnHint;
    el.btnReveal.querySelector('.btn__top').textContent     = t.btnReveal;
    updateScore();
  }

  function toggleLang() {
    lang = lang === 'fr' ? 'en' : 'fr';
    applyLang();
  }

  // ── Score ─────────────────────────────────────────────────
  function updateScore() {
    el['score-display'].innerHTML = `✓ ${score.correct} &nbsp;✗ ${score.wrong}`;
  }

  // ── Fetch + cache ─────────────────────────────────────────
  const apiCache = new Map();

  async function fetchJSON(url) {
    if (apiCache.has(url)) return apiCache.get(url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    apiCache.set(url, data);
    return data;
  }

  function preloadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload  = () => resolve(url);
      img.onerror = reject;
      img.src = url;
    });
  }

  // ── Load a single Pokémon by id (returns payload) ─────────
  async function loadById(id) {
    const [data, species] = await Promise.all([
      fetchJSON(`https://pokeapi.co/api/v2/pokemon/${id}`),
      fetchJSON(`https://pokeapi.co/api/v2/pokemon-species/${id}`),
    ]);

    const imgUrl =
      data.sprites.other?.['official-artwork']?.front_default ||
      data.sprites.front_default;

    await preloadImage(imgUrl);          // image ready before we swap
    return { data, species, imgUrl };
  }

  // ── Background prefetch of next Pokémon ──────────────────
  function prefetchNext() {
    const id = Math.floor(Math.random() * 1025) + 1;
    next = loadById(id).catch(() => { next = null; }); // store the Promise
  }

  // ── New Pokémon ───────────────────────────────────────────
  async function newPokemon() {
    if (loading) return;
    loading  = true;
    hintStep = 0;
    revealed = false;

    const screen = el['screen'];

    // 1 – fade out current image
    screen.classList.add('screen--exit');
    await sleep(300);

    // 2 – reset UI while hidden
    screen.classList.remove('screen--revealed', 'screen--flash', 'screen--exit');
    el['type-bar'].innerHTML   = '';
    el['pokemon-name'].textContent = '';
    el['pokemon-name'].classList.remove('correct');
    el['status-text'].textContent  = T[lang].statusLoad;
    el['guess-input'].value        = '';
    el['guess-input'].classList.remove('shake');

    try {
      // 3 – use prefetched data if ready, otherwise fetch now
      const payload = next ? await next : await loadById(randomId());
      current = payload;

      el['pokemon-img'].src         = payload.imgUrl;
      el['status-text'].textContent = T[lang].statusReady;

      // 4 – start prefetching next one silently
      next = null;
      prefetchNext();

    } catch (err) {
      console.error(err);
      el['status-text'].textContent = 'ERREUR';
      showToast('API ERROR – RETRY', 3000);
      current = null;
    }

    loading = false;
    el['guess-input'].focus();
  }

  function randomId() {
    return Math.floor(Math.random() * 1025) + 1;
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // ── Normalise for comparison ──────────────────────────────
  function normalize(s) {
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .toLowerCase();
  }

  function getNames() {
    if (!current) return { en: '', fr: '' };
    const frEntry = current.species.names.find(n => n.language.name === 'fr');
    return {
      en: current.data.name,
      fr: frEntry ? frEntry.name : current.data.name,
    };
  }

  // ── Check guess ───────────────────────────────────────────
  function check() {
    if (!current || revealed) return;

    const guess = el['guess-input'].value.trim();
    if (!guess) return;

    const names    = getNames();
    const isCorrect =
      normalize(guess) === normalize(names.en) ||
      normalize(guess) === normalize(names.fr);

    if (isCorrect) {
      score.correct++;
      revealPokemon(true);
      el['status-text'].textContent = T[lang].statusCorrect;
      showToast(T[lang].toastCorrect);
    } else {
      score.wrong++;
      shake(el['guess-input']);
      el['status-text'].textContent = T[lang].statusWrong;
      showToast(T[lang].toastWrong, 1500);
      el['guess-input'].select();
    }

    updateScore();
  }

  function shake(node) {
    node.classList.remove('shake');
    void node.offsetWidth;           // force reflow
    node.classList.add('shake');
    node.addEventListener('animationend', () => node.classList.remove('shake'), { once: true });
  }

  // ── Reveal ────────────────────────────────────────────────
  function reveal() {
    if (!current || revealed) return;
    score.wrong++;                   // penalty for revealing
    revealPokemon(false);
    el['status-text'].textContent = T[lang].statusReveal;
    showToast(T[lang].toastReveal, 2000);
    updateScore();
  }

  function revealPokemon(correct) {
    revealed = true;

    const screen = el['screen'];
    screen.classList.add('screen--revealed');
    if (correct) screen.classList.add('screen--flash');

    // Name
    const names       = getNames();
    const displayName = lang === 'fr' ? names.fr : names.en;
    el['pokemon-name'].textContent = displayName.toUpperCase();
    if (correct) el['pokemon-name'].classList.add('correct');

    // Types
    el['type-bar'].innerHTML = current.data.types
      .map((t, i) =>
        `<span class="type-badge type-${t.type.name}"
               style="animation-delay:${i * 0.15}s">
           ${t.type.name.toUpperCase()}
         </span>`
      )
      .join('');
  }

  // ── Hint ──────────────────────────────────────────────────
  function hint() {
    if (!current)  { showToast(T[lang].toastNoMore); return; }
    if (revealed)  { showToast(T[lang].toastNoMore); return; }

    const names = getNames();
    const name  = lang === 'fr' ? names.fr : names.en;

    // Progressive: 1 letter → 3 letters → 5 letters
    const steps  = [1, 3, 5];
    const len    = steps[Math.min(hintStep, steps.length - 1)];
    hintStep     = Math.min(hintStep + 1, steps.length - 1);

    const hintStr = name.slice(0, len).toUpperCase() + '...';
    const hintMsg = T[lang].hint(hintStr);

    el['status-text'].textContent = hintMsg;
    showToast(T[lang].toastHint(hintMsg), 3000);
  }

  // ── Keyboard ──────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') check();
  });

  // ── Init ──────────────────────────────────────────────────
  function init() {
    cacheDom();
    applyLang();
    newPokemon();

    // Wire buttons via JS (no inline onclick needed in HTML,
    // but kept compatible if HTML still has onclick attrs)
    el['btn-guess'].addEventListener('click', check);
    el['btn-new'].addEventListener('click', newPokemon);
    el['btn-lang'].addEventListener('click', toggleLang);
    el.btnHint.addEventListener('click', hint);
    el.btnReveal.addEventListener('click', reveal);
  }

  document.addEventListener('DOMContentLoaded', init);

  // Public API (kept for inline onclick compatibility)
  return { newPokemon, toggleLang, check, reveal, hint };

})();
