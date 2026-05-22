/* ============================================================
   WHO'S THAT POKÉMON — game.js
   ============================================================ */

const Game = (() => {

  // ── State ─────────────────────────────────────────────────
  let current  = null;
  let next     = null;
  let lang     = 'fr';
  let score    = { correct: 0, wrong: 0 };
  let hintStep = 0;
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
      screenLabel  : 'DISPLAY / AFFICHAGE',
      hint         : (l) => `COMMENCE PAR : ${l}`,
      toastCorrect : '✓ BONNE RÉPONSE !',
      toastWrong   : '✗ RÉESSAIE !',
      toastReveal  : '👁 RÉVÉLÉ',
      toastHint    : (h) => `💡 ${h}`,
      toastNoMore  : "CHARGE UN NOUVEAU POKÉMON D'ABORD",
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
      toastNoMore  : 'LOAD A NEW POKEMON FIRST',
    },
  };

  // ── DOM cache ─────────────────────────────────────────────
  const el = {};

  function cacheDom() {
    [
      'pokemon-img','screen','screen-overlay','screen-prompt',
      'type-bar','status-text','pokemon-name','score-display',
      'guess-input','input-label','btn-guess','btn-new','btn-lang',
      'screen-label',
    ].forEach(id => { el[id] = document.getElementById(id); });
    el.btnHint   = document.querySelector('.btn--hint');
    el.btnReveal = document.querySelector('.btn--reveal');
  }

  // ── Toast ─────────────────────────────────────────────────
  let toastEl = null, toastTimer = null;

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
    el['input-label'].textContent                          = t.inputLabel;
    el['guess-input'].placeholder                          = t.inputPH;
    el['screen-label'].textContent                         = t.screenLabel;
    el['btn-guess'].querySelector('.btn__top').textContent = t.btnGuess;
    el['btn-new'].querySelector('.btn__top').textContent   = t.btnNew;
    el['btn-lang'].querySelector('.btn__top').textContent  = t.btnLang;
    el.btnHint.querySelector('.btn__top').textContent      = t.btnHint;
    el.btnReveal.querySelector('.btn__top').textContent    = t.btnReveal;
    const status = el['status-text'].textContent;
    if (status === T['fr'].statusReady || status === T['en'].statusReady) {
      el['status-text'].textContent = t.statusReady;
    }
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

  // ── Load pokemon by id ────────────────────────────────────
  async function loadById(id) {
    const data = await fetchJSON(`https://pokeapi.co/api/v2/pokemon/${id}`);
    const species = await fetchJSON(data.species.url);
    const imgUrl =
      data.sprites.other?.['official-artwork']?.front_default ||
      data.sprites.front_default;
    await preloadImage(imgUrl);
    return { data, species, imgUrl };
  }

  // ── Prefetch ──────────────────────────────────────────────
  function prefetchNext() {
    const id = Math.floor(Math.random() * 1025) + 1;
    next = loadById(id).catch(() => { next = null; });
  }

  // ── Transition helpers ────────────────────────────────────
  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  async function exitScreen() {
      const screen = el['screen'];
      const img    = el['pokemon-img'];

      if (screen.classList.contains('screen--revealed')) {
        // Révélé ou deviné : fade out propre
        img.style.transition = 'filter 0.25s ease, opacity 0.25s ease, transform 0.25s ease';
        img.style.filter     = 'brightness(0)';
        img.style.opacity    = '0.3';
        img.style.transform  = 'scale(0.8) translateY(10px)';
        await sleep(280);
      } else {
        // Encore caché : glitch exit
        screen.classList.add('screen--exit');
        await sleep(300);
      }
    }

  function resetImgStyle() {
    const img = el['pokemon-img'];
    img.style.transition = '';
    img.style.filter     = '';
    img.style.opacity    = '';
    img.style.transform  = '';
  }

  // ── New Pokémon ───────────────────────────────────────────
  async function newPokemon() {
      if (loading) return;
      loading  = true;
      hintStep = 0;
      revealed = false;
      current  = null;

      const screen = el['screen'];

      await exitScreen();

      // Reset classes mais PAS le style img (on garde le fade out visible)
      screen.classList.remove('screen--revealed', 'screen--flash', 'screen--exit');
      el['type-bar'].innerHTML           = '';
      el['pokemon-name'].textContent     = '';
      el['pokemon-name'].classList.remove('correct');
      el['status-text'].textContent      = T[lang].statusLoad;
      el['guess-input'].value            = '';
      el['guess-input'].classList.remove('shake');

      try {
        const pendingNext = next;
        next = null;
        const payload = pendingNext ? await pendingNext : await loadById(randomId());
        current = payload;

        // Reset style img JUSTE AVANT d'affecter le nouveau src
        resetImgStyle();
        el['pokemon-img'].src         = payload.imgUrl;
        el['status-text'].textContent = T[lang].statusReady;

        prefetchNext();

        } catch (err) {
        console.error(err);
        resetImgStyle();
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

  // ── Normalise ─────────────────────────────────────────────
  function normalize(s) {
    return s
      .toLowerCase()           // ← DÉPLACE toLowerCase ICI, en premier
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  // ── Noms EN + FR ──────────────────────────────────────────
  function getNames() {
    if (!current) return { en: '', fr: '' };
    const frEntry = current.species.names.find(n => n.language.name === 'fr');
    const enEntry = current.species.names.find(n => n.language.name === 'en');
    return {
      en: enEntry ? enEntry.name : current.data.name,
      fr: frEntry ? frEntry.name : current.data.name,
    };
  }

  // ── Check ─────────────────────────────────────────────────
  function check() {
    if (!current || revealed) return;

    const guess = el['guess-input'].value.trim();
    if (!guess) return;

    const names = getNames();
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
    void node.offsetWidth;
    node.classList.add('shake');
    node.addEventListener('animationend', () => node.classList.remove('shake'), { once: true });
  }

  // ── Reveal ────────────────────────────────────────────────
  function reveal() {
    if (!current || revealed) return;
    revealPokemon(false);
    el['status-text'].textContent = T[lang].statusReveal;
    showToast(T[lang].toastReveal, 2000);
  }

  function revealPokemon(correct) {
    revealed = true;
    resetImgStyle();
    const screen = el['screen'];
    screen.classList.add('screen--revealed');
    if (correct) screen.classList.add('screen--flash');

    const names       = getNames();
    const displayName = lang === 'fr' ? names.fr : names.en;
    el['pokemon-name'].textContent = displayName.toUpperCase();
    if (correct) el['pokemon-name'].classList.add('correct');

    el['type-bar'].innerHTML = current.data.types
      .map((t, i) =>
        `<span class="type-badge type-${t.type.name}" style="animation-delay:${i * 0.15}s">
           ${t.type.name.toUpperCase()}
         </span>`
      ).join('');
  }

  // ── Hint ──────────────────────────────────────────────────
  function hint() {
    if (!current || revealed) { showToast(T[lang].toastNoMore); return; }

    const names = getNames();
    const name  = lang === 'fr' ? names.fr : names.en;
    const steps = [1, 3, 5];
    const len   = steps[Math.min(hintStep, steps.length - 1)];
    hintStep    = Math.min(hintStep + 1, steps.length - 1);

    const hintStr = name.slice(0, len).toUpperCase() + '...';
    const hintMsg = T[lang].hint(hintStr);
    el['status-text'].textContent = hintMsg;
    showToast(T[lang].toastHint(hintMsg), 3000);
  }

  // ── Keyboard ──────────────────────────────────────────────
  document.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });

  // ── Init ──────────────────────────────────────────────────
  function init() {
    cacheDom();
    applyLang();
    newPokemon();
    el['btn-guess'].addEventListener('click', check);
    el['btn-new'].addEventListener('click', newPokemon);
    el['btn-lang'].addEventListener('click', toggleLang);
    el.btnHint.addEventListener('click', hint);
    el.btnReveal.addEventListener('click', reveal);
  }

  document.addEventListener('DOMContentLoaded', init);

  return { newPokemon, toggleLang, check, reveal, hint };

})();
