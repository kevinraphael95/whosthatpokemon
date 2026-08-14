# Who's That Pokémon — Tuto pour grands débutants

> Tu n'as jamais écrit une seule ligne de code. Ce tuto t'explique tout,
> dans l'ordre, sans rien sauter. À chaque étape, tu vois quelque chose
> fonctionner dans ton navigateur.

---

## Avant de commencer — installer les outils

### 1. Installer VS Code

VS Code est l'éditeur où tu vas écrire ton code.

1. Va sur **https://code.visualstudio.com**
2. Clique sur le gros bouton bleu "Download for Windows"
3. Ouvre le fichier téléchargé et installe (tout par défaut, juste "Suivant")

### 2. Installer l'extension Live Server

Live Server recharge automatiquement ta page dans le navigateur quand tu sauvegardes. Sans ça, tu dois appuyer sur F5 à chaque modification.

1. Ouvre VS Code
2. Sur la gauche, clique sur l'icône qui ressemble à 4 carrés (Extensions)
3. Dans la barre de recherche, tape : `Live Server`
4. Clique sur **Install** à côté de "Live Server" par Ritwick Dey

### 3. Créer ton dossier de travail

1. Sur ton Bureau (ou dans Mes Documents), crée un dossier : `whos-that-pokemon`
2. Dans VS Code : menu **File → Open Folder** → sélectionne ce dossier

---

## Étape 0 — Les trois fichiers

Ton projet sera composé de trois fichiers. Chacun a un rôle précis :

| Fichier | Rôle |
|---|---|
| `index.html` | La structure de la page (les cases, les boutons) |
| `style.css` | L'apparence (couleurs, tailles, polices) |
| `game.js` | La logique du jeu (ce qui se passe quand on clique) |

### Créer les fichiers

Dans VS Code, en haut à gauche tu vois le nom de ton dossier.
Clique sur l'icône "Nouveau fichier" (un fichier avec un +) et crée :
- `index.html`
- `style.css`
- `game.js`

### Remplir index.html

Clique sur `index.html` et écris exactement ceci :

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

**Ce que ça veut dire, ligne par ligne :**

- `<!DOCTYPE html>` → dit au navigateur "ce fichier est du HTML"
- `<html lang="fr">` → balise qui contient toute la page
- `<head>` → informations sur la page (pas visible à l'écran)
- `<meta charset="UTF-8">` → active les accents et caractères spéciaux
- `<title>` → le texte qui apparaît dans l'onglet du navigateur
- `<link rel="stylesheet" href="style.css">` → connecte ton fichier CSS à la page
- `<body>` → tout ce qui sera visible à l'écran va ici
- `<script src="game.js">` → connecte ton fichier JS à la page

> **Les balises HTML fonctionnent par paires :** `<body>` s'ouvre, `</body>` se ferme.
> Tout ce qui est entre les deux est "à l'intérieur" de cette balise.

### Vérifier que ça fonctionne

1. Clic droit sur `index.html` dans VS Code → **Open with Live Server**
2. Le navigateur s'ouvre → page blanche = parfait ✅
3. Mets `console.log('ça marche')` dans `game.js`, sauvegarde (Ctrl+S)
4. Dans le navigateur : appuie sur **F12** → onglet **Console**
5. Tu dois voir : `ça marche` ✅

> **F12** ouvre les DevTools — ton meilleur ami pour déboguer. Garde-le ouvert en permanence.

---

## Étape 1 — La structure HTML

Maintenant on ajoute les éléments visibles : l'image, la zone de texte, les boutons.

**Ce qu'on ajoute dans `<body>`, avant `<script>` :**

```html
<body>

  <!-- L'écran qui affiche le Pokémon -->
  <div id="screen">
    <img id="pokemon-img" src="" alt="" />
  </div>

  <!-- Le mini-écran qui affiche les messages -->
  <div id="mini-screen">
    <div id="status-text">PRÊT</div>
    <div id="pokemon-name"></div>
  </div>

  <!-- Les contrôles -->
  <div id="controls">
    <input type="text" id="guess-input" placeholder="Entrez le nom" autocomplete="off" />
    <button id="btn-guess">DEVINER</button>
    <button id="btn-hint">INDICE</button>
    <button id="btn-reveal">RÉVÉLER</button>
    <button id="btn-new">NOUVEAU</button>
  </div>

  <!-- Le score -->
  <div id="score-display">✓ 0  ✗ 0</div>

  <script src="game.js"></script>
</body>
```

**Ce que ça veut dire :**

- `<div>` → une boîte invisible. Elle sert à regrouper des éléments.
- `id="screen"` → un nom unique pour cet élément. JS s'en sert pour le retrouver.
- `<img>` → une image. `src=""` est vide pour l'instant, on la remplira en JS.
- `<!-- texte -->` → un commentaire. Le navigateur l'ignore, c'est pour toi.
- `<input type="text">` → la case où le joueur tape le nom.
- `<button>` → un bouton cliquable.

**Sauvegarde → le navigateur se recharge automatiquement.**

✅ Tu dois voir tous les boutons et la zone de saisie sur la page.

---

## Étape 2 — Appel API et affichage d'une image

On va chercher un Pokémon sur internet et afficher son image.

### C'est quoi une API ?

Une API est une adresse sur internet qui te renvoie des données.
PokéAPI est une API gratuite qui contient les infos de tous les Pokémon.

Tu peux la tester toi-même : ouvre un nouvel onglet et va sur :
`https://pokeapi.co/api/v2/pokemon/1`

Tu vois un gros bloc de texte ? C'est le JSON de Bulbizarre.
C'est ce que notre code va aller chercher et lire automatiquement.

### C'est quoi le JSON ?

JSON est un format pour organiser des données. Ça ressemble à ça :

```json
{
  "name": "bulbasaur",
  "id": 1,
  "sprites": {
    "front_default": "https://..."
  }
}
```

C'est comme un dictionnaire : une clé (`"name"`) et une valeur (`"bulbasaur"`).
En JS, on accède à une valeur avec un point : `data.name` → `"bulbasaur"`.

### Écrire le code JS

Remplace tout le contenu de `game.js` par ceci :

```js
// Le nombre total de Pokémon dans la base
const MAX_ID = 1025;

// Génère un nombre entier aléatoire entre 1 et MAX_ID
function randomId() {
  return Math.floor(Math.random() * MAX_ID) + 1;
}

// Charge les données d'un Pokémon depuis l'API
async function loadPokemon(id) {
  // fetch() envoie une requête à une URL et attend la réponse
  const res  = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  // .json() lit la réponse et la convertit en objet JS
  const data = await res.json();

  // On fait un deuxième appel pour avoir les noms traduits (FR, EN, etc.)
  const specRes = await fetch(data.species.url);
  const species = await specRes.json();

  // On récupère l'URL de l'image (haute qualité, avec fallback)
  const imgUrl = data.sprites.other?.['official-artwork']?.front_default
                 || data.sprites.front_default;

  // On renvoie les trois infos regroupées dans un objet
  return { data, species, imgUrl };
}

// Charge et affiche un nouveau Pokémon
async function newPokemon() {
  document.getElementById('status-text').textContent = 'CHARGEMENT...';
  const payload = await loadPokemon(randomId());
  document.getElementById('pokemon-img').src = payload.imgUrl;
  document.getElementById('status-text').textContent = 'PRÊT';
  console.log(payload); // pour voir ce qu'on reçoit
}

// Quand on clique "NOUVEAU" → appelle newPokemon()
document.getElementById('btn-new').addEventListener('click', newPokemon);

// Au chargement de la page → charge un Pokémon automatiquement
document.addEventListener('DOMContentLoaded', newPokemon);
```

**Les mots-clés expliqués :**

`async` / `await` → quand on contacte une API, ça prend du temps (une fraction de seconde). `async` dit "cette fonction fait des choses qui prennent du temps". `await` dit "attends que ce soit fini avant de continuer".

`function` → un bloc de code réutilisable. On lui donne un nom, on l'appelle quand on en a besoin.

`const` → crée une variable dont la valeur ne changera pas. `let` crée une variable qu'on pourra modifier plus tard.

`document.getElementById('status-text')` → trouve l'élément HTML qui a `id="status-text"`.

`.textContent = 'CHARGEMENT...'` → change le texte affiché dans cet élément.

`.addEventListener('click', newPokemon)` → "quand on clique sur ce bouton, appelle la fonction newPokemon".

**Sauvegarde → le navigateur se recharge.**

✅ Une image de Pokémon s'affiche au chargement.
✅ Clic "NOUVEAU" → une nouvelle image s'affiche.
✅ F12 → Console → tu vois les données du Pokémon.
✅ F12 → Network → tu vois deux appels API partir.

---

## Étape 3 — La silhouette

On veut que le Pokémon soit caché. On va le rendre tout noir.

Ajoute dans `style.css` :

```css
/* L'écran avec le Pokémon */
#screen {
  background: #a8d878; /* vert Game Boy */
  padding: 20px;
  display: inline-block;
}

/* L'image du Pokémon — rendue noire */
#pokemon-img {
  filter: brightness(0);
  max-height: 200px;
}
```

**Ce que ça veut dire :**

- `#screen` → le `#` veut dire "l'élément avec l'id screen"
- `background: #a8d878` → couleur de fond. `#a8d878` est un code hexadécimal (une façon d'écrire une couleur).
- `filter: brightness(0)` → `brightness(0)` = luminosité à zéro = tout noir. La forme reste visible parce que le fond transparent de l'image est préservé.
- `max-height: 200px` → l'image ne dépassera pas 200 pixels de hauteur.

> La révélation sera simplement `filter: none` (on enlève le filtre). C'est tout.

✅ L'image s'affiche en noir sur fond vert. On ne reconnaît pas le Pokémon.

---

## Étape 4 — Deviner le Pokémon

On va gérer ce qui se passe quand le joueur tape un nom.

### Le problème des accents

"Évoli" et "evoli" doivent être acceptés tous les deux.
"PIKACHU" et "pikachu" aussi.

On crée une fonction qui "normalise" le texte avant de comparer :

```js
// Transforme un texte pour pouvoir le comparer sans se soucier des accents ni de la casse
function normalize(s) {
  return s
    .toLowerCase()                        // met tout en minuscules
    .normalize('NFD')                     // décompose les lettres accentuées (é → e + accent)
    .replace(/[\u0300-\u036f]/g, '')      // supprime les accents
    .replace(/[^a-z0-9]/g, '');          // supprime tout sauf lettres et chiffres
}

// Exemples (tu peux tester dans la console F12) :
// normalize('Évoli')    → 'evoli'
// normalize('PIKACHU')  → 'pikachu'
// normalize('Mr. Mime') → 'mrmime'
```

### Récupérer les noms FR et EN

L'API nous donne les noms dans toutes les langues. On extrait juste FR et EN :

```js
// Cherche le nom d'un Pokémon dans une langue donnée
function getNames(species, data) {
  const find = (lang) =>
    species.names.find(n => n.language.name === lang)?.name
    ?? data.name; // si le nom FR n'existe pas, on utilise le nom anglais par défaut

  return {
    en: find('en'), // ex: "Eevee"
    fr: find('fr'), // ex: "Évoli"
  };
}
```

`?.` est l'opérateur "optional chaining" : si `find(...)` renvoie `undefined`, ça ne plante pas.
`??` veut dire "si ce qui est à gauche est null/undefined, utilise ce qui est à droite".

### Stocker le Pokémon en cours

On a besoin d'une variable pour se souvenir du Pokémon affiché.
Ajoute ces deux lignes **en haut de game.js** :

```js
let current  = null; // le Pokémon actuellement affiché
let revealed = false; // est-ce que le Pokémon a été révélé ?
```

`let` crée une variable modifiable. `null` veut dire "rien pour l'instant".

Dans `newPokemon()`, ajoute ces lignes après le chargement :

```js
async function newPokemon() {
  revealed = false;
  document.getElementById('status-text').textContent = 'CHARGEMENT...';
  const payload = await loadPokemon(randomId());
  current = payload;  // ← on mémorise le Pokémon chargé
  document.getElementById('pokemon-img').src = payload.imgUrl;
  document.getElementById('status-text').textContent = 'PRÊT';
}
```

### La fonction de vérification

```js
function check() {
  // Si pas de Pokémon chargé ou déjà révélé → on ne fait rien
  if (!current || revealed) return;

  // On lit ce que le joueur a tapé
  const guess = document.getElementById('guess-input').value.trim();
  if (!guess) return; // si le champ est vide → on ne fait rien

  // On récupère les noms FR et EN du Pokémon affiché
  const names = getNames(current.species, current.data);

  // On compare (après normalisation des deux côtés)
  const isCorrect =
    normalize(guess) === normalize(names.en) ||
    normalize(guess) === normalize(names.fr);

  if (isCorrect) {
    document.getElementById('status-text').textContent = 'BONNE RÉPONSE !';
  } else {
    document.getElementById('status-text').textContent = 'MAUVAISE RÉPONSE.';
  }
}

// Bouton "DEVINER" → appelle check()
document.getElementById('btn-guess').addEventListener('click', check);

// Touche Entrée → même effet que le bouton
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') check();
});
```

✅ Taper le bon nom (FR ou EN) → "BONNE RÉPONSE !"
✅ Taper n'importe quoi → "MAUVAISE RÉPONSE."
✅ Taper avec ou sans accents → les deux marchent.
✅ Appuyer sur Entrée → même effet que le bouton.

---

## Étape 5 — La révélation

Quand on a la bonne réponse (ou qu'on abandonne), on révèle le Pokémon en couleur.

```js
// Révèle le Pokémon : enlève la silhouette et affiche son nom
function revealPokemon() {
  revealed = true;
  // filter: none → supprime le brightness(0), l'image redevient colorée
  document.getElementById('pokemon-img').style.filter = 'none';
  // On affiche le nom en majuscules
  const names = getNames(current.species, current.data);
  document.getElementById('pokemon-name').textContent = names.fr.toUpperCase();
}

// Bouton "RÉVÉLER" → révèle sans passer au Pokémon suivant
function reveal() {
  if (!current || revealed) return;
  revealPokemon();
  document.getElementById('status-text').textContent = 'RÉVÉLÉ';
}

document.getElementById('btn-reveal').addEventListener('click', reveal);
```

Maintenant, modifie `check()` : sur bonne réponse, on révèle et on passe automatiquement au suivant après 1.5 secondes.

Dans `check()`, remplace le bloc `if (isCorrect)` par :

```js
if (isCorrect) {
  revealPokemon();
  document.getElementById('status-text').textContent = 'BONNE RÉPONSE !';
  setTimeout(newPokemon, 1500); // attend 1500ms (= 1.5s) puis appelle newPokemon
}
```

`setTimeout(fonction, délai)` → appelle `fonction` après `délai` millisecondes.

Et modifie `newPokemon()` pour remettre à zéro à chaque nouveau Pokémon :

```js
async function newPokemon() {
  revealed = false;
  document.getElementById('pokemon-img').style.filter = 'brightness(0)'; // remet la silhouette
  document.getElementById('pokemon-name').textContent = '';               // efface le nom
  document.getElementById('guess-input').value = '';                      // vide le champ
  // ... reste du code identique
}
```

✅ Bonne réponse → image en couleur + nom affiché + nouveau Pokémon après 1.5s.
✅ Bouton "RÉVÉLER" → même effet mais sans passer au suivant.
✅ Bouton "NOUVEAU" → silhouette noire, nom effacé.

---

## Étape 6 — Score et animation sur erreur

### Le score

Ajoute en haut de `game.js` :

```js
let score = { correct: 0, wrong: 0 };
```

`{ correct: 0, wrong: 0 }` est un objet avec deux propriétés.
On les lit comme ça : `score.correct`, `score.wrong`.

```js
function updateScore() {
  document.getElementById('score-display').innerHTML =
    `✓ ${score.correct} &nbsp; ✗ ${score.wrong}`;
}
```

Les backticks `` ` `` permettent d'écrire des "template literals" : on peut insérer des variables avec `${...}` directement dans une chaîne de texte.

Dans `check()`, ajoute juste avant la vérification `isCorrect` :

```js
if (isCorrect) {
  score.correct++;
  // ...
} else {
  score.wrong++;
  // ...
}
updateScore();
```

`score.correct++` est un raccourci pour `score.correct = score.correct + 1`.

### Animation "shake" sur mauvaise réponse

Dans `style.css` :

```css
/* Définition de l'animation */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%       { transform: translateX(-6px); }
  40%       { transform: translateX(6px); }
  60%       { transform: translateX(-4px); }
  80%       { transform: translateX(4px); }
}

/* Classe qu'on ajoute/retire en JS */
.shake {
  animation: shake 0.4s ease;
  border-color: red;
}
```

`@keyframes` définit une animation image par image. `translateX(-6px)` déplace l'élément de 6 pixels vers la gauche.

Dans `game.js` :

```js
function shake(node) {
  node.classList.remove('shake');  // enlève d'abord la classe
  void node.offsetWidth;           // ← IMPORTANT : force le navigateur à recalculer
  node.classList.add('shake');     // remet la classe → l'animation repart de zéro
  node.addEventListener('animationend', () => {
    node.classList.remove('shake');
  }, { once: true }); // { once: true } = écoute une seule fois, puis se supprime automatiquement
}
```

`void node.offsetWidth` est un "hack" standard : sans ça, si l'animation tourne déjà et qu'on lui demande de recommencer, le navigateur l'ignore. Cette ligne force une relecture du layout, ce qui permet de relancer l'animation.

Dans `check()` sur mauvaise réponse :

```js
shake(document.getElementById('guess-input'));
```

✅ Mauvaise réponse → le champ de saisie se secoue et sa bordure devient rouge.
✅ Le score se met à jour à chaque tentative.

---

## Étape 7 — Indices

À chaque clic sur "INDICE", on révèle un peu plus de lettres.

```js
let hintStep = 0;
const HINT_STEPS = [1, 3, 5]; // on révèle 1 lettre, puis 3, puis 5

function hint() {
  if (!current || revealed) return;

  const names  = getNames(current.species, current.data);
  const len    = HINT_STEPS[Math.min(hintStep, HINT_STEPS.length - 1)];
  hintStep     = Math.min(hintStep + 1, HINT_STEPS.length - 1);
  const str    = names.fr.slice(0, len).toUpperCase() + '...';

  document.getElementById('status-text').textContent = 'COMMENCE PAR : ' + str;
}

document.getElementById('btn-hint').addEventListener('click', hint);
```

`'Bulbizarre'.slice(0, 3)` → `'Bul'` (extrait les 3 premiers caractères).
`Math.min(a, b)` → renvoie le plus petit des deux nombres.

Dans `newPokemon()`, ajouter : `hintStep = 0;`

✅ 1er clic → "COMMENCE PAR : B..."
✅ 2ème clic → "COMMENCE PAR : BUL..."
✅ 3ème clic → "COMMENCE PAR : BULBI..."

---

## Étape 8 — Prefetch (chargement en avance)

Sans prefetch : quand tu cliques "NOUVEAU", le jeu attend 1-2 secondes que l'API réponde.
Avec prefetch : le prochain Pokémon est déjà chargé en arrière-plan. La transition est instantanée.

```js
let nextPromise = null;

// Lance le chargement du prochain Pokémon sans attendre
function prefetchNext() {
  nextPromise = loadPokemon(randomId()).catch(() => {
    nextPromise = null; // si ça échoue, on laisse newPokemon faire un appel normal
  });
}
```

Modifie `newPokemon()` :

```js
async function newPokemon() {
  revealed  = false;
  hintStep  = 0;
  document.getElementById('pokemon-img').style.filter = 'brightness(0)';
  document.getElementById('pokemon-name').textContent = '';
  document.getElementById('guess-input').value = '';
  document.getElementById('status-text').textContent = 'CHARGEMENT...';

  // Si un prefetch est en cours, on attend sa résolution (déjà bien avancé)
  // Sinon, on fait un appel normal
  const payload = nextPromise
    ? await nextPromise
    : await loadPokemon(randomId());

  nextPromise = null;
  current = payload;
  document.getElementById('pokemon-img').src = payload.imgUrl;
  document.getElementById('status-text').textContent = 'PRÊT';

  prefetchNext(); // ← lance immédiatement le chargement du suivant
}
```

✅ F12 → Network → un appel API part en arrière-plan après chaque chargement.
✅ Clic "NOUVEAU" → l'image apparaît quasi instantanément.

---

## Étape 9 — Sauvegarder avec localStorage

Le problème : si tu recharges la page, tout est perdu.
`localStorage` permet de sauvegarder des données dans le navigateur. Elles restent même après fermeture.

```js
const SAVE_KEY = 'wtp_save'; // la clé sous laquelle on sauvegarde

function persist() {
  const state = {
    correct       : score.correct,
    wrong         : score.wrong,
    lastPokemonId : current?.data?.id ?? null,
    wasRevealed   : revealed,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  // JSON.stringify transforme l'objet JS en texte pour le stocker
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw); // JSON.parse fait l'inverse : texte → objet JS
  } catch {
    return null; // si le JSON est corrompu → on repart de zéro
  }
}
```

`try { ... } catch { ... }` → si le code dans `try` plante, au lieu de tout casser, on exécute le `catch`.

Remplace `document.addEventListener('DOMContentLoaded', newPokemon)` par :

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
        if (save.wasRevealed) {
          revealPokemon();
        } else {
          document.getElementById('pokemon-img').style.filter = 'brightness(0)';
        }
        prefetchNext();
        return; // on a tout restauré, pas besoin d'appeler newPokemon
      } catch {
        // la restauration a échoué → on repart normalement
      }
    }
  }

  newPokemon();
}

document.addEventListener('DOMContentLoaded', init);
```

Ajoute `persist();` à la fin de `check()` et à la fin de `newPokemon()`.

✅ Joue quelques rounds → recharge la page (F5) → même Pokémon, même score.

---

## Étape 10 — XP et niveaux

On récompense les bonnes réponses avec de l'expérience.

Dans le HTML, ajoute dans `#mini-screen` :

```html
<div id="level-display">LVL 1 · 0/50 XP</div>
```

Dans `game.js` :

```js
let xp    = 0;
let level = 1;
const XP_PAR_NIVEAU = 50;

function updateLevelDisplay() {
  document.getElementById('level-display').textContent =
    `LVL ${level}  ·  ${xp}/${XP_PAR_NIVEAU} XP`;
}

function addXP() {
  xp++;
  if (xp >= XP_PAR_NIVEAU) {
    xp = 0;
    level++;
    document.getElementById('status-text').textContent = `★ NIVEAU ${level} ! ★`;
  }
  updateLevelDisplay();
  persist();
}
```

Dans `check()`, appelle `addXP()` uniquement sur bonne réponse :

```js
if (isCorrect) {
  score.correct++;
  addXP();         // ← ajouter ici
  revealPokemon();
  // ...
}
```

Restaure `xp` et `level` dans `init()` depuis la sauvegarde.

✅ Bonne réponse → XP monte.
✅ 50 bonnes réponses → "★ NIVEAU 2 ! ★"

---

## Étape 11 — Sons (Web Audio API)

On génère des sons directement en JS, sans aucun fichier audio.

```js
let audioCtx = null;

// Crée le contexte audio la première fois qu'on en a besoin
function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

// Joue un bip à une fréquence et durée données
function playBeep(freq, duration, vol = 0.4) {
  const ctx  = getCtx();
  const now  = ctx.currentTime;
  const osc  = ctx.createOscillator(); // génère une onde sonore
  const gain = ctx.createGain();       // contrôle le volume

  osc.connect(gain);           // branchement : oscillateur → volume
  gain.connect(ctx.destination); // branchement : volume → sortie (haut-parleurs)

  osc.type            = 'sine';  // forme d'onde (sine = son doux)
  osc.frequency.value = freq;    // hauteur du son en Hz

  gain.gain.setValueAtTime(vol, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration); // fondu

  osc.start(now);
  osc.stop(now + duration);
}

// Sons du jeu
const SOUNDS = {
  correct() {
    // Arpège montant : Do (523Hz) → Mi (659Hz) → Sol (784Hz)
    [523, 659, 784].forEach((f, i) => setTimeout(() => playBeep(f, 0.2), i * 80));
  },
  wrong() {
    playBeep(200, 0.3, 0.3); // son grave
  },
};
```

> Le navigateur interdit de créer un `AudioContext` sans interaction utilisateur.
> C'est pour ça qu'on le crée lazily (à la première utilisation, qui est forcément après un clic).

Ajoute `SOUNDS.correct()` dans `check()` sur bonne réponse, et `SOUNDS.wrong()` sur mauvaise réponse.

✅ Bonne réponse → mélodie montante.
✅ Mauvaise réponse → son grave.

---

## Étape 12 — CSS : look Pokédex

Le jeu fonctionne. On peut maintenant l'habiller.

Ajoute dans `<head>` (dans `index.html`) :

```html
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" />
```

`Press Start 2P` est une police Google Fonts qui ressemble aux jeux Game Boy.

Remplace tout le contenu de `style.css` :

```css
/* Couleurs du thème */
:root {
  --rouge   : #cc0000;
  --vert    : #9bbc0f;
  --vert-fonce : #306230;
  --texte   : #0f380f;
}

/* Fond de la page */
body {
  background : #1a1a2e;
  display    : flex;
  justify-content: center; /* centre horizontalement */
  align-items    : center; /* centre verticalement */
  min-height : 100vh;      /* prend toute la hauteur de l'écran */
  font-family: 'Press Start 2P', monospace;
  margin     : 0;
}

/* Le boîtier du Pokédex */
.pokedex {
  background   : var(--rouge);
  border-radius: 16px;
  padding      : 24px;
  max-width    : 420px;
  width        : 100%;
}

/* L'écran principal */
#screen {
  background    : var(--vert);
  border-radius : 8px;
  min-height    : 240px;
  display       : flex;
  align-items   : center;
  justify-content: center;
}

/* L'image du Pokémon */
#pokemon-img {
  max-height : 200px;
  filter     : brightness(0);
}

/* Le mini-écran de texte */
#mini-screen {
  background   : var(--vert-fonce);
  color        : var(--vert);
  padding      : 8px 12px;
  font-size    : 0.55rem;
  margin-top   : 8px;
  border-radius: 4px;
  min-height   : 48px;
}

/* Les contrôles */
#controls {
  display  : flex;
  flex-wrap: wrap;
  gap      : 8px;
  margin-top: 16px;
}

/* Le champ de saisie */
#guess-input {
  width      : 100%;
  background : var(--vert-fonce);
  color      : var(--vert);
  border     : 2px solid var(--vert);
  padding    : 8px;
  font-family: inherit;
  font-size  : 0.55rem;
  box-sizing : border-box;
}

/* Les boutons */
button {
  background : var(--vert-fonce);
  color      : var(--vert);
  border     : none;
  padding    : 8px 12px;
  font-family: inherit;
  font-size  : 0.5rem;
  cursor     : pointer;
}
button:hover { background: var(--texte); }

/* Score et niveau */
#score-display, #level-display {
  color     : var(--vert);
  font-size : 0.5rem;
  margin-top: 6px;
}

/* Animation shake */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%       { transform: translateX(-6px); }
  40%       { transform: translateX(6px); }
  60%       { transform: translateX(-4px); }
  80%       { transform: translateX(4px); }
}
.shake {
  animation  : shake 0.4s ease;
  border-color: red !important;
}
```

Dans le HTML, entoure tout le contenu du `<body>` dans une div :

```html
<body>
  <div class="pokedex">
    <!-- tout le contenu ici -->
  </div>
  <script src="game.js"></script>
</body>
```

✅ Recharger → look rétro Pokédex rouge sur fond sombre.

---

## Étape 13 — Animations

Les animations arrivent **après** le design. Jamais avant.

Dans `style.css` :

```css
/* Animation d'entrée du Pokédex */
.pokedex {
  animation: floatIn 0.8s ease both;
}
@keyframes floatIn {
  from { opacity: 0; transform: translateY(40px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Animation de révélation */
.screen--revealed #pokemon-img {
  filter    : none;
  animation : popIn 0.55s cubic-bezier(.34, 1.56, .64, 1) both;
}
@keyframes popIn {
  from { transform: scale(0.5); opacity: 0; }
  to   { transform: scale(1);   opacity: 1; }
}

/* Flash vert sur bonne réponse */
.screen--flash {
  animation: flash 0.6s ease;
}
@keyframes flash {
  0%, 100% { background: var(--vert); }
  30%       { background: #c8f000; }
}
```

Dans `game.js` :

Dans `revealPokemon()` :
```js
document.getElementById('screen').classList.add('screen--revealed');
```

Dans `check()` sur bonne réponse :
```js
document.getElementById('screen').classList.add('screen--flash');
```

Dans `newPokemon()` au début :
```js
document.getElementById('screen').classList.remove('screen--revealed', 'screen--flash');
```

✅ Au chargement → le Pokédex glisse depuis le bas.
✅ Révélation → le Pokémon apparaît avec un rebond.
✅ Bonne réponse → flash vert.

---

## Étape 14 — Responsive mobile

```css
@media (max-width: 600px) {
  /* Sur petit écran, les boutons prennent toute la largeur */
  button        { width: 100%; }
  #guess-input  { font-size: 0.7rem; }
  #screen       { min-height: 180px; }
  #pokemon-img  { max-height: 150px; }
}
```

`@media (max-width: 600px)` → ces règles s'appliquent **uniquement** si l'écran fait moins de 600px de large.

Dans `game.js`, évite d'ouvrir le clavier automatiquement sur mobile :

```js
// Dans newPokemon(), à la fin :
if (!('ontouchstart' in window)) {
  document.getElementById('guess-input').focus();
}
```

`'ontouchstart' in window` vaut `true` sur mobile (les écrans tactiles ont cet événement), `false` sur desktop.

✅ Sur téléphone → le layout s'adapte, le clavier ne s'ouvre pas tout seul.

---

## Étape 15 — Refacto : organiser le code

Une fois que tout fonctionne, on range le code en modules.
C'est **toujours la dernière étape**.

### Pourquoi ?

En ce moment, toutes tes variables (`score`, `level`, `current`...) sont dans le scope "global" — elles sont accessibles depuis n'importe où dans le fichier. Si le projet grossit, ça devient incontrôlable.

Un IIFE (Immediately Invoked Function Expression) crée un espace privé :

```js
// Avant — tout en global :
let muted = false;
function playSound() { ... }

// Après — encapsulé dans un module :
const Audio = (() => {
  let muted = false; // ← privé, personne d'autre ne peut y accéder

  function play(type) { ... }

  return { play }; // ← ce qu'on expose au reste du code
})(); // ← les () à la fin exécutent la fonction immédiatement

// Utilisation :
Audio.play('correct');
```

L'ordre d'extraction (du moins dépendant au plus dépendant) :

```
Storage  → aucune dépendance
Api      → aucune dépendance
Audio    → aucune dépendance
Game     → utilise les autres
```

---

## Récap — l'ordre complet

```
Étape 0  → 3 fichiers vides
Étape 1  → HTML brut (les éléments)
Étape 2  → API + image           ← premier truc visible
Étape 3  → Silhouette CSS        ← 1 ligne
Étape 4  → Deviner               ← le jeu tourne
Étape 5  → Révélation            ← boucle complète
Étape 6  → Score + shake
Étape 7  → Indices
Étape 8  → Prefetch
Étape 9  → localStorage
Étape 10 → XP / niveaux
Étape 11 → Audio
Étape 12 → CSS design            ← on habille en dernier
Étape 13 → Animations
Étape 14 → Responsive
Étape 15 → Refacto               ← toujours en dernier
```

---

## Ce qu'on ne fait jamais en premier

| Mauvaise idée | Pourquoi |
|---|---|
| Commencer par le CSS | Le HTML va changer → CSS à refaire |
| Commencer par les animations | On ne sait pas encore quels états existent |
| Refactorer avant que ça marche | Deux problèmes à la fois = impossible à déboguer |
| Tout coder d'un coup sans tester | Si ça plante, on ne sait pas où |

**Règle à chaque étape :** sauvegarder → recharger → tester → zéro erreurs rouges en console → passer à la suite.
