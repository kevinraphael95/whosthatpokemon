/* ============================================================
   WHO'S THAT POKÉMON — game.js
   ============================================================ */

const Game = (() => {

  // ── State ──────────────────────────────────────────────────
  let current = null;
  let lang = 'fr';
  let score = { correct: 0, wrong: 0 };
  let hintUsed = false;
  let revealed = false;
  let loading = false;

  // ── Translations ──────────────────────────────────────────
  const T = {
    fr: {
      inputLabel : 'ENTREZ LE NOM',
      inputPH    : 'Tape le nom...',
      statusReady: 'PRÊT',
      statusLoad : 'CHARGEMENT...',
      statusCorrect: 'BONNE RÉP. !',
      statusWrong: 'MAUVAISE RÉP.',
      statusReveal: 'RÉVÉLÉ',
      btnGuess   : 'DEVINER',
      btnNew     : '— NOUVEAU POKÉMON —',
      btnHint    : 'INDICE',
      btnReveal  : 'RÉVÉLER',
      btnLang    : 'FR / EN',
      hint       : (letters) => `COMMENCE PAR : ${letters}`,
      toastCorrect: '✓ BONNE RÉPONSE !',
      toastWrong  : '✗ RÉESSAIE !',
      toastReveal : '👁 RÉVÉLÉ',
      toastHint   : (h) => `💡 ${h}`,
      toastNoMore : 'CHARGE UN NOUVEAU POKÉMON DABORD',
    },
    en: {
      inputLabel : 'ENTER NAME',
      inputPH    : 'Type a name...',
      statusReady: 'READY',
      statusLoad : 'LOADING...',
      statusCorrect: 'CORRECT !',
      statusWrong: 'WRONG !',
      statusReveal: 'REVEALED',
      btnGuess   : 'GUESS',
      btnNew     : '— NEW POKÉMON —',
      btnHint    : 'HINT',
      btnReveal  : 'REVEAL',
      btnLang    : 'EN / FR',
      hint       : (letters) => `STARTS WITH: ${letters}`,
      toastCorrect: '✓ CORRECT !',
      toastWrong  : '✗ TRY AGAIN !',
      toastReveal : '👁 REVEALED',
      toastHint   : (h) => `💡 ${h}`,
      toastNoMore : 'LOAD A NEW POKEMON FIRST',
    }
  };

  // ── DOM refs ──────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const els = {
    img        : () => $('pokemon-img'),
    screen     : () => $('screen'),
    overlay    : () => $('screen-overlay'),
    prompt     : () => $('screen-prompt'),
    typebar    : () => $('type-bar'),
    miniStatus : () => $('status-text'),
    miniName   : () => $('pokemon-name'),
    miniScore  : () => $('score-display'),
    input      : () => $('guess-input'),
    inputLabel : () => $('input-label'),
    btnGuess   : () => $('btn-guess'),
    btnNew     : () => $('btn-new'),
    btnLang    : () => $('btn-lang'),
  };

  // ── Toast ─────────────────────────────────────────────────
  let toastEl = null;
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
    els.inputLabel().textContent = t.inputLabel;
    els.input().placeholder = t.inputPH;
    els.btnGuess().querySelector('.btn__top').textContent = t.btnGuess;
    els.btnNew().querySelector('.btn__top').textContent = t.btnNew;
    document.querySelector('.btn--lang .btn__top').textContent = t.btnLang;
    document.querySelector('.btn--hint .btn__top').textContent = t.btnHint;
    document.querySelector('.btn--reveal .btn__top').textContent = t.btnReveal;
    updateScore();
  }

  function toggleLang() {
    lang = lang === 'fr' ? 'en' : 'fr';
    applyLang();
  }

  // ── Score ─────────────────────────────────────────────────
  function updateScore() {
    els.miniScore().innerHTML = `✓ ${score.correct} &nbsp;✗ ${score.wrong}`;
  }

  // ── API helpers ───────────────────────────────────────────
  async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // ── New Pokémon ───────────────────────────────────────────
  async function newPokemon() {
    if (loading) return;
    loading = true;
    hintUsed = false;
    revealed = false;

    // Reset UI
    const screen = els.screen();
    screen.classList.remove('screen--revealed', 'screen--flash');
    els.overlay().classList.remove('visible');
    els.typebar().innerHTML = '';
    els.miniName().textContent = '';
    els.miniName().classList.remove('correct');
    els.miniStatus().textContent = T[lang].statusLoad;
    screen.classList.add('screen--loading');
    els.input().value = '';
    els.input().classList.remove('shake');

    try {
      const id = Math.floor(Math.random() * 1025) + 1;

      // Fetch concurrently
      const data = await fetchJSON(`https://pokeapi.co/api/v2/pokemon/${id}`);
      const species = await fetchJSON(data.species.url);

      current = { data, species };

      // Set image (preload)
      const imgUrl = data.sprites.other['official-artwork'].front_default
                  || data.sprites.front_default;

      await new Promise((resolve, reject) => {
        const tmp = new Image();
        tmp.onload = resolve;
        tmp.onerror = reject;
        tmp.src = imgUrl;
      });

      els.img().src = imgUrl;
      screen.classList.remove('screen--loading');
      els.miniStatus().textContent = T[lang].statusReady;

    } catch (err) {
      console.error(err);
      screen.classList.remove('screen--loading');
      els.miniStatus().textContent = 'ERREUR';
      showToast('API ERROR – RETRY', 3000);
    }

    loading = false;
  }

  // ── Check guess ───────────────────────────────────────────
  function check() {
    if (!current || revealed) return;

    const guess = els.input().value.trim().toLowerCase();
    if (!guess) return;

    const enName = current.data.name.toLowerCase();
    const frEntry = current.species.names.find(n => n.language.name === 'fr');
    const frName = frEntry ? frEntry.name.toLowerCase() : '';

    const normalize = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g,'');

    const isCorrect = normalize(guess) === normalize(enName)
                   || normalize(guess) === normalize(frName);

    if (isCorrect) {
      revealPokemon(true);
      score.correct++;
      els.miniStatus().textContent = T[lang].statusCorrect;
      showToast(T[lang].toastCorrect);
    } else {
      score.wrong++;
      els.input().classList.remove('shake');
      void els.input().offsetWidth; // reflow
      els.input().classList.add('shake');
      setTimeout(() => els.input().classList.remove('shake'), 400);
      els.miniStatus().textContent = T[lang].statusWrong;
      showToast(T[lang].toastWrong, 1500);
    }
    updateScore();
  }

  // ── Reveal ────────────────────────────────────────────────
  function reveal() {
    if (!current || revealed) return;
    revealPokemon(false);
    els.miniStatus().textContent = T[lang].statusReveal;
    showToast(T[lang].toastReveal, 2000);
  }

  function revealPokemon(correct) {
    revealed = true;
    const screen = els.screen();
    screen.classList.add('screen--revealed');
    if (correct) screen.classList.add('screen--flash');

    // Name
    const frEntry = current.species.names.find(n => n.language.name === 'fr');
    const frName = frEntry ? frEntry.name : current.data.name;
    const enName = current.data.name;

    const displayName = lang === 'fr' ? frName : enName;
    els.miniName().textContent = displayName.toUpperCase();
    if (correct) els.miniName().classList.add('correct');

    // Types
    const types = current.data.types;
    els.typebar().innerHTML = types
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
    if (!current) { showToast(T[lang].toastNoMore); return; }
    if (revealed)  { showToast(T[lang].toastNoMore); return; }

    const frEntry = current.species.names.find(n => n.language.name === 'fr');
    const name = lang === 'fr'
      ? (frEntry ? frEntry.name : current.data.name)
      : current.data.name;

    const hintLen = hintUsed ? Math.min(3, name.length) : 1;
    hintUsed = true;
    const hintStr = name.slice(0, hintLen).toUpperCase();
    const hintMsg = T[lang].hint(hintStr + '...');
    showToast(T[lang].toastHint(hintMsg), 3000);
    els.miniStatus().textContent = hintMsg;
  }

  // ── Keyboard ──────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') check();
  });

  // ── Init ──────────────────────────────────────────────────
  applyLang();
  newPokemon();

  // Public API
  return { newPokemon, toggleLang, check, reveal, hint };

})();
