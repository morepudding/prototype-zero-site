# Prototype 0 — site vitrine

Site vitrine du jeu [Prototype 0](https://github.com/aKoMoses/PROTOTYPE-V0.1), créé par deux frères.

## Structure

- `dist/index.html` : vitrine du jeu, sans formulaire de vote.
- `dist/choix.html` et `dist/choix.js` : page dédiée aux propositions et aux choix.
- `dist/styles.css` : identité visuelle et adaptation mobile.
- `dist/app.js` : menu et présentation interactive de l’équipement.
- `dist/assets/equipment-icons/` : blaster gravé retenu et deux propositions pour chacun des neuf autres éléments.
- `dist/assets/audio/` : trois sons du blaster.
- `api/choices.js` : enregistrement et lecture des choix dans Upstash Redis.

La présentation reste statique. Une fonction Vercel stocke les choix dans une base Redis liée au projet.

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
