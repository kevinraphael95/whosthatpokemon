# Who's That Pokémon — Tuto pas à pas

> Vanilla JS · Pas de framework · Pas de bundler  
> À chaque étape : quelque chose fonctionne dans le navigateur.

---

## Prérequis

- HTML/CSS de base, JS (fonctions, fetch, DOM)
- Un éditeur + un navigateur (F12 ouvert en permanence)
- Optionnel : extension **Live Server** sur VS Code

---

## Étape 0 — Les trois fichiers

Créer un dossier `whos-that-pokemon/` avec ces trois fichiers vides :

```
index.html
style.css
game.js
```

**`index.html`**
```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>WHO'S THAT POKÉMON</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <script src="game.js"></script>
</body>
</html>
```

**`game.js`**
```js
console.log('chargé');
```

✅ Ouvrir dans le navigateur → F12 → Console → `chargé` s'affiche.

---

## Étape 1 — Le HTML

Ajouter les éléments dans `<body>` **avant** `<script>` :

```html
<div id="screen">
  <img id="pokemon-img" src="" alt="" />
</div>

<div id="mini-screen">
  <div id="status-text">PRÊT</div>
  <div id="pokemon-name"></div>
</div>

<div id="controls">
  <input type="text" id="guess-input" placeholder="Entrez le nom" autocomplete="off" />
  <button id="btn-guess">DEVINER</button>
  <button id="btn-hint">INDICE</button>
  <button id="btn-reveal">RÉVÉLER</button>
  <button id="btn-new">NOUVEAU</button>
</div>

<div id="score-display">✓ 0  ✗ 0</div>
```

✅ Recharger → tous les éléments sont visibles dans la page.

---

## Étape 2 — Appel API + image

PokéAPI nous donne deux endpoints :
- `GET /pokemon/{id}` → image, espèce
- `GET /pokemon-species/{id}` → noms FR/EN

**`game.js`** — remplacer le `console.log` :

```js
const MAX_ID = 1025;

function randomId() {
  return Math.floor(Math.random() * MAX_ID) + 1;
}

async function loadPokemon(id) {
  const res     = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  const data    = await res.json();
  const specRes = await fetch(data.species.url);
  const species = await specRes.json();
  const imgUrl  = data.sprites.other?.['official-artwork']?.front_default
                  || data.sprites.front_default;
  return { data, species, imgUrl };
}

async function newPokemon() {
  document.getElementById('status-text').textContent = 'CHARGEMENT...';
  const payload = await loadPokemon(randomId());
  document.getElementById('pokemon-img').src = payload.imgUrl;
  document.getElementById('status-text').textContent = 'PRÊT';
  console.log(payload);
}

document.getElementById('btn-new').addEventListener('click', newPokemon);
document.addEventListener('DOMContentLoaded', newPokemon);
```

✅ Recharger → une image de Pokémon s'affiche.  
✅ Clic "NOUVEAU" → nouvelle image.  
✅ F12 → Network → on voit deux appels API.

---

## Étape 3 — La silhouette

Une ligne de CSS dans **`style.css`** :

```css
#pokemon-img {
  filter: brightness(0);
}

#screen {
  background: #a8d878;
  padding: 20px;
  display: inline-block;
}
```

`brightness(0)` rend tous les pixels noirs. La forme reste visible.  
La révélation sera simplement `filter: none` — on y revient à l'étape suivante.

✅ Recharger → silhouette noire sur fond vert.

---

## Étape 4 — Deviner

### Normaliser les noms (accents, casse)

Ajouter dans **`game.js`** :

```js
function normalize(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // supprime les accents
    .replace(/[^a-z0-9]/g, '');       // garde seulement lettres/chiffres
}

function getNames(species, data) {
  const find = (lang) =>
    species.names.find(n => n.language.name === lang)?.name ?? data.name;
  return { en: find('en'), fr: find('fr') };
}
```

### Stocker le Pokémon courant

```js
let current  = null;
let revealed = false;
```

Dans `newPokemon()`, ajouter après le chargement :
```js
current  = payload;
revealed = false;
```

### La vérification

```js
function check() {
  if (!current || revealed) return;
  const guess = document.getElementById('guess-input').value.trim();
  if (!guess) return;

  const names     = getNames(current.species, current.data);
  const isCorrect = normalize(guess) === normalize(names.en)
                 || normalize(guess) === normalize(names.fr);

  if (isCorrect) {
    document.getElementById('status-text').textContent = 'BONNE RÉPONSE !';
  } else {
    document.getElementById('status-text').textContent = 'MAUVAISE RÉPONSE.';
  }
}

document.getElementById('btn-guess').addEventListener('click', check);
document.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
```

✅ Taper le bon nom (FR ou EN) → "BONNE RÉPONSE !"  
✅ Taper avec ou sans accents → les deux marchent.

---

## Étape 5 — Révélation

```js
function revealPokemon() {
  revealed = true;
  document.getElementById('pokemon-img').style.filter = 'none';
  const names = getNames(current.species, current.data);
  document.getElementById('pokemon-name').textContent = names.fr.toUpperCase();
}

function reveal() {
  if (!current || revealed) return;
  revealPokemon();
  document.getElementById('status-text').textContent = 'RÉVÉLÉ';
}

document.getElementById('btn-reveal').addEventListener('click', reveal);
```

Modifier `check()` — sur bonne réponse :
```js
if (isCorrect) {
  revealPokemon();
  document.getElementById('status-text').textContent = 'BONNE RÉPONSE !';
  setTimeout(newPokemon, 1500);
}
```

Modifier `newPokemon()` — reset à chaque nouveau tour :
```js
async function newPokemon() {
  revealed = false;
  document.getElementById('pokemon-img').style.filter = 'brightness(0)';
  document.getElementById('pokemon-name').textContent = '';
  document.getElementById('guess-input').value = '';
  // ... reste du code
}
```

✅ Bonne réponse → couleur + nom + Pokémon suivant après 1.5s.  
✅ Bouton "RÉVÉLER" → même effet sans auto-next.

---

## Étape 6 — Score + shake

### Score

```js
let score = { correct: 0, wrong: 0 };

function updateScore() {
  document.getElementById('score-display').innerHTML =
    `✓ ${score.correct} &nbsp; ✗ ${score.wrong}`;
}
```

Dans `check()` :
```js
if (isCorrect) {
  score.correct++;
} else {
  score.wrong++;
}
updateScore();
```

### Animation shake sur erreur

**`style.css`** :
```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%       { transform: translateX(-6px); }
  40%       { transform: translateX(6px); }
  60%       { transform: translateX(-4px); }
  80%       { transform: translateX(4px); }
}
.shake {
  animation: shake 0.4s ease;
  border-color: red;
}
```

**`game.js`** :
```js
function shake(node) {
  node.classList.remove('shake');
  void node.offsetWidth;          // ← force le navigateur à relire le layout
  node.classList.add('shake');
  node.addEventListener('animationend',
    () => node.classList.remove('shake'),
    { once: true }
  );
}
```

Dans `check()` sur mauvaise réponse :
```js
shake(document.getElementById('guess-input'));
```

`void node.offsetWidth` est nécessaire pour relancer l'animation si elle tourne déjà.

✅ Mauvaise réponse → input se secoue et bordure rouge.  
✅ Score se met à jour à chaque tentative.

---

## Étape 7 — Indices

Révèle progressivement les premières lettres du nom.

```js
let hintStep = 0;
const HINT_STEPS = [1, 3, 5];

function hint() {
  if (!current || revealed) return;
  const names  = getNames(current.species, current.data);
  const len    = HINT_STEPS[Math.min(hintStep, HINT_STEPS.length - 1)];
  hintStep     = Math.min(hintStep + 1, HINT_STEPS.length - 1);
  const str    = names.fr.slice(0, len).toUpperCase() + '...';
  document.getElementById('status-text').textContent = `COMMENCE PAR : ${str}`;
}

document.getElementById('btn-hint').addEventListener('click', hint);
```

Dans `newPokemon()` : ajouter `hintStep = 0;`

✅ 1er clic : "B..."  ✅ 2e clic : "BUL..."  ✅ 3e clic : "BULBI..."

---

## Étape 8 — Prefetch (fluidité)

Charger le Pokémon suivant en arrière-plan pendant que le joueur joue.

```js
let nextPromise = null;

function prefetchNext() {
  nextPromise = loadPokemon(randomId()).catch(() => { nextPromise = null; });
}
```

Modifier `newPokemon()` :
```js
async function newPokemon() {
  // ...
  const payload = nextPromise
    ? await nextPromise
    : await loadPokemon(randomId());

  nextPromise = null;
  current = payload;
  // ...
  prefetchNext(); // ← lance le suivant immédiatement
}
```

Le fetch démarre sans `await`. Quand le joueur clique "NOUVEAU", la Promise est déjà résolue (ou presque).

✅ F12 → Network → un appel API part en arrière-plan après chaque chargement.

---

## Étape 9 — Persistance `localStorage`

Ne pas perdre la progression au rechargement.

```js
const SAVE_KEY = 'wtp_save';

function persist() {
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    correct       : score.correct,
    wrong         : score.wrong,
    lastPokemonId : current?.data?.id ?? null,
    wasRevealed   : revealed,
  }));
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
```

Remplacer `document.addEventListener('DOMContentLoaded', newPokemon)` par :

```js
async function init() {
  const save = loadSave();
  if (save) {
    score.correct = save.correct || 0;
    score.wrong   = save.wrong   || 0;
    updateScore();

    if (save.lastPokemonId) {
      try {
        const payload = await loadPokemon(save.lastPokemonId);
        current = payload;
        document.getElementById('pokemon-img').src = payload.imgUrl;
        if (save.wasRevealed) revealPokemon();
        else document.getElementById('pokemon-img').style.filter = 'brightness(0)';
        prefetchNext();
        return;
      } catch { /* echec → partie normale */ }
    }
  }
  newPokemon();
}

document.addEventListener('DOMContentLoaded', init);
```

Appeler `persist()` à la fin de `check()` et de `newPokemon()`.

✅ Jouer quelques rounds → recharger → même Pokémon, même score.

---

## Étape 10 — XP & niveaux

```js
let xp    = 0;
let level = 1;
const XP_PER_LEVEL = 50;

function updateLevelDisplay() {
  document.getElementById('level-display').textContent =
    `LVL ${level}  ·  ${xp}/${XP_PER_LEVEL} XP`;
}

function addXP() {
  xp++;
  if (xp >= XP_PER_LEVEL) { xp = 0; level++; showLevelUp(); }
  updateLevelDisplay();
  persist();
}
```

Ajouter dans le HTML :
```html
<div id="level-display">LVL 1 · 0/50 XP</div>
```

`showLevelUp()` pour commencer :
```js
function showLevelUp() {
  document.getElementById('status-text').textContent = `★ NIVEAU ${level} ! ★`;
}
```

Appeler `addXP()` dans `check()` sur bonne réponse.  
Restaurer `xp` et `level` dans `init()` depuis la sauvegarde.

✅ Bonne réponse → XP monte. A 50 → niveau suivant.

---

## Étape 11 — Audio (Web Audio API)

Pas de fichier audio. Sons synthétiques générés en JS.

```js
let audioCtx = null;

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playBeep(freq, duration, vol = 0.4) {
  const ctx  = getCtx();
  const now  = ctx.currentTime;
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type            = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.start(now);
  osc.stop(now + duration);
}

const SOUNDS = {
  correct() { [523, 659, 784].forEach((f, i) => setTimeout(() => playBeep(f, 0.2), i * 80)); },
  wrong()   { playBeep(200, 0.3, 0.3); },
  reveal()  { playBeep(300, 0.1); setTimeout(() => playBeep(600, 0.3), 120); },
};
```

> `AudioContext` exige une interaction utilisateur avant d'être créé. On le crée lazily au premier appel.

Appeler `SOUNDS.correct()`, `SOUNDS.wrong()`, `SOUNDS.reveal()` dans `check()` et `reveal()`.

✅ Bonne réponse → arpège montant.  ✅ Mauvaise → son grave.

---

## Étape 12 — Internationalisation FR/EN

```js
let lang = 'fr';

const T = {
  fr: { ready: 'PRÊT', correct: 'BONNE RÉPONSE !', wrong: 'MAUVAISE RÉPONSE.',
        revealed: 'RÉVÉLÉ', hint: 'COMMENCE PAR :' },
  en: { ready: 'READY', correct: 'CORRECT!', wrong: 'WRONG.',
        revealed: 'REVEALED', hint: 'STARTS WITH:' },
};

function t(key) { return T[lang][key]; }

function toggleLang() {
  lang = lang === 'fr' ? 'en' : 'fr';
  document.getElementById('status-text').textContent = t('ready');
}
```

Ajouter un bouton dans le HTML :
```html
<button id="btn-lang">FR / EN</button>
```

```js
document.getElementById('btn-lang').addEventListener('click', toggleLang);
```

Remplacer toutes les chaînes hardcodées dans `check()`, `reveal()`, `hint()` par `t('key')`.

✅ Clic FR/EN → tous les textes basculent.

---

## Étape 13 — CSS Pokédex

Maintenant que la logique est stable, on peut habiller.  
Objectif : ressembler à un Pokédex Game Boy.

```css
:root {
  --red     : #cc0000;
  --screen  : #9bbc0f;
  --dark    : #306230;
  --light   : #8bac0f;
  --text    : #0f380f;
}

body {
  background: #1a1a2e;
  display   : flex;
  justify-content: center;
  align-items    : center;
  min-height: 100vh;
  font-family: 'Press Start 2P', monospace; /* Google Fonts */
}

.pokedex {
  background   : var(--red);
  border-radius: 16px 16px 4px 4px;
  padding      : 24px;
  max-width    : 420px;
  width        : 100%;
}

#screen {
  background   : var(--screen);
  border-radius: 8px;
  min-height   : 240px;
  display      : flex;
  align-items  : center;
  justify-content: center;
}

#pokemon-img {
  max-height: 200px;
  filter    : brightness(0);
}

#mini-screen {
  background: var(--dark);
  color     : var(--screen);
  padding   : 8px 12px;
  font-size : 0.6rem;
  margin-top: 8px;
  border-radius: 4px;
}

#controls {
  display       : flex;
  flex-wrap     : wrap;
  gap           : 8px;
  margin-top    : 16px;
}

#guess-input {
  width     : 100%;
  background: var(--dark);
  color     : var(--screen);
  border    : 2px solid var(--light);
  padding   : 8px;
  font-family: inherit;
  font-size : 0.6rem;
}

button {
  background: var(--dark);
  color     : var(--screen);
  border    : none;
  padding   : 8px 12px;
  font-family: inherit;
  font-size : 0.5rem;
  cursor    : pointer;
}

button:hover { background: var(--text); }
```

Ne pas oublier d'ajouter la Google Font dans `<head>` :
```html
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" />
```

✅ Recharger → look Pokédex rétro.

---

## Étape 14 — Animations

Les animations viennent **après** le design, pas avant.

```css
/* Entrée du Pokédex */
.pokedex {
  animation: floatIn 0.8s cubic-bezier(.22, 1, .36, 1) both;
}
@keyframes floatIn {
  from { opacity: 0; transform: translateY(40px) scale(0.95); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* Révélation */
.screen--revealed #pokemon-img {
  filter    : none;
  animation : popIn 0.55s cubic-bezier(.34, 1.56, .64, 1) both;
}
@keyframes popIn {
  0%   { transform: scale(0.6) rotate(-4deg); opacity: 0; }
  60%  { transform: scale(1.06) rotate(1deg); }
  100% { transform: scale(1) rotate(0); opacity: 1; }
}

/* Flash vert sur bonne réponse */
.screen--flash {
  animation: screenFlash 0.6s ease;
}
@keyframes screenFlash {
  0%, 100% { background: var(--screen); }
  30%       { background: #c8f000; }
}
```

Dans `revealPokemon()` :
```js
document.getElementById('screen').classList.add('screen--revealed');
```

Dans `check()` sur bonne réponse :
```js
document.getElementById('screen').classList.add('screen--flash');
```

Dans `newPokemon()` :
```js
document.getElementById('screen').classList.remove('screen--revealed', 'screen--flash');
```

✅ Révélation → le Pokémon pop avec rebond.  
✅ Bonne réponse → flash vert.

---

## Étape 15 — Responsive mobile

```css
@media (max-width: 600px) {
  .pokedex { border-radius: 0; }

  #screen   { min-height: 180px; }

  #pokemon-img { max-height: 150px; }

  #controls { flex-direction: column; }

  button { width: 100%; }
}
```

Dans **`game.js`** — éviter l'ouverture automatique du clavier :
```js
// Dans newPokemon(), remplacer focus() par :
if (!('ontouchstart' in window)) {
  document.getElementById('guess-input').focus();
}

// Dans check(), fermer le clavier après validation :
document.getElementById('guess-input').blur();
```

✅ Sur téléphone → le layout s'adapte et le clavier ne s'ouvre pas tout seul.

---

## Étape 16 — Refacto : modules IIFE

Une fois que tout fonctionne, on organise le code en modules isolés.  
**C'est la dernière étape, jamais la première.**

```js
// Avant — tout en global :
let muted = false;
function playSound() { ... }

// Après — encapsulé :
const Audio = (() => {
  let muted = false;                      // ← privé

  function play(type) { ... }
  function setMuted(val) { muted = val; }

  return { play, setMuted };              // ← API publique
})();

// Appel depuis l'extérieur :
Audio.play('correct');
```

Ordre d'extraction (du moins dépendant au plus dépendant) :

```
Storage   → aucune dépendance
Api       → aucune dépendance
Audio     → aucune dépendance
Dom       → aucune dépendance
Game      → utilise tout le reste
```

Extraire et tester un module à la fois. Zéro erreurs console avant de passer au suivant.

---

## Récap — ordre de développement

```
Étape 0  → 3 fichiers vides
Étape 1  → HTML brut
Étape 2  → API + image          ← première chose visible
Étape 3  → Silhouette CSS       ← 1 ligne
Étape 4  → Deviner              ← le jeu tourne
Étape 5  → Révélation           ← boucle complète
Étape 6  → Score + shake        ← feedback
Étape 7  → Indices
Étape 8  → Prefetch             ← perf
Étape 9  → localStorage         ← persistance
Étape 10 → XP / niveaux
Étape 11 → Audio
Étape 12 → i18n FR/EN
Étape 13 → CSS design           ← habillage
Étape 14 → Animations           ← polish
Étape 15 → Responsive
Étape 16 → Refacto IIFE         ← toujours en dernier
```

**Règle à chaque étape :**  
Recharger → tester → zéro erreurs rouges en console → passer à la suite.
