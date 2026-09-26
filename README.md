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
- `dist/assets/audio/` : trois sons du blaster.
- `api/choices.js` : enregistrement et lecture des choix dans Upstash Redis.

La présentation reste statique. Une fonction Vercel stocke les choix dans une base Redis liée au projet.

## Publier un push du jeu

Le workflow GitHub du dépôt du jeu publie automatiquement chaque push de `main` dans `/api/game-pushes`. La page `/patchs.html` affiche ces fiches avant les fiches illustrées de `dist/data/patchs.json`. Pour enrichir une fiche avec une capture ou un son, ajouter manuellement une entrée dans ce fichier avec le même SHA ; les médias doivent être copiés dans `dist/assets/`. L’autre contributeur choisit son nom et confirme après son `git pull` ; `api/pulls.js` conserve la date de sa première confirmation pour chaque commit. Cette confirmation est déclarative : le site ne peut pas détecter directement une commande Git exécutée sur un autre ordinateur. L’API utilise les mêmes variables Upstash Redis que `/api/choices`.

La page `/choix.html` présente le blaster en gravure comme référence validée. Elle propose deux variantes dans ce style pour le shotgun, Modulo Drone, Javelin, Magnetic Field, Static Shield, Pyro Boots, Bio Injector, Baroud d’honneur et Omnivamp. Chaque choix peut être enregistré et modifié séparément. Elle regroupe aussi les trois sons du blaster. Les votes sont stockés dans Upstash Redis et la page affiche le décompte A/B par élément.

L’API nécessite `KV_REST_API_URL` et `KV_REST_API_TOKEN`, fournis par l’intégration Upstash Redis de Vercel.

## Voir le site en local

Depuis la racine du dépôt :

```sh
python -m http.server 4173 --directory dist
```

Puis ouvrir `http://localhost:4173/`.

## Déploiement

`vercel.json` indique à Vercel de publier directement le dossier `dist`. Aucun build n’est nécessaire ; l’API de vote requiert les deux variables Upstash ci-dessus.
