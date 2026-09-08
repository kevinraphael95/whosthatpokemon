# 🔴 Who's That Pokémon? — Pokédex Edition

Un mini-jeu web rétro interactif inspiré de la séquence culte de la série animée Pokémon, conçu sous la forme d'un Pokédex.

🎮 **[Tester le jeu en ligne](https://www.google.com/search?q=https://kevinraphael95.github.io/whosthatpokemon/)**

---

## 🌟 Fonctionnalités

* **Génération aléatoire** : Couvre jusqu'à 1 025 Pokémon via l'API officielle PokéAPI.
* **Système de progression (XP & Levels)** : Gagne de l'expérience à chaque bonne réponse et monte de niveau avec des effets audio et pop-ups dédiés.
* **Multilingue (FR / EN)** : Bascule à tout moment entre les noms de Pokémon en français et en anglais.
* **Aides de jeu** :
* **Indice** : Affiche progressivement les premières lettres du nom.
* **Révéler** : Dévoile immédiatement l'artwork et le nom du Pokémon.


* **Design Pokédex Rétro & Responsive** : Interface soignée intégrant des effets scanlines, CRT et animations CSS, adaptée aussi bien aux écrans PC qu'aux mobiles.
* **Effets sonores générés & Audio Web** : Effets UI et victoires générés dynamiquement avec l'API Web Audio.
* **Sauvegarde automatique** : Ton niveau, ton XP, ton score et la session en cours sont enregistrés dans le `localStorage`.

---

## 🛠️ Technologies utilisées

* **HTML5** : Structure sémantique du Pokédex.
* **CSS3** : Design responsive sans framework (Flexbox, Grid, CSS Variables, Animations)].
* **JavaScript (ES6+)** : Architecture modulaire Vanilla JS sans dépendance externe.
* **[PokéAPI](https://pokeapi.co/)** : Récupération des données et des artworks officiels HD.
* **Web Audio API** : Synthèse sonore interne pour les effets rétro.

---

## 📁 Structure du projet

```text
.
├── index.html            # Structure HTML du Pokédex
├── style.css             # Styles CSS, thèmes et mises en page
├── game.js               # Logique du jeu, appels API, audio et gestion du stockage
├── README.md             # Documentation du projet
├── wtp-logo.png          # Logo principal "Who's That Pokémon"
└── pokemon_wallpaper.jpg # Image de fond d'écran

```

---

## 🚀 Installation & Lancement local

Aucun environnement d'exécution ou compilateur n'est requis.

1. **Cloner le dépôt** :
```bash
git clone https://github.com/kevinraphael95/whosthatpokemon.git

```


2. **Ouvrir le projet** :
Ouvre simplement le fichier `index.html` dans ton navigateur Web préféré.

---

## 🎮 Comment jouer ?

1. Une silhouette de Pokémon s'affiche sur l'écran du Pokédex.
2. Saisis le nom du Pokémon dans le champ texte (en français ou en anglais) et valide avec la touche **Entrée** ou le bouton **Deviner**.
3. Si la réponse est correcte, la silhouette se révèle, tu gagnes de l'XP et un nouveau Pokémon est chargé automatiquement.
4. En cas de doute, utilise les boutons **Indice** ou **Révéler**.
