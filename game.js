/* ============================================================
   WHO'S THAT POKÉMON — game.js
   ============================================================ */
const Game = (() => {
  // ── State ─────────────────────────────────────────────────
  let lastPokemonId = null;
  let wasRevealed = false;
   
  let current  = null;
  let next     = null;
  let lang     = 'fr';
  let score    = { correct: 0, wrong: 0 };
  let hintStep = 0;
  let revealed = false;
  let loading  = false;
  let muted    = false;
  const MASTER_VOLUME = 0.50;
  let level = 1;
  let xp    = 0;   
   
  // ── Level system ──────────────────────────────────────────
  const LEVEL_THRESHOLD = 50;
  const SAVE_KEY = 'wtp_save';
  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      level        = s.level  || 1;
      xp           = s.xp     || 0;
      score.correct = s.correct || 0;
      score.wrong   = s.wrong   || 0;
      muted        = s.muted   || false;
      lastPokemonId = s.lastPokemonId || null;
      wasRevealed = s.wasRevealed || false;
    } catch (e) {}
  }
   

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        level,
        xp,
        correct: score.correct,
        wrong: score.wrong,
        muted,
        lastPokemonId: current?.data?.id ?? lastPokemonId,
        wasRevealed: revealed
      }));
    } catch (e) {
      console.error("Erreur sauvegarde :", e);
    }
  }
  // ── Audio ─────────────────────────────────────────────────
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let actx = null;
  function getAudioCtx() {
    if (!actx) actx = new AudioCtx();
    return actx;
  }
  const LEVELUP_SOUNDS = {
    picross: 'https://raw.githubusercontent.com/kevinraphael95/random-useful-stuff/main/pokemonlevelup/pok-mon-picross.mp3',
    bank:    'https://raw.githubusercontent.com/kevinraphael95/random-useful-stuff/main/pokemonlevelup/pok-mon-bank.mp3',
  };
  const audioBuffers = {};
  async function preloadLevelUpSounds() {
    const ctx = getAudioCtx();
    for (const [key, url] of Object.entries(LEVELUP_SOUNDS)) {
      try {
        const res = await fetch(url);
        const arrayBuffer = await res.arrayBuffer();
        audioBuffers[key] = await ctx.decodeAudioData(arrayBuffer);
      } catch (e) {
        console.warn(`Impossible de charger ${key}:`, e);
      }
    }
  }
  function playBuffer(key) {
    if (muted) return;
    const ctx = getAudioCtx();
    const buf = audioBuffers[key];
    if (!buf) return;
    const source = ctx.createBufferSource();
    source.buffer = buf;
    source.connect(ctx.destination);
    source.start(0);
  }
  function playSound(type) {
    if (muted) return;
    try {
      const ctx = getAudioCtx();
      const now = ctx.currentTime;
      const configs = {
        
        ui: () => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
      
          osc.connect(gain);
          gain.connect(ctx.destination);
      
          osc.type = 'triangle';
      
          osc.frequency.setValueAtTime(700, now);
          osc.frequency.linearRampToValueAtTime(950, now + 0.05);
      
          gain.gain.setValueAtTime(MASTER_VOLUME, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      
          osc.start(now);
          osc.stop(now + 0.07);
        },
         
        click: () => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = 'square';
          osc.frequency.setValueAtTime(880, now);
          osc.frequency.exponentialRampToValueAtTime(440, now + 0.05);
          gain.gain.setValueAtTime(MASTER_VOLUME, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
          osc.start(now); osc.stop(now + 0.08);
        },
        correct: () => {
          [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.32]].forEach(([freq, delay]) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = 'square';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, now + delay);
            gain.gain.linearRampToValueAtTime(MASTER_VOLUME, now + delay + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.15);
            osc.start(now + delay); osc.stop(now + delay + 0.15);
          });
        },
        wrong: () => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(220, now);
          osc.frequency.exponentialRampToValueAtTime(110, now + 0.2);
          gain.gain.setValueAtTime(MASTER_VOLUME, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
          osc.start(now); osc.stop(now + 0.22);
        },
        reveal: () => {
          [[392, 0], [494, 0.1], [587, 0.2]].forEach(([freq, delay]) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = 'triangle';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(MASTER_VOLUME, now + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.18);
            osc.start(now + delay); osc.stop(now + delay + 0.18);
          });
        },
        hint: () => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(660, now);
          osc.frequency.linearRampToValueAtTime(880, now + 0.12);
          gain.gain.setValueAtTime(MASTER_VOLUME, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
          osc.start(now); osc.stop(now + 0.18);
        },
        newmon: () => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, now);
          osc.frequency.exponentialRampToValueAtTime(200, now + 0.25);
          gain.gain.setValueAtTime(MASTER_VOLUME, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
          osc.start(now); osc.stop(now + 0.28);
        },
        levelup: () => {
          const sequence = [
            [523, 0, 0.12], [659, 0.13, 0.12], [784, 0.26, 0.12],
            [1047, 0.39, 0.22], [784, 0.63, 0.1], [1047, 0.75, 0.35],
          ];
          sequence.forEach(([freq, delay, dur]) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = 'square';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(MASTER_VOLUME, now + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
            osc.start(now + delay); osc.stop(now + delay + dur);
          });
        },
      };
      if (configs[type]) configs[type]();
    } catch (e) {
      console.warn('Audio error:', e);
    }
  }
  function playLevelUpMusic() {
    if (muted) return;
    const key = Math.random() < 0.99 ? 'picross' : 'bank';
    playBuffer(key);
  }
  // ── Type translations ──────────────────────────────────────
  const TYPE_FR = {
    normal:   'NORMAL',
    fire:     'FEU',
    water:    'EAU',
    electric: 'ÉLECTRIK',
    grass:    'PLANTE',
    ice:      'GLACE',
    fighting: 'COMBAT',
    poison:   'POISON',
    ground:   'SOL',
    flying:   'VOL',
    psychic:  'PSY',
    bug:      'INSECTE',
    rock:     'ROCHE',
    ghost:    'SPECTRE',
    dragon:   'DRAGON',
    dark:     'TÉNÈBRES',
    steel:    'ACIER',
    fairy:    'FÉE',
  };
  function getTypeName(apiName) {
    if (lang === 'fr') return TYPE_FR[apiName] || apiName.toUpperCase();
    return apiName.toUpperCase();
  }
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
      toastLevelUp : (lvl) => `🏆 NIVEAU ${lvl} !`,
      levelLabel   : (lvl, xp) => `LVL ${lvl}  ·  ${xp}/${LEVEL_THRESHOLD} XP`,
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
      toastLevelUp : (lvl) => `🏆 LEVEL ${lvl} !`,
      levelLabel   : (lvl, xp) => `LVL ${lvl}  ·  ${xp}/${LEVEL_THRESHOLD} XP`,
    },
  };
  // ── DOM cache ─────────────────────────────────────────────
  const el = {};
  function cacheDom() {
    [
      'pokemon-img','screen','screen-overlay','screen-prompt',
      'type-bar','status-text','pokemon-name','score-display',
      'guess-input','input-label','btn-guess','btn-new','btn-lang',
      'screen-label','level-display','btn-mute','xp-bar-fill',
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
    el.btnHint.querySelector('.btn__top').textContent      = t.btnHint;
    el.btnReveal.querySelector('.btn__top').textContent    = t.btnReveal;
    const status = el['status-text'].textContent;
    if (status === T['fr'].statusReady || status === T['en'].statusReady) {
      el['status-text'].textContent = t.statusReady;
    }
    updateScore();
    updateLevelDisplay();
    // Mettre à jour les badges de type si déjà révélé
    if (revealed && current) refreshTypeBadges();
  }
  function toggleLang() {
    playSound('ui');
    lang = lang === 'fr' ? 'en' : 'fr';
    applyLang();
    if (revealed && current) {
      const names = getNames();
      el['pokemon-name'].textContent = (lang === 'fr' ? names.fr : names.en).toUpperCase();
    }
  }
  // ── Score ─────────────────────────────────────────────────
  function updateScore() {
    el['score-display'].innerHTML = `✓ ${score.correct} &nbsp;✗ ${score.wrong}`;
    save();
  }
  // ── Level ─────────────────────────────────────────────────
  function updateLevelDisplay() {
    if (!el['level-display']) return;
    el['level-display'].textContent = T[lang].levelLabel(level, xp);
    if (el['xp-bar-fill']) {
      el['xp-bar-fill'].style.width = `${(xp / LEVEL_THRESHOLD) * 100}%`;
    }
    save();
  }
  function addXP() {
    xp++;
    if (xp >= LEVEL_THRESHOLD) {
      xp = 0;
      level++;
      triggerLevelUp();
    }
    updateLevelDisplay();
  }
  // ── Level up popup ────────────────────────────────────────
  let popupEl = null;
  function showLevelUpPopup(lvl) {
    if (!popupEl) {
      popupEl = document.createElement('div');
      popupEl.className = 'levelup-popup';
      popupEl.innerHTML = `
        <div class="levelup-popup__inner">
          <div class="levelup-popup__title" id="popup-title"></div>
          <div class="levelup-popup__level" id="popup-level"></div>
          <button class="levelup-popup__close" id="popup-close">OK</button>
        </div>`;
      document.body.appendChild(popupEl);
      document.getElementById('popup-close').addEventListener('click', () => {
        popupEl.classList.remove('show');
      });
    }
    const title = lang === 'fr' ? 'NIVEAU SUPÉRIEUR' : 'LEVEL UP';
    const sub   = lang === 'fr' ? `NIVEAU ${lvl} ATTEINT` : `LEVEL ${lvl} REACHED`;
    document.getElementById('popup-title').textContent = title;
    document.getElementById('popup-level').textContent = sub;
    popupEl.classList.add('show');
    setTimeout(() => popupEl && popupEl.classList.remove('show'), 6000);
  }
  function triggerLevelUp() {
    playLevelUpMusic();
    showLevelUpPopup(level);
    if (el['level-display']) {
      el['level-display'].classList.add('level-up-flash');
      setTimeout(() => el['level-display'].classList.remove('level-up-flash'), 1500);
    }
/* level up fond sombre */
/*     
    const screen = el['screen'];
    screen.classList.add('screen--levelup');
    setTimeout(() => screen.classList.remove('screen--levelup'), 1200);
*/
    
  }
  // ── Mute ──────────────────────────────────────────────────
  function toggleMute() {
    muted = !muted;
    if (el['btn-mute']) {
      el['btn-mute'].querySelector('.btn__top').textContent = muted ? '🔇' : '🔊';
      el['btn-mute'].classList.toggle('btn--muted', muted);
    }
    save();
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
    const id = randomId();
    next = loadById(id).catch(() => { next = null; });
  }
  // ── Transition helpers ────────────────────────────────────
  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
  async function exitScreen() {
    const screen = el['screen'];
    const img    = el['pokemon-img'];
    img.style.animation = 'none';
    img.style.filter    = 'brightness(0)';
    screen.classList.add('screen--exit');
    await sleep(300);
  }
  function resetImgStyle() {
    const img = el['pokemon-img'];
    img.style.transition = '';
    img.style.filter     = '';
    img.style.opacity    = '';
    img.style.transform  = '';
  }
  // ── Type badges ───────────────────────────────────────────
  function refreshTypeBadges() {
    if (!current) return;
    el['type-bar'].innerHTML = current.data.types
      .map((t, i) =>
        `<span class="type-badge type-${t.type.name}" style="animation-delay:${i * 0.15}s">
           ${getTypeName(t.type.name)}
         </span>`
      ).join('');
  }
  // ── New Pokémon ───────────────────────────────────────────
  async function newPokemon() {
      if (loading) return;
      loading = true;
      hintStep = 0;
    
      const screen = el['screen'];
      await exitScreen();
    
      screen.classList.remove('screen--revealed', 'screen--flash', 'screen--exit', 'screen--levelup');
      el['type-bar'].innerHTML = '';
      el['pokemon-name'].textContent = '';
      el['pokemon-name'].classList.remove('correct');
      el['status-text'].textContent = T[lang].statusLoad;
      el['guess-input'].value = '';
      el['guess-input'].classList.remove('shake');
    
      try {
        const pendingNext = next;
        next = null;
        const payload = pendingNext ? await pendingNext : await loadById(randomId());
      
        current = payload;
        lastPokemonId = payload.data.id;
        revealed = false;
      
        resetImgStyle();
        el['pokemon-img'].src = payload.imgUrl;
        el['status-text'].textContent = T[lang].statusReady;
        loading = false; // Important : débloquer AVANT de sauvegarder
        save();
        prefetchNext();
      } catch (err) {
        loading = false;
        console.error(err);
        el['status-text'].textContent = 'ERREUR';
        showToast('API ERROR – RETRY', 3000);
      }
    }
  function randomId() {
    return Math.floor(Math.random() * 1025) + 1;
  }
  // ── Normalise ─────────────────────────────────────────────
  function normalize(s) {
    return s
      .toLowerCase()
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
      addXP();
      playSound('correct');
      revealPokemon(true);
      el['status-text'].textContent = T[lang].statusCorrect;
      showToast(T[lang].toastCorrect);
      setTimeout(() => newPokemon(), 1500);
    } else {
      score.wrong++;
      playSound('wrong');
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
    if (!current) return;

    if (revealed) {
      playSound('ui');
      showToast(T[lang].toastNoMore);
      return;
    }

    playSound('reveal');
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
    refreshTypeBadges();
    save();
  }
  // ── Hint ──────────────────────────────────────────────────
  function hint() {
    if (!current) return;

    if (revealed) {
      playSound('ui');
      showToast(T[lang].toastNoMore);
      return;
    }

    playSound('hint');

    const names = getNames();
    const name  = lang === 'fr' ? names.fr : names.en;

    const steps = [1, 3, 5];
    const len   = steps[Math.min(hintStep, steps.length - 1)];

    hintStep = Math.min(hintStep + 1, steps.length - 1);

    const hintStr = name.slice(0, len).toUpperCase() + '...';
    const hintMsg = T[lang].hint(hintStr);

    el['status-text'].textContent = hintMsg;
    showToast(T[lang].toastHint(hintMsg), 3000);
  }
  // ── Keyboard ──────────────────────────────────────────────
  document.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
  // ── Init ──────────────────────────────────────────────────

    async function init() {
        cacheDom();
        loadSave();
        applyLang();
        updateLevelDisplay();
       
        if (muted && el['btn-mute']) {
            el['btn-mute'].querySelector('.btn__top').textContent = '🔇';
            el['btn-mute'].classList.add('btn--muted');
        }
        preloadLevelUpSounds();
   
        // ICI : Vérification stricte
        if (lastPokemonId !== null) {
            try {
                const payload = await loadById(lastPokemonId);
                current = payload;
                el['pokemon-img'].src = payload.imgUrl;
               
                // On restaure l'état de la variable globale 'revealed'
                revealed = wasRevealed;
               
                if (revealed) {
                    revealPokemon(false);
                } else {
                    // On prépare l'affichage sans changer de Pokémon
                    resetImgStyle();
                    el['pokemon-img'].style.filter = 'brightness(0)';
                    el['status-text'].textContent = T[lang].statusReady;
                }
                prefetchNext();
            } catch (e) {
                console.error("Erreur, on tente de générer un nouveau.");
                newPokemon();
            }
        } else {
            // Seulement s'il n'y a PAS de sauvegarde, on en génère un nouveau
            newPokemon();
        }
   
        // Écouteurs d'événements
        el['btn-guess'].addEventListener('click', () => { playSound('ui'); check(); });
        el['btn-new'].addEventListener('click', () => {
          playSound('newmon');
          newPokemon();
        });
        el['btn-lang'].addEventListener('click', toggleLang);
        el.btnHint.addEventListener('click', hint);
        el.btnReveal.addEventListener('click', reveal);
        if (el['btn-mute']) el['btn-mute'].addEventListener('click', toggleMute);
    }
  document.addEventListener('DOMContentLoaded', init);
  return { newPokemon, toggleLang, check, reveal, hint };
})();
