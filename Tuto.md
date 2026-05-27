# Who's That Pokémon — Guide de développement from scratch

> Ce document explique comment recoder le projet **étape par étape**, dans l'ordre logique.  
> Chaque étape est autonome et produit quelque chose de jouable ou de visible.  
> On ne code jamais quelque chose qu'on ne peut pas tester immédiatement.

---

## Table des matières

1. [Prérequis & mindset](#1-prérequis--mindset)
2. [Étape 0 — Scaffold : les trois fichiers vides](#2-étape-0--scaffold--les-trois-fichiers-vides)
3. [Étape 1 — Structure HTML brute](#3-étape-1--structure-html-brute)
4. [Étape 2 — Appel API & affichage d'une image](#4-étape-2--appel-api--affichage-dune-image)
5. [Étape 3 — La silhouette](#5-étape-3--la-silhouette)
6. [Étape 4 — La saisie et la comparaison](#6-étape-4--la-saisie-et-la-comparaison)
7. [Étape 5 — La révélation](#7-étape-5--la-révélation)
8. [Étape 6 — Score & feedback visuel](#8-étape-6--score--feedback-visuel)
9. [Étape 7 — Indices](#9-étape-7--indices)
10. [Étape 8 — Prefetch & fluidité](#10-étape-8--prefetch--fluidité)
11. [Étape 9 — Persistance localStorage](#11-étape-9--persistance-localstorage)
12. [Étape 10 — Système XP / Niveaux](#12-étape-10--système-xp--niveaux)
13. [Étape 11 — Audio Web API](#13-étape-11--audio-web-api)
14. [Étape 12 — Internationalisation FR/EN](#14-étape-12--internationalisation-fren)
15. [Étape 13 — Design Pokédex CSS](#15-étape-13--design-pokédex-css)
16. [Étape 14 — Animations & polish](#16-étape-14--animations--polish)
17. [Étape 15 — Responsive mobile](#17-étape-15--responsive-mobile)
18. [Étape 16 — Refacto : modules IIFE](#18-étape-16--refacto--modules-iife)
19. [Ordre final & ce qu'on ne fait jamais en premier](#19-ordre-final--ce-quon-ne-fait-jamais-en-premier)

---

## 1. Prérequis & mindset

**Ce qu'il faut savoir avant de commencer :**
- HTML/CSS de base (balises, flexbox)
- JavaScript : fonctions, `async/await`, `fetch`, DOM manipulation
- Notions de `localStorage`

**Ce qu'on n'utilise pas :**
- Aucun framework (pas de React, Vue, etc.)
- Aucune librairie
- Aucun bundler (pas de Webpack, Vite, etc.)
- Aucun backend

**Règle d'or du projet :**  
> *On ne code jamais une feature qu'on ne peut pas tester dans le navigateur dans la foulée.*

Ouvrir `index.html` directement dans le navigateur (ou avec une extension Live Server sur VS Code) et recharger manuellement. C'est suffisant pour tout ce projet.

**Outillage minimal :**
- Un éditeur (VS Code recommandé)
- Un navigateur avec DevTools (F12)
- Extension Live Server (optionnel mais confortable)

---

## 2. Étape 0 — Scaffold : les trois fichiers vides

Créer les trois fichiers dans un même dossier :

```
who's-that-pokemon/
├── index.html
├── style.css
└── game.js
```

**`index.html` minimal pour commencer :**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WHO'S THAT POKÉMON</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <script src="game.js"></script>
</body>
</html>
```

**`game.js` minimal pour vérifier que ça charge :**

```js
console.log('game.js chargé');
```

Ouvrir dans le navigateur → F12 → Console → vérifier que le log apparaît. C'est tout pour cette étape.

---

## 3. Étape 1 — Structure HTML brute

Avant tout CSS, on pose le HTML fonctionnel. Pas de design, juste les éléments dont on a besoin.

**Objectif de cette étape :** avoir tous les éléments interactifs dans le DOM, moches mais fonctionnels.

```html
<body>
  <div id="screen">
    <img id="pokemon-img" src="" alt="Silhouette" />
  </div>

  <div id="mini-screen">
    <div id="status-text">PRÊT</div>
    <div id="pokemon-name"></div>
  </div>

  <div id="controls">
    <label for="guess-input">ENTREZ LE NOM</label>
    <input type="text" id="guess-input" autocomplete="off" />
    <button id="btn-guess">DEVINER</button>
    <button id="btn-new">NOUVEAU POKÉMON</button>
    <button id="btn-hint">INDICE</button>
    <button id="btn-reveal">RÉVÉLER</button>
  </div>

  <div id="score-display">✓ 0  ✗ 0</div>

  <script src="game.js"></script>
</body>
```

**Ce qu'on vérifie :** tous les éléments sont visibles dans la page. Rien d'autre.

> **À ne pas faire ici :** ne pas commencer le CSS. Le HTML doit être stable avant d'habiller quoi que ce soit.

---

## 4. Étape 2 — Appel API & affichage d'une image

**Objectif :** charger un Pokémon aléatoire depuis PokéAPI et afficher son image.

### Comprendre PokéAPI

Deux endpoints sont nécessaires :

```
GET https://pokeapi.co/api/v2/pokemon/{id}
  → sprites, stats, nom canonique anglais, URL de l'espèce

GET https://pokeapi.co/api/v2/pokemon-species/{id}
  → noms localisés dans toutes les langues (dont le français)
```

Le champ qui nous intéresse pour les noms localisés :
```json
species.names = [
  { "language": { "name": "fr" }, "name": "Bulbizarre" },
  { "language": { "name": "en" }, "name": "Bulbasaur" },
  ...
]
```

L'image de meilleure qualité :
```js
data.sprites.other['official-artwork'].front_default
// Fallback si null :
data.sprites.front_default
```

### Premier code fonctionnel

```js
const MAX_POKEMON_ID = 1025;

function randomId() {
  return Math.floor(Math.random() * MAX_POKEMON_ID) + 1;
}

async function loadPokemon(id) {
  const res     = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  const data    = await res.json();
  const specRes = await fetch(data.species.url);
  const species = await specRes.json();

  const imgUrl =
    data.sprites.other?.['official-artwork']?.front_default ||
    data.sprites.front_default;

  return { data, species, imgUrl };
}

async function newPokemon() {
  document.getElementById('status-text').textContent = 'CHARGEMENT...';
  const payload = await loadPokemon(randomId());
  document.getElementById('pokemon-img').src = payload.imgUrl;
  document.getElementById('status-text').textContent = 'PRÊT';
  console.log(payload); // pour vérifier ce qu'on reçoit
}

document.getElementById('btn-new').addEventListener('click', newPokemon);
document.addEventListener('DOMContentLoaded', newPokemon);
```

**Ce qu'on vérifie dans le navigateur :**
- L'image s'affiche au chargement
- Clic sur "Nouveau Pokémon" → nouvelle image
- F12 → Network → on voit les deux appels API
- F12 → Console → on voit la structure de `payload`

**Problème courant :** si l'image ne s'affiche pas, vérifier l'onglet Network pour voir si l'appel API retourne 404 (ID inexistant) ou si c'est un problème CORS (ne devrait pas arriver avec PokéAPI).

> **Note sur les ID :** PokéAPI va jusqu'à ~1025 mais certains ID intermédiaires n'existent pas (formes alternatives). Si on tombe sur un 404, le `catch` qu'on ajoutera plus tard relancera un appel.

---

## 5. Étape 3 — La silhouette

**Objectif :** rendre le Pokémon méconnaissable en CSS, sans modifier le JS.

La silhouette se fait avec **une seule ligne de CSS** sur l'image :

```css
#pokemon-img {
  filter: brightness(0);
}
```

`brightness(0)` rend tous les pixels noirs. Le canal alpha (transparence) est préservé, donc la forme reste visible.

On ajoute aussi un fond clair pour que le noir soit visible :

```css
#screen {
  background: #a8d878; /* vert Game Boy */
  padding: 20px;
}
```

**Ce qu'on vérifie :** l'image s'affiche en noir sur fond vert. On ne reconnaît pas le Pokémon.

**À retenir :** la révélation sera simplement `filter: none` plus tard. Tout le mécanisme de silhouette/révélation tient en deux états CSS.

---

## 6. Étape 4 — La saisie et la comparaison

**Objectif :** pouvoir taper un nom et savoir si c'est correct.

### Le problème des noms Pokémon

Les noms posent deux défis :
1. **Accents** : "Flâmigon", "Évoli", "Nidoran♀" — l'utilisateur ne tapera pas les accents
2. **Casse** : on veut que "pikachu", "Pikachu", "PIKACHU" soient tous acceptés

La solution est une fonction `normalize` qui strip tout ce qui gêne la comparaison :

```js
function normalize(s) {
  return s
    .toLowerCase()                           // casse
    .normalize('NFD')                        // décompose les caractères accentués
    .replace(/[\u0300-\u036f]/g, '')         // supprime les diacritiques
    .replace(/[^a-z0-9]/g, '');             // supprime tout sauf lettres et chiffres
}

// Tests à vérifier dans la console :
normalize('Évoli')    // → 'evoli'
normalize('Nidoran♀') // → 'nidoran'
normalize('Flâmigon') // → 'flamigon'
normalize('mr. mime') // → 'mrmime'
```

### Récupérer les noms FR et EN

```js
function getNames(species, data) {
  const findName = (lang) =>
    species.names.find(n => n.language.name === lang)?.name
    ?? data.name; // fallback : nom anglais canonique

  return {
    en: findName('en'),
    fr: findName('fr'),
  };
}
```

### La fonction de vérification

```js
let current = null; // le payload du Pokémon actuel

function check() {
  if (!current) return;

  const input = document.getElementById('guess-input');
  const guess = input.value.trim();
  if (!guess) return;

  const names = getNames(current.species, current.data);
  const isCorrect =
    normalize(guess) === normalize(names.en) ||
    normalize(guess) === normalize(names.fr);

  if (isCorrect) {
    document.getElementById('status-text').textContent = 'BONNE RÉPONSE !';
  } else {
    document.getElementById('status-text').textContent = 'MAUVAISE RÉPONSE.';
  }
}

document.getElementById('btn-guess').addEventListener('click', check);
document.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
```

Ne pas oublier de stocker `current` dans `newPokemon` :

```js
async function newPokemon() {
  // ...
  const payload = await loadPokemon(randomId());
  current = payload; // ← ajouter cette ligne
  // ...
}
```

**Ce qu'on vérifie :**
- Taper le bon nom → status "BONNE RÉPONSE !"
- Taper n'importe quoi → "MAUVAISE RÉPONSE."
- Taper avec/sans accents → les deux acceptés
- Appuyer sur Entrée → même effet que le bouton

---

## 7. Étape 5 — La révélation

**Objectif :** afficher le Pokémon en couleur avec son nom quand on révèle.

```js
let revealed = false;

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

Modifier `check()` pour révéler automatiquement sur bonne réponse :

```js
if (isCorrect) {
  revealPokemon();
  document.getElementById('status-text').textContent = 'BONNE RÉPONSE !';
  setTimeout(newPokemon, 1500); // ← auto-next après 1.5s
}
```

Modifier `newPokemon()` pour reset l'état à chaque nouveau Pokémon :

```js
async function newPokemon() {
  revealed = false;
  document.getElementById('pokemon-img').style.filter = 'brightness(0)';
  document.getElementById('pokemon-name').textContent = '';
  document.getElementById('guess-input').value = '';
  // ... reste du code
}
```

**Ce qu'on vérifie :**
- Bonne réponse → image en couleur + nom affiché + nouveau Pokémon automatique après 1.5s
- Bouton Révéler → même effet mais sans auto-next
- Nouveau Pokémon manuel → silhouette noire, nom effacé

---

## 8. Étape 6 — Score & feedback visuel

**Objectif :** compter les bonnes/mauvaises réponses et animer l'input sur erreur.

### Score

```js
let score = { correct: 0, wrong: 0 };

function updateScore() {
  document.getElementById('score-display').innerHTML =
    `✓ ${score.correct} &nbsp;✗ ${score.wrong}`;
}

// Dans check() :
if (isCorrect) {
  score.correct++;
} else {
  score.wrong++;
}
updateScore();
```

### Shake sur mauvaise réponse

En CSS :

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

En JS — le trick pour relancer l'animation même si elle est déjà en cours :

```js
function shake(node) {
  node.classList.remove('shake');
  void node.offsetWidth; // ← force un reflow, remet l'animation à zéro
  node.classList.add('shake');
  node.addEventListener('animationend', () => {
    node.classList.remove('shake');
  }, { once: true });
}

// Dans check() sur mauvaise réponse :
shake(document.getElementById('guess-input'));
```

`void node.offsetWidth` est le hack standard pour forcer le navigateur à relire le layout et permettre de relancer une animation CSS déjà active.

---

## 9. Étape 7 — Indices

**Objectif :** révéler progressivement les premières lettres du nom.

La logique est simple : on a un tableau de paliers `[1, 3, 5]` qui définit combien de lettres montrer à chaque appui.

```js
let hintStep = 0;
const HINT_STEPS = [1, 3, 5];

function hint() {
  if (!current || revealed) return;

  const names = getNames(current.species, current.data);
  const name  = names.fr; // ou EN selon la langue active

  const len     = HINT_STEPS[Math.min(hintStep, HINT_STEPS.length - 1)];
  hintStep      = Math.min(hintStep + 1, HINT_STEPS.length - 1);
  const hintStr = name.slice(0, len).toUpperCase() + '...';

  document.getElementById('status-text').textContent = `COMMENCE PAR : ${hintStr}`;
}

document.getElementById('btn-hint').addEventListener('click', hint);
```

Reset `hintStep = 0` dans `newPokemon()`.

**Ce qu'on vérifie :**
- 1er clic : "COMMENCE PAR : B..." (pour Bulbizarre)
- 2e clic : "COMMENCE PAR : BUL..."
- 3e clic : "COMMENCE PAR : BULBI..."
- 4e clic et suivants : même résultat que le 3e (palier max)

---

## 10. Étape 8 — Prefetch & fluidité

**Objectif :** charger le prochain Pokémon en arrière-plan pendant que le joueur joue.

Sans prefetch, il y a un délai visible entre "Nouveau Pokémon" et l'affichage. Avec, la transition est quasi-instantanée.

```js
let nextPromise = null;

function prefetchNext() {
  nextPromise = loadPokemon(randomId()).catch(() => {
    nextPromise = null; // en cas d'erreur réseau, on laisse newPokemon refaire un appel
  });
}

async function newPokemon() {
  // ...
  const payload = nextPromise
    ? await nextPromise      // déjà en cours de chargement → on attend juste la résolution
    : await loadPokemon(randomId()); // pas de prefetch → appel normal

  nextPromise = null;
  current = payload;
  // ...
  prefetchNext(); // ← lance le chargement du suivant immédiatement
}
```

**Pourquoi ça marche :** `prefetchNext()` lance `loadPokemon()` sans `await`. Le fetch démarre en arrière-plan. Quand le joueur clique "Nouveau", `await nextPromise` attend une Promise déjà bien avancée (ou déjà résolue), ce qui est beaucoup plus rapide qu'un nouveau fetch from scratch.

**Ce qu'on vérifie :** ouvrir l'onglet Network dans DevTools → on voit un appel API qui se lance après chaque chargement, sans que l'utilisateur ait rien fait.

---

## 11. Étape 9 — Persistance localStorage

**Objectif :** ne pas perdre la progression en rechargant la page.

### Ce qu'on persiste

```js
const SAVE_KEY = 'wtp_save';

function persist() {
  const state = {
    level         : level,
    xp            : xp,
    correct       : score.correct,
    wrong         : score.wrong,
    lastPokemonId : current?.data?.id ?? null,
    wasRevealed   : revealed,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Erreur sauvegarde:', e);
  }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null; // JSON corrompu → on repart de zéro
  }
}
```

### Restauration au démarrage

```js
async function init() {
  const save = loadSave();

  if (save) {
    level         = save.level   || 1;
    xp            = save.xp      || 0;
    score.correct = save.correct || 0;
    score.wrong   = save.wrong   || 0;

    if (save.lastPokemonId) {
      try {
        const payload = await loadPokemon(save.lastPokemonId);
        current = payload;
        document.getElementById('pokemon-img').src = payload.imgUrl;

        if (save.wasRevealed) {
          revealPokemon(); // Pokémon déjà révélé → on ré-affiche en couleur
        } else {
          document.getElementById('pokemon-img').style.filter = 'brightness(0)';
        }

        prefetchNext();
        return; // on a restauré, pas besoin de charger un nouveau
      } catch {
        // Echec de restauration → partie normale
      }
    }
  }

  newPokemon(); // démarrage normal
}

document.addEventListener('DOMContentLoaded', init);
```

Appeler `persist()` à chaque moment clé : après chaque `check()`, après chaque `newPokemon()`, après `reveal()`.

**Ce qu'on vérifie :** jouer quelques rounds, recharger la page → le même Pokémon est là, le score est intact.

---

## 12. Étape 10 — Système XP / Niveaux

**Objectif :** récompenser les bonnes réponses avec de l'XP et gérer les passages de niveau.

```js
let level = 1;
let xp    = 0;
const LEVEL_THRESHOLD = 50; // XP pour passer un niveau

function updateLevelDisplay() {
  document.getElementById('level-display').textContent =
    `LVL ${level}  ·  ${xp}/${LEVEL_THRESHOLD} XP`;

  // Barre XP : on met la width en %
  const fill = document.getElementById('xp-bar-fill');
  if (fill) fill.style.width = `${(xp / LEVEL_THRESHOLD) * 100}%`;
}

function addXP() {
  xp++;
  if (xp >= LEVEL_THRESHOLD) {
    xp = 0;
    level++;
    triggerLevelUp();
  }
  updateLevelDisplay();
  persist();
}

function triggerLevelUp() {
  // Pour l'instant : juste un alert, on raffinera plus tard
  alert(`NIVEAU ${level} ATTEINT !`);
}
```

Appeler `addXP()` dans `check()` uniquement sur bonne réponse.

### Popup level-up (remplace l'alert)

Créer le DOM dynamiquement au premier level-up :

```js
let popupEl = null;

function initPopup() {
  popupEl = document.createElement('div');
  popupEl.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    display: flex; align-items: center; justify-content: center;
    z-index: 9999;
  `;
  popupEl.innerHTML = `
    <div style="background: #a8d878; padding: 40px; text-align: center; border-radius: 12px;">
      <div id="popup-level">NIVEAU X</div>
      <button id="popup-close">OK</button>
    </div>
  `;
  document.body.appendChild(popupEl);
  document.getElementById('popup-close').addEventListener('click', () => {
    popupEl.style.display = 'none';
  });
}

function triggerLevelUp() {
  if (!popupEl) initPopup();
  document.getElementById('popup-level').textContent = `NIVEAU ${level} ATTEINT !`;
  popupEl.style.display = 'flex';
  setTimeout(() => { popupEl.style.display = 'none'; }, 6000);
}
```

La barre XP CSS :

```css
.xp-bar {
  width: 100%;
  height: 4px;
  background: rgba(0,0,0,0.2);
  border-radius: 2px;
}
.xp-bar__fill {
  height: 100%;
  width: 0%;
  background: #306230;
  border-radius: 2px;
  transition: width 0.5s ease;
}
```

Le `transition: width 0.5s` fait que la barre s'anime smooth à chaque XP gagné.

---

## 13. Étape 11 — Audio Web API

**Objectif :** ajouter des sons synthétiques sans aucun fichier audio.

### Pourquoi Web Audio API plutôt que `<audio>` ?

- Pas de fichiers à héberger
- Sons générés en temps réel, donc instantanés
- Contrôle total sur le timbre, la durée, le volume
- Fonctionne partout

### Principe de base

```js
// Le contexte audio — créé une seule fois (lazy)
let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

// Pattern de base pour un son :
function playBeep(frequency, duration, volume = 0.5) {
  const ctx  = getCtx();
  const now  = ctx.currentTime;

  const osc  = ctx.createOscillator(); // génère une onde
  const gain = ctx.createGain();       // contrôle le volume

  // Connexion : osc → gain → sortie audio
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type            = 'sine';       // forme d'onde : sine, triangle, square, sawtooth
  osc.frequency.value = frequency;   // en Hz

  // Enveloppe de volume : attaque à 'volume', décroissance exponentielle jusqu'à presque 0
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.start(now);
  osc.stop(now + duration);
}

// Test :
document.addEventListener('click', () => playBeep(440, 0.2));
```

> **Important :** `AudioContext` ne peut pas être créé avant une interaction utilisateur sur la plupart des navigateurs. C'est pour ça qu'on le crée lazily au premier appel (lui-même déclenché par un clic).

### Sons du jeu

En pratique, chaque son est une combinaison d'oscillateurs avec des paramètres différents :

```js
const SOUNDS = {
  correct() {
    // Arpège Do-Mi-Sol
    [523, 659, 784].forEach((freq, i) => {
      const ctx  = getCtx();
      const now  = ctx.currentTime;
      const t    = now + i * 0.12; // chaque note décalée de 120ms
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.6, t + 0.02); // attaque rapide
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2); // décroissance
      osc.connect(gain);
      gain.connect(getCtx().destination);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  },

  wrong() {
    // Descente grave
    const ctx  = getCtx();
    const now  = ctx.currentTime;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.25); // descend
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  },
};

function playSound(type) {
  try {
    SOUNDS[type]?.();
  } catch (e) {
    console.warn('Audio error:', e);
  }
}
```

### Bouton mute

```js
let muted = false;

function toggleMute() {
  muted = !muted;
  document.getElementById('btn-mute').textContent = muted ? '🔇' : '🔊';
  persist(); // sauvegarder l'état mute
}

// Modifier playSound :
function playSound(type) {
  if (muted) return;
  try { SOUNDS[type]?.(); } catch(e) {}
}
```

---

## 14. Étape 12 — Internationalisation FR/EN

**Objectif :** toutes les chaînes de l'interface basculent entre français et anglais.

### Structure du dictionnaire

```js
const T = {
  fr: {
    statusReady  : 'PRÊT',
    statusLoad   : 'CHARGEMENT...',
    statusCorrect: 'BONNE RÉP. !',
    btnGuess     : 'DEVINER',
    btnNew       : '— NOUVEAU POKÉMON —',
    btnHint      : 'INDICE',
    btnReveal    : 'RÉVÉLER',
    hint         : (l) => `COMMENCE PAR : ${l}`, // ← fonction, pas string
  },
  en: {
    statusReady  : 'READY',
    statusLoad   : 'LOADING...',
    statusCorrect: 'CORRECT !',
    btnGuess     : 'GUESS',
    btnNew       : '— NEW POKÉMON —',
    btnHint      : 'HINT',
    btnReveal    : 'REVEAL',
    hint         : (l) => `STARTS WITH: ${l}`,
  },
};

let lang = 'fr';
```

### Appliquer la langue à toute l'interface

```js
function applyLang() {
  const t = T[lang];
  document.getElementById('btn-guess').textContent  = t.btnGuess;
  document.getElementById('btn-new').textContent    = t.btnNew;
  document.getElementById('btn-hint').textContent   = t.btnHint;
  document.getElementById('btn-reveal').textContent = t.btnReveal;
  // ... tous les éléments textuels
}

function toggleLang() {
  lang = lang === 'fr' ? 'en' : 'fr';
  applyLang();

  // Si un Pokémon est révélé → mettre à jour le nom affiché
  if (revealed && current) {
    const names = getNames(current.species, current.data);
    document.getElementById('pokemon-name').textContent =
      (lang === 'fr' ? names.fr : names.en).toUpperCase();
  }
}
```

L'usage de `T[lang].hint(hintStr)` dans `hint()` au lieu d'une string en dur garantit que le texte d'indice s'adapte aussi à la langue.

---

## 15. Étape 13 — Design Pokédex CSS

C'est la plus longue étape en termes de CSS. On l'attaque seulement une fois que toute la logique JS est stable.

### Approche : du global au particulier

**1. Variables CSS d'abord**

```css
:root {
  --red-bright  : #ef5350;
  --red-dark    : #7f0000;
  --screen-dark : #a8d878;
  --screen-mid  : #306230;
  --screen-green: #9bbc0f;
  --font-pixel  : 'Press Start 2P', monospace;
  --font-ui     : 'Rajdhani', sans-serif;
  --radius-lg   : 24px;
  --radius-md   : 12px;
}
```

**2. Layout global : deux panneaux en flex**

```css
.pokedex {
  display    : flex;
  align-items: stretch;
}

.pokedex__left,
.pokedex__right {
  width: 560px;
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.pokedex__left {
  background   : linear-gradient(160deg, #ef5350, #7f0000);
  border-radius: 36px 0 0 36px;
}

.pokedex__right {
  background   : linear-gradient(160deg, #c62828, #5a0000);
  border-radius: 0 36px 36px 0;
}
```

**3. L'écran principal**

```css
.screen {
  background   : var(--screen-dark);
  border-radius: var(--radius-lg);
  border       : 6px solid #111;
  min-height   : 420px;
  display      : flex;
  align-items  : center;
  justify-content: center;
  position     : relative;
  overflow     : hidden;
}
```

**4. Pattern bouton 3D**

Chaque bouton est un élément avec deux couches :
- La couche du bas (`.btn`) → couleur d'ombre, `box-shadow` vers le bas
- La couche du dessus (`.btn__top`) → couleur principale avec dégradé

```css
.btn {
  position  : relative;
  border    : none;
  cursor    : pointer;
  padding   : 0;
  border-radius: 6px;
}

/* Le "fond" = couleur d'ombre */
.btn--guess {
  background: #0a1a00;
  box-shadow: 0 4px 0 #050e00;
}

/* Le dessus = couleur principale */
.btn--guess .btn__top {
  display   : block;
  padding   : 11px 14px;
  background: linear-gradient(180deg, #69f0ae, #43a047);
  color     : #0a1a00;
  border-radius: inherit;
  font-family: var(--font-pixel);
}

/* Sur clic : le parent descend de 2px → illusion d'enfoncement */
.btn:active {
  transform: translateY(2px);
}
```

**5. Mini-écran Game Boy**

```css
.mini-screen {
  background   : var(--screen-dark);
  border       : 4px solid #111;
  border-radius: var(--radius-md);
  padding      : 10px 14px;
  box-shadow   : inset 0 0 15px rgba(0,0,0,0.6);
}

/* Scanlines : overlay avec repeating-linear-gradient */
.mini-screen::before {
  content : '';
  position: absolute;
  inset   : 0;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0, transparent 3px,
    rgba(155, 188, 15, 0.06) 3px, rgba(155, 188, 15, 0.06) 4px
  );
  pointer-events: none;
}
```

### Overlays décoratifs sur tout l'écran

```css
/* Scanlines globales */
.scanline {
  position  : fixed;
  inset     : 0;
  z-index   : 999;
  pointer-events: none;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0px, transparent 3px,
    rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px
  );
}
```

Ces overlays sont dans le HTML avec `aria-hidden="true"` et `pointer-events: none` — ils n'affectent pas l'interactivité.

---

## 16. Étape 14 — Animations & polish

On ajoute les animations uniquement une fois le design en place, car elles s'appuient sur les classes CSS définies à l'étape précédente.

### Entrée de la page

```css
.pokedex {
  animation: floatIn 0.8s cubic-bezier(.22, 1, .36, 1) both;
}
@keyframes floatIn {
  from { opacity: 0; transform: translateY(40px) scale(0.95); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
```

### Révélation du Pokémon

```css
.screen--revealed #pokemon-img {
  filter   : none; /* retire la silhouette noire */
  animation: popIn 0.55s cubic-bezier(.34, 1.56, .64, 1) both;
}
@keyframes popIn {
  0%   { transform: scale(0.6) rotate(-4deg); opacity: 0; }
  60%  { transform: scale(1.06) rotate(1deg); }
  100% { transform: scale(1) rotate(0); opacity: 1; }
}
```

On ajoute la classe `screen--revealed` dans `revealPokemon()` :
```js
document.getElementById('screen').classList.add('screen--revealed');
```

Et on la retire dans `newPokemon()` :
```js
document.getElementById('screen').classList.remove('screen--revealed', 'screen--flash');
```

### Flash vert sur bonne réponse

```css
.screen--flash {
  animation: screenFlash 0.6s ease;
}
@keyframes screenFlash {
  0%, 100% { background: var(--screen-dark); }
  30%       { background: #b0e020; }
}
```

### Animation de sortie entre deux Pokémon

```js
async function exitScreen() {
  const img = document.getElementById('pokemon-img');
  img.style.opacity   = '0';
  img.style.transform = 'scale(0.85)';
  img.style.transition= 'opacity 0.25s, transform 0.25s';
  document.getElementById('screen').classList.add('screen--exit');
  await new Promise(r => setTimeout(r, 300));
}
```

```css
.screen--exit #pokemon-img {
  opacity   : 0;
  transform : scale(0.85);
  transition: opacity 0.25s ease, transform 0.25s ease;
}
```

Appeler `exitScreen()` au début de `newPokemon()` avant de changer l'image.

---

## 17. Étape 15 — Responsive mobile

Le breakpoint est à `820px`. C'est suffisant pour couvrir tous les téléphones et tablettes en portrait.

### Changements principaux

```css
@media (max-width: 820px) {

  /* Le Pokédex passe en colonne */
  .pokedex {
    flex-direction: column;
    width         : 100%;
  }

  /* Les deux panneaux prennent toute la largeur */
  .pokedex__left,
  .pokedex__right {
    width        : 100%;
    border-radius: 0;
  }

  /* La charnière et les éléments décoratifs disparaissent */
  .hinge, .speaker, .dpad-area, .screen-label {
    display: none;
  }

  /* L'écran est plus petit */
  .screen { min-height: 200px; }
  #pokemon-img { max-height: 180px; }
}
```

### Gestion du clavier mobile en JS

Le clavier virtuel mobile pose deux problèmes :
1. Il s'ouvre automatiquement si on `focus()` l'input → gênant sur mobile
2. Il reste ouvert après une mauvaise réponse

```js
// Pas d'autofocus sur mobile :
if (!('ontouchstart' in window)) {
  document.getElementById('guess-input').focus();
}

// Fermer le clavier après check() :
document.getElementById('guess-input').blur();
```

---

## 18. Étape 16 — Refacto : modules IIFE

Une fois que tout fonctionne et que le code commence à grossir, on le reorganise en modules. C'est la dernière étape, pas la première.

### Pourquoi IIFE ?

Un IIFE (Immediately Invoked Function Expression) crée un scope privé. Tout ce qui est déclaré dedans est invisible depuis l'extérieur, sauf ce qu'on `return` explicitement.

```js
// Avant la refacto : tout dans le scope global
let muted = false;
function playSound() { ... }
function toggleMute() { ... }

// Après la refacto : encapsulé
const Audio = (() => {
  let muted = false; // ← privé, invisible depuis l'extérieur

  function play(type) { ... }
  function setMuted(val) { muted = val; }
  function isMuted() { return muted; }

  return { play, setMuted, isMuted }; // ← API publique
})();

// Usage depuis l'extérieur :
Audio.play('correct');
Audio.setMuted(true);
```

### Ordre de refacto recommandé

Extraire les modules dans cet ordre (du moins dépendant au plus dépendant) :

1. `Storage` — aucune dépendance
2. `Api` — aucune dépendance
3. `Audio` — aucune dépendance
4. `Dom` — aucune dépendance
5. `Toast` — aucune dépendance
6. `LevelUpPopup` — dépend de `Dom`
7. `Game` — dépend de tout le reste

Chaque module est refactoré et testé indépendamment avant de passer au suivant.

### Déplacer `CONFIG` et `T` en dehors de tout module

`CONFIG` et `T` sont des constantes globales que tous les modules utilisent. Ils restent en haut du fichier, en dehors de tout IIFE :

```js
const CONFIG = { ... }; // en haut du fichier
const T      = { ... }; // en haut du fichier

const Storage     = (() => { ... })();
const Api         = (() => { ... })();
const Audio       = (() => { ... })();
const Dom         = (() => { ... })();
const Toast       = (() => { ... })();
const LevelUpPopup= (() => { ... })();
const Game        = (() => {
  // utilise Storage, Api, Audio, Dom, Toast, LevelUpPopup, CONFIG, T
  document.addEventListener('DOMContentLoaded', init);
  return { newPokemon, check, reveal, hint, toggleLang };
})();
```

---

## 19. Ordre final & ce qu'on ne fait jamais en premier

### Ordre recommandé de développement

```
Étape 0  → Scaffold (3 fichiers vides)
Étape 1  → HTML brute fonctionnel
Étape 2  → Appel API + affichage image        ← premier truc visible
Étape 3  → Silhouette CSS                     ← 1 ligne de CSS
Étape 4  → Saisie + comparaison               ← le jeu est jouable
Étape 5  → Révélation                         ← boucle de jeu complète
Étape 6  → Score + shake                      ← feedback visuel
Étape 7  → Indices                            ← feature supplémentaire
Étape 8  → Prefetch                           ← perf
Étape 9  → localStorage                       ← persistance
Étape 10 → XP / niveaux                       ← mécanisme de progression
Étape 11 → Audio                              ← polish sensoriel
Étape 12 → i18n FR/EN                         ← feature language
Étape 13 → CSS design Pokédex                 ← habillage complet
Étape 14 → Animations                         ← polish visuel
Étape 15 → Responsive mobile                  ← support multi-device
Étape 16 → Refacto IIFE                       ← propreté du code
```

### Ce qu'on ne fait jamais en premier

| Mauvaise idée | Pourquoi |
|---|---|
| Commencer par le CSS | Le HTML va changer → le CSS sera à refaire |
| Commencer par les animations | On ne sait pas encore quels états existent |
| Faire la refacto avant que ça marche | Refactorer du code qui ne marche pas = deux problèmes simultanés |
| Coder le responsive en premier | Le layout desktop doit être stable avant de l'adapter |
| Ajouter l'audio tôt | Distraction pendant le développement de la logique |
| Tout mettre dans un seul `init()` géant sans tests intermédiaires | Impossible à débugger |

### Règle de test à chaque étape

Après chaque étape :
1. Recharger la page
2. Vérifier que le comportement attendu fonctionne
3. Vérifier que ce qui marchait avant marche toujours
4. Consulter la Console (F12) → zéro erreurs rouges avant de passer à la suite
