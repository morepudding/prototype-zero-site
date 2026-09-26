# Prototype 0 — site vitrine

Site vitrine du jeu [Prototype 0](https://github.com/aKoMoses/PROTOTYPE-V0.1), créé par deux frères.

## Structure

- `dist/index.html` : vitrine du jeu, sans formulaire de vote.
- `dist/choix.html` et `dist/choix.js` : page dédiée aux propositions et aux choix.
- `dist/patchs.html` et `dist/patchs.js` : suivi des pushes du jeu et confirmation des pulls.
- `dist/data/patchs.json` : document lu par cette page ; les deux entrées actuelles correspondent aux commits `46fca8d` et `b354eb9` du dépôt du jeu.
- `api/pulls.js` : date de la première confirmation de récupération par l’autre contributeur, enregistrée dans Upstash Redis.
- `dist/styles.css` : identité visuelle et adaptation mobile.
- `dist/app.js` : menu et présentation interactive de l’équipement.
- `dist/assets/equipment-icons/` : blaster gravé retenu et deux propositions pour chacun des neuf autres éléments.
- `dist/assets/audio/` : trois sons du blaster.
- `api/choices.js` : enregistrement et lecture des choix dans Upstash Redis.

La présentation reste statique. Une fonction Vercel stocke les choix dans une base Redis liée au projet.

## Publier un push du jeu

Après chaque push sur la branche `main` du **jeu**, ajouter en tête de `dist/data/patchs.json` une entrée décrivant le commit, puis publier le site. Renseigner le SHA complet dans `commit`, le nom du contributeur dans `author`, `date` au format `AAAA-MM-JJ`, `title`, `summary`, `changes`, `image`, `imageAlt` et le lien du commit dans `source`. Les champs `toTry`, `imageStyle` (`icon` pour une icône) et `audio` sont facultatifs. Les chemins des médias sont relatifs à `dist/` ; copier les nouveaux médias dans `dist/assets/` avant publication. La page `/patchs.html` lit ce document à chaque chargement. L’autre contributeur choisit son nom et confirme après son `git pull` ; `api/pulls.js` conserve la date de sa première confirmation pour chaque commit. Cette confirmation est déclarative : le site ne peut pas détecter directement une commande Git exécutée sur un autre ordinateur. L’API utilise les mêmes variables Upstash Redis que `/api/choices`.

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
