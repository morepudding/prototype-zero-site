# Prototype 0 — site vitrine

Site vitrine du jeu [Prototype 0](https://github.com/aKoMoses/PROTOTYPE-V0.1), créé par deux frères.

## Structure

- `dist/index.html` : vitrine du jeu, sans formulaire de vote.
- `dist/choix.html` et `dist/choix.js` : page dédiée aux propositions et aux choix.
- `dist/patchs.html` et `dist/patchs.js` : suivi des pushes du jeu et confirmation des pulls.
- `dist/data/patchs.json` : fiches illustrées des deux premiers pushes ; les nouveaux pushes sont ajoutés automatiquement dans Redis par le workflow du jeu.
- `api/game-pushes.js` : réception et lecture des nouveaux pushes du jeu.
- `api/pulls.js` : date de la première confirmation de récupération par l’autre contributeur, enregistrée dans Upstash Redis.
- `dist/styles.css` : identité visuelle et adaptation mobile.
- `dist/app.js` : menu et présentation interactive de l’équipement.
- `dist/assets/equipment-icons/` : blaster gravé retenu et deux propositions pour chacun des neuf autres éléments.
- `dist/assets/audio/` : trois sons du blaster et les variantes A/B des dix-huit effets du jeu dans `game-sfx/`.
- `api/choices.js` : enregistrement et lecture des choix dans Upstash Redis.

La présentation reste statique. Une fonction Vercel stocke les choix dans une base Redis liée au projet.

## Publier un push du jeu

Le workflow GitHub du dépôt du jeu publie automatiquement chaque push de `main` dans `/api/game-pushes`. La page `/patchs.html` affiche ces fiches avant les fiches illustrées de `dist/data/patchs.json`. Pour enrichir une fiche avec une capture ou un son, ajouter manuellement une entrée dans ce fichier avec le même SHA ; les médias doivent être copiés dans `dist/assets/`. L’autre contributeur choisit son nom et confirme après son `git pull` ; `api/pulls.js` conserve la date de sa première confirmation pour chaque commit. Cette confirmation est déclarative : le site ne peut pas détecter directement une commande Git exécutée sur un autre ordinateur. L’API utilise les mêmes variables Upstash Redis que `/api/choices`.

La page `/choix.html` présente les neuf nouveaux choix de sons en premier : pas, entrée/sortie et mouvement dans les buissons, tir ennemi, contact ennemi, avertissement de charge, vie faible et Baroud. Une section « Archives », repliée par défaut, conserve les neuf choix d’icônes, le choix du son du Blaster et les neuf effets sonores précédents, dont les impacts et dégâts reçus. Les propositions restent consultables et les votes existants sont conservés dans Upstash Redis. Les décomptes des nouveaux choix et des archives sont affichés séparément. Un lien direct vers une ancienne proposition ouvre automatiquement les archives.

L’API nécessite `KV_REST_API_URL` et `KV_REST_API_TOKEN`, fournis par l’intégration Upstash Redis de Vercel.

Chaque effet a deux lecteurs A/B et un vote indépendant. Pour les pas, chaque lecteur présente quatre variations distinctes d’une même direction sonore ; les autres actions restent séparées. Le mouvement dans les buissons est présenté sur deux cycles de texture. Ces propositions attendent un choix à l’écoute et ne prouvent pas une intégration dans le jeu.

Dans `dist/choix.js`, le champ `archived: true` place un effet sonore dans les archives ; les autres apparaissent dans les propositions en cours.

## Voir le site en local

Depuis la racine du dépôt :

```sh
python -m http.server 4173 --directory dist
```

Puis ouvrir `http://localhost:4173/`.

## Déploiement

`vercel.json` indique à Vercel de publier directement le dossier `dist`. Aucun build n’est nécessaire ; l’API de vote requiert les deux variables Upstash ci-dessus.
