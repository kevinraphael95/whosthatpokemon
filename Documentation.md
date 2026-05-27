# Who's That Pokémon — Documentation Technique

> **Version** 1.0.0 · **Stack** Vanilla JS / CSS3 / HTML5 · **API** PokéAPI v2

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture des fichiers](#2-architecture-des-fichiers)
3. [Configuration globale — `CONFIG`](#3-configuration-globale--config)
4. [Internationalisation — `T`](#4-internationalisation--t)
5. [Module `Storage`](#5-module-storage)
6. [Module `Api`](#6-module-api)
7. [Module `Audio`](#7-module-audio)
8. [Module `Dom`](#8-module-dom)
9. [Module `Toast`](#9-module-toast)
10. [Module `LevelUpPopup`](#10-module-leveluppopup)
11. [Module `Game`](#11-module-game)
12. [Flux de données & cycle de vie](#12-flux-de-données--cycle-de-vie)
13. [Structure HTML](#13-structure-html)
14. [Architecture CSS](#14-architecture-css)
15. [Responsive & mobile](#15-responsive--mobile)
16. [Persistance de session](#16-persistance-de-session)
17. [Gestion des erreurs](#17-gestion-des-erreurs)

---

## 1. Vue d'ensemble

**Who's That Pokémon** est un jeu de devinette frontend-only. Le joueur doit identifier un Pokémon à partir de sa silhouette noire. Il peut demander des indices, révéler la réponse, ou deviner directement. Chaque bonne réponse rapporte de l'XP qui fait progresser un niveau.

**Contraintes techniques :**
- Zéro dépendance externe (aucun framework, aucune lib)
- Persistence via `localStorage`
- Audio entièrement synthétique via Web Audio API (pas de fichiers .mp3 pour les sons UI, sauf les jingles de level-up)
- Compatible desktop & mobile

---

## 2. Architecture des fichiers

```
who's-that-pokemon/
├── index.html             # Structure DOM statique
├── style.css              # Tous les styles (variables, composants, responsive)
├── game.js                # Logique entière du jeu (modules IIFE)
├── wtp-logo.png           # Logo affiché sur l'écran principal
└── pokemon_wallpaper.png  # Fond de page (optionnel, dégradé si absent)
```

`game.js` est le seul fichier JavaScript. Il est organisé en **modules IIFE** (Immediately Invoked Function Expressions) encapsulés : chaque module expose une API publique minimale et garde son état interne privé.

---

## 3. Configuration globale — `CONFIG`

```js
const CONFIG = { ... }
```

Point d'entrée unique pour tous les paramètres réglables. **Ne jamais écrire de constante numérique ou temporelle en dur ailleurs dans le code.**

| Clé | Type | Valeur par défaut | Description |
|---|---|---|---|
| `MAX_POKEMON_ID` | `number` | `1025` | Borne max pour les ID aléatoires (Gen 1 → 9) |
| `LEVEL_THRESHOLD` | `number` | `50` | XP nécessaire pour passer un niveau |
| `MASTER_VOLUME` | `number` | `0.95` | Coefficient multiplicateur global du volume audio |
| `SAVE_KEY` | `string` | `'wtp_save'` | Clé `localStorage` pour la sauvegarde |
| `TOAST_DURATION` | `number` | `2200` | Durée standard d'affichage d'un toast (ms) |
| `TOAST_SHORT` | `number` | `1500` | Toast court (mauvaise réponse) |
| `TOAST_LONG` | `number` | `3000` | Toast long (indice, erreur) |
| `REVEAL_DELAY` | `number` | `2000` | Durée du toast de révélation (ms) |
| `AUTO_NEXT_DELAY` | `number` | `1500` | Délai avant chargement auto après bonne réponse (ms) |
| `LEVELUP_HIDE` | `number` | `6000` | Durée avant fermeture auto du popup level-up (ms) |
| `HINT_STEPS` | `number[]` | `[1, 3, 5]` | Nombre de lettres révélées à chaque appel à `hint()` |
| `LEVELUP_SOUNDS` | `object` | — | URLs des deux jingles de level-up (picross, bank) |

---

## 4. Internationalisation — `T`

```js
const T = { fr: { ... }, en: { ... } }
```

Dictionnaire de traductions indexé par code langue (`'fr'` ou `'en'`). Toutes les chaînes visibles par l'utilisateur passent par `T[lang]`.

Certaines valeurs sont des **fonctions** qui acceptent un paramètre et retournent une chaîne formatée :

```js
T.fr.hint(l)       // → "COMMENCE PAR : AB..."
T.fr.toastLevelUp(lvl) // → "🏆 NIVEAU 3 !"
T.fr.levelLabel(lvl, xp) // → "LVL 3  ·  12/50 XP"
T.fr.popupSub(lvl) // → "NIVEAU 3 ATTEINT"
```

**Ajouter une langue :** dupliquer le bloc `fr` ou `en`, ajouter la clé dans `T`, puis exposer le sélecteur dans `toggleLang()`.

---

## 5. Module `Storage`

```js
const Storage = { load(), save(state) }
```

Wrapper autour de `localStorage`. Isole les appels de façon à ce que le reste du code ne manipule jamais `localStorage` directement, ce qui facilite un éventuel remplacement par `IndexedDB` ou une API distante.

### `Storage.load() → object | null`

Lit et parse la sauvegarde JSON. Retourne `null` en cas d'absence ou d'erreur de parsing (JSON corrompu).

### `Storage.save(state)`

Sérialise `state` en JSON et l'écrit sous `CONFIG.SAVE_KEY`. Les erreurs (quota dépassé, mode privé strict) sont catchées silencieusement et loggées.

**Forme du `state` persisté :**

```js
{
  level         : number,   // niveau actuel
  xp            : number,   // XP dans le niveau courant
  correct       : number,   // total bonnes réponses
  wrong         : number,   // total mauvaises réponses
  muted         : boolean,  // état du son
  lastPokemonId : number,   // ID du dernier Pokémon affiché
  wasRevealed   : boolean   // état de révélation au moment de la sauvegarde
}
```

---

## 6. Module `Api`

```js
const Api = (() => { ... })()
// API publique : { loadPokemon(id) }
```

Gère tous les appels réseau vers PokéAPI. Implémente un **cache en mémoire** (`Map`) pour éviter les doublons de requêtes à travers la session.

### `Api.loadPokemon(id) → Promise<payload>`

Enchaîne trois opérations asynchrones :

1. **Fetch Pokémon** — `GET /api/v2/pokemon/{id}` → sprites, nom canonique, URL de l'espèce
2. **Fetch Species** — `GET /api/v2/pokemon-species/{id}` → noms localisés (`names[]`)
3. **Préchargement image** — crée un `Image()` temporaire pour que l'image soit dans le cache navigateur avant affichage

Retourne un objet `payload` :

```js
{
  data    : object,  // réponse brute /pokemon/{id}
  species : object,  // réponse brute /pokemon-species/{id}
  imgUrl  : string   // URL de l'official artwork (ou sprite fallback)
}
```

**Stratégie image :** priorité à `sprites.other['official-artwork'].front_default`, fallback sur `sprites.front_default`.

**Cache :** la `Map` est locale au module (closure). Elle persiste pendant toute la session navigateur mais est détruite au rechargement de page.

### `fetchJSON(url)` *(privé)*

Vérifie le cache avant tout appel réseau. Lance une erreur si `response.ok === false`.

### `preloadImage(url)` *(privé)*

Retourne une Promise qui se résout quand l'image est entièrement téléchargée, ou rejette en cas d'erreur réseau.

---

## 7. Module `Audio`

```js
const Audio = (() => { ... })()
// API publique : { preload(), play(type), playLevelUp(), setMuted(val), isMuted() }
```

Synthèse sonore entièrement en Web Audio API. Le contexte audio (`AudioContext`) est créé lazily au premier appel pour respecter la politique d'autoplay des navigateurs.

### Sons synthétiques — `SOUNDS`

Objet interne listant tous les sons UI. Chaque entrée est une fonction qui crée et connecte des nœuds Web Audio, puis les programme pour jouer immédiatement.

| Clé | Déclencheur | Description |
|---|---|---|
| `ui` | Actions génériques (toggle langue, no-op) | Bip court montant |
| `click` | — | Clic triangle court |
| `correct` | Bonne réponse | Arpège Do-Mi-Sol (3 notes) |
| `wrong` | Mauvaise réponse | Descente grave |
| `reveal` | Bouton révéler | Arpège Mi-Si-Ré montant |
| `hint` | Bouton indice | Bip montant |
| `newmon` | Nouveau Pokémon | Descente expressive |
| `levelup` | Level-up (fallback sans fichier) | Fanfare 5 notes |

**Patterns communs à tous les sons :**
- Création d'un `OscillatorNode` + `GainNode`
- Connexion : `osc → gain → destination`
- Enveloppe volume via `setValueAtTime` / `exponentialRampToValueAtTime`
- Lecture immédiate (`osc.start(now)`) puis arrêt planifié (`osc.stop`)

### Jingles level-up — `preload()` + `playLevelUp()`

Les deux jingles MP3 (`picross`, `bank`) sont préchargés au démarrage via `fetch()` + `decodeAudioData()` et stockés dans `buffers`. `playLevelUp()` sélectionne `picross` dans 99% des cas, `bank` dans 1% (easter egg).

### `play(type)`

Dispatch vers `SOUNDS[type]()`. Ignore silencieusement si `muted === true` ou si le type n'existe pas.

---

## 8. Module `Dom`

```js
const Dom = (() => { ... })()
// API publique : { init(), get(id), setText(id, text), setHtml(id, html) }
```

Centralise l'accès aux éléments DOM. **Évite les `document.getElementById()` dispersés** dans le code métier.

### `Dom.init()`

Parcourt la liste `ids` et peuple l'objet `el` en liant chaque clé à son élément. À appeler une seule fois, au démarrage dans `Game.init()`. Les deux boutons sans `id` (`btnHint`, `btnReveal`) sont résolus via `querySelector`.

### `Dom.get(id) → HTMLElement`

Retourne l'élément mis en cache. Retourne `undefined` si l'id n'est pas dans la liste — toujours vérifier avant usage conditionnel (ex: `Dom.get('btn-mute')?.addEventListener(...)`).

### `Dom.setText(id, text)` / `Dom.setHtml(id, html)`

Wrappers sécurisés : vérifient que le nœud existe avant d'écrire.

---

## 9. Module `Toast`

```js
const Toast = { show(msg, duration?) }
```

Notification flottante en bas d'écran. L'élément `.toast` est **créé dynamiquement** au premier appel (lazy init) et réutilisé ensuite.

### `Toast.show(msg, duration?)`

- Injecte le texte
- Ajoute la classe `.show` (déclanche la transition CSS)
- Annule le timer précédent via `clearTimeout` pour éviter des collisions si deux toasts se succèdent rapidement
- Retire `.show` après `duration` ms (défaut : `CONFIG.TOAST_DURATION`)

---

## 10. Module `LevelUpPopup`

```js
const LevelUpPopup = { show(lvl, lang) }
```

Modal de félicitation affiché lors d'un passage de niveau.

### Cycle de vie

```
LevelUpPopup.show(lvl, lang)
  → lazy init : crée le DOM si premier appel
  → remplit #popup-title et #popup-level via T[lang]
  → ajoute .show (opacity 1, pointer-events on)
  → setTimeout(hide, CONFIG.LEVELUP_HIDE) → fermeture auto
  → clic sur "OK" → hide() immédiat
```

Le popup se ferme soit manuellement (bouton OK), soit automatiquement après `LEVELUP_HIDE` ms (6 secondes par défaut).

---

## 11. Module `Game`

```js
const Game = (() => { ... })()
// API publique : { newPokemon(), toggleLang(), check(), reveal(), hint() }
```

Cœur de l'application. Contient l'intégralité de l'état de jeu et orchestre tous les autres modules.

### État interne

| Variable | Type | Description |
|---|---|---|
| `current` | `object \| null` | Payload du Pokémon actuellement affiché |
| `nextPromise` | `Promise \| null` | Prefetch du prochain Pokémon en cours |
| `lang` | `'fr' \| 'en'` | Langue active |
| `score` | `{correct, wrong}` | Compteurs de session |
| `hintStep` | `number` | Index actuel dans `CONFIG.HINT_STEPS` |
| `revealed` | `boolean` | Vrai si la silhouette a été révélée |
| `loading` | `boolean` | Verrou anti-double-clic sur "Nouveau Pokémon" |
| `level` | `number` | Niveau actuel |
| `xp` | `number` | XP dans le niveau courant |
| `lastPokemonId` | `number \| null` | Dernier ID chargé (pour la restauration) |
| `wasRevealed` | `boolean` | État de révélation au chargement de la save |

### `Game.init()`

Point d'entrée. Appelé sur `DOMContentLoaded`.

```
1. Dom.init()
2. loadSave()         ← restaure level/xp/score/mute depuis localStorage
3. applyLang()        ← traduit tous les labels
4. updateLevelDisplay()
5. Audio.preload()    ← précharge les jingles MP3 en arrière-plan
6. Si lastPokemonId existe → tente de restaurer le Pokémon précédent
   Sinon → newPokemon()
7. Attache tous les event listeners
```

### `Game.newPokemon()`

Fonction asynchrone principale.

```
1. Guard : if (loading) return   ← anti double-clic
2. loading = true ; hintStep = 0
3. exitScreen()                  ← animation de sortie (opacity 0, scale 0.85)
4. Réinitialise le DOM (nom, status, input)
5. Résolution du payload :
   - Si nextPromise est disponible → await nextPromise (prefetch)
   - Sinon → await Api.loadPokemon(randomId())
6. Affiche l'image en silhouette (filter: brightness(0))
7. loading = false
8. persist()
9. prefetchNext()                ← lance le chargement du suivant en arrière-plan
10. Focus input (desktop uniquement)
```

### `Game.check()`

Valide la saisie du joueur.

```
1. Guards : if (!current || revealed) return
2. Récupère la valeur de l'input, blur() pour fermer le clavier mobile
3. normalize(guess) === normalize(name.en || name.fr) ?
   ├── OUI → score.correct++, addXP(), Audio.play('correct')
   │         revealPokemon(true), toast, setTimeout(newPokemon, AUTO_NEXT_DELAY)
   └── NON → score.wrong++, Audio.play('wrong'), shake(input), toast
4. updateScore()
```

### `Game.reveal()`

```
if (revealed) → toast "Charge un nouveau"
else → revealPokemon(false), status RÉVÉLÉ, toast
```

### `Game.hint()`

```
if (revealed) → toast "Charge un nouveau"
else → slice(name, 0, HINT_STEPS[hintStep]) + "..."
       hintStep = min(hintStep + 1, maxStep)
       status + toast
```

### `normalize(s)` *(privé)*

Normalise une chaîne pour la comparaison :
1. Lowercase
2. Décomposition Unicode NFD (sépare les diacritiques)
3. Suppression des diacritiques (`\u0300-\u036f`)
4. Suppression de tout sauf `[a-z0-9]`

Exemple : `"Nidoran♀"` → `"nidoran"`, `"Flâmigon"` → `"flamigon"`

### `getNames()` *(privé)*

```js
// Retourne { en: string, fr: string }
// Cherche dans species.names[] par language.name
// Fallback sur data.name (anglais canonique) si la langue n'est pas trouvée
```

### `revealPokemon(correct)` *(privé)*

```
revealed = true
resetImgStyle()              ← retire filter: brightness(0)
screen.classList.add('screen--revealed')
if correct → screen.classList.add('screen--flash')
Affiche le nom dans mini-screen
persist()
```

### `addXP()` *(privé)*

Incrémente `xp`. Si `xp >= LEVEL_THRESHOLD` : reset xp à 0, `level++`, `triggerLevelUp()`.

### `prefetchNext()` *(privé)*

Assigne à `nextPromise` le résultat de `Api.loadPokemon(randomId())`. En cas d'erreur réseau, `nextPromise` est remis à `null` pour forcer un appel fresh dans `newPokemon()`.

---

## 12. Flux de données & cycle de vie

```
DOMContentLoaded
  └─ Game.init()
       ├─ Restauration save → Api.loadPokemon(lastId) ─┐
       └─ Pas de save      → Api.loadPokemon(random)  ─┤
                                                        ▼
                                               current = payload
                                               Image en silhouette
                                               prefetchNext() ←── lance Api.loadPokemon(random) en bg

Joueur tape + Enter / clic Deviner
  └─ check()
       ├─ correct → revealPokemon(true)
       │            addXP() [→ triggerLevelUp() si palier]
       │            setTimeout → newPokemon()
       └─ wrong   → shake, toast

Joueur clique "Nouveau Pokémon"
  └─ newPokemon()
       ├─ nextPromise résolu → await nextPromise (instantané si déjà chargé)
       └─ nextPromise null   → await Api.loadPokemon(random)

Joueur clique "Révéler"
  └─ reveal() → revealPokemon(false)

Joueur clique "Indice"
  └─ hint() → slice(name, HINT_STEPS[hintStep])
```

---

## 13. Structure HTML

Le markup est organisé en **deux panneaux** symétriques séparés par une charnière décorative.

```
<main class="pokedex">
  ├── <section class="pokedex__left">      # Panneau gauche
  │     ├── .pokedex__lens-group           # Lentille bleue + dots colorés
  │     ├── .wtp-logo                      # Logo PNG
  │     └── .screen-wrapper               # Écran principal
  │           └── #screen                 # Silhouette du Pokémon
  │                 ├── .screen__grid     # Grille décorative (pseudo-éléments CSS)
  │                 ├── .screen__corner ×4
  │                 ├── .silhouette-wrap
  │                 │     └── #pokemon-img
  │                 └── #screen-overlay   # "?" visible avant chargement
  │
  ├── <div class="hinge">                 # Charnière décorative
  │
  └── <section class="pokedex__right">   # Panneau droit
        ├── #mini-screen                 # Statut + nom + XP bar + score
        └── .controls
              ├── .input-group           # Label + input texte
              ├── .btn-row               # Deviner / Langue / Mute
              ├── #btn-new               # Nouveau Pokémon
              ├── .hint-row              # Indice / Révéler
              └── .dpad-area             # D-pad + boutons A/B (décoratif)
```

**IDs fonctionnels** (liés dans `Dom.init()`) :

| ID | Rôle |
|---|---|
| `pokemon-img` | Image du Pokémon |
| `screen` | Conteneur écran (reçoit les classes d'état) |
| `status-text` | Ligne de statut dans le mini-écran |
| `pokemon-name` | Nom révélé |
| `score-display` | ✓ N ✗ N |
| `guess-input` | Champ de saisie |
| `input-label` | Label au-dessus de l'input |
| `btn-guess` | Bouton Deviner |
| `btn-new` | Bouton Nouveau |
| `btn-lang` | Bouton FR/EN |
| `btn-mute` | Bouton son |
| `level-display` | Texte LVL X · XP |
| `xp-bar-fill` | Barre XP (width en %) |
| `screen-label` | Label "DISPLAY / AFFICHAGE" |

---

## 14. Architecture CSS

### Variables (`:root`)

Toutes les couleurs, rayons, espacements et durées sont déclarées en custom properties. **Ne jamais écrire de valeur en dur dans les règles.**

| Groupe | Variables |
|---|---|
| Rouge (Pokédex) | `--red-bright`, `--red-mid`, `--red-dark`, `--red-hilight` |
| Écran (vert Game Boy) | `--screen-green`, `--screen-dark`, `--screen-mid`, `--screen-light` |
| Accents | `--blue`, `--blue-bright`, `--dot-green`, `--dot-red`, `--dot-yellow` |
| Typo | `--font-pixel` (Press Start 2P), `--font-ui` (Rajdhani) |
| Layout | `--radius-xl/lg/md/sm`, `--gap-xs/sm/md/lg/xl` |
| Boutons | `--btn-shadow-height` |
| Transitions | `--transition-fast/base/slow`, `--ease-bounce` |

### Classes d'état sur `#screen`

| Classe | Déclencheur | Effet visuel |
|---|---|---|
| `screen--revealed` | `revealPokemon()` | Retire le filtre noir sur l'image, animation `popIn` |
| `screen--flash` | Bonne réponse uniquement | Flash vert bref (`screenFlash`) |
| `screen--exit` | `exitScreen()` | Fade + scale out de l'image (transition 0.25s) |
| `screen--loading` | (non utilisé actuellement) | Animation de scan vertical |

### Boutons — pattern "3D"

Chaque bouton est composé de :
- L'élément `.btn` — couleur de fond sombre (couleur d'ombre), `box-shadow: 0 4px 0 <darker>`
- L'élément `.btn__top` — dégradé lumineux, translate vers le bas de 2px sur `:active` via `transform: translateY(2px)` sur le parent `.btn`

Ce pattern donne l'illusion d'un bouton physique qui s'enfonce.

### Animations CSS clés

| Nom | Durée | Usage |
|---|---|---|
| `floatIn` | 0.8s | Entrée du Pokédex au chargement de la page |
| `popIn` | 0.55s | Révélation du Pokémon (scale + rotate) |
| `screenFlash` | 0.6s | Flash vert sur bonne réponse |
| `shake` | 0.4s | Input sur mauvaise réponse |
| `pulse` | 1.5s ∞ | "?" dans l'overlay |
| `textGlow` | 1s ∞ alt | Nom du Pokémon après révélation correcte |
| `levelFlash` | 0.25s ×6 alt | Clignotement du niveau lors d'un level-up |
| `popupIn` | 0.5s | Entrée de la modal level-up |

---

## 15. Responsive & mobile

Le breakpoint unique est `max-width: 820px`.

### Changements de layout

- **Flex direction** : `row` → `column` (les deux panneaux s'empilent)
- **Hinge** : `display: none` (inutile en colonne)
- **Speaker, D-pad** : masqués
- **Screen label** : masqué
- **Écran principal** : `min-height: 200px`, image limitée à 180px

### Spécificités input mobile

```js
// Dans check() — empêche le clavier de rester ouvert après validation
input.blur();

// Dans newPokemon() — n'ouvre pas le clavier automatiquement sur mobile
if (!('ontouchstart' in window)) Dom.get('guess-input').focus();
```

---

## 16. Persistance de session

À chaque action significative (nouveau Pokémon chargé, bonne/mauvaise réponse, révélation, toggle mute), `persist()` est appelé.

**Restauration au rechargement :**

```
loadSave()
  └─ Si lastPokemonId → Api.loadPokemon(lastPokemonId)
       ├─ Si wasRevealed === true → revealPokemon(false)
       │   (Pokémon affiché en couleur, sans XP bonus)
       └─ Si wasRevealed === false → silhouette noire, prêt à jouer
```

Le score de session (`correct`/`wrong`) est persisté mais sert surtout d'affichage — il n'y a pas de système de leaderboard.

---

## 17. Gestion des erreurs

| Contexte | Comportement |
|---|---|
| `Api.loadPokemon()` échoue | `loading = false`, status → `T[lang].errLabel`, toast d'invitation à réessayer |
| `Storage.load()` JSON corrompu | `catch` silencieux, retourne `null`, partie commence à zéro |
| `Storage.save()` quota dépassé | `catch` + `console.error`, pas de crash |
| `Audio.preload()` fichier inaccessible | `console.warn` par clé, les sons synthétiques continuent de fonctionner |
| `Audio.play()` WebAudio error | `console.warn`, aucun impact sur le jeu |
| `prefetchNext()` échoue | `nextPromise = null`, `newPokemon()` fait un appel fresh en fallback |
| Restauration `lastPokemonId` échoue | `catch {}` → `newPokemon()` (partie normale) |
