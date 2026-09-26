# Prototype 0 — site vitrine

Site vitrine du jeu [Prototype 0](https://github.com/aKoMoses/PROTOTYPE-V0.1), créé par deux frères.

## Structure

- `dist/index.html` : contenu de la page.
- `dist/styles.css` : identité visuelle et adaptation mobile.
- `dist/app.js` : menu, présentation interactive de l’équipement et choix des icônes et sons du blaster.
- `dist/assets/` : captures réelles du jeu, cinq propositions d’icônes et trois sons du blaster.
- `api/choices.js` : enregistrement et lecture des choix dans Upstash Redis.

La présentation reste statique. Une fonction Vercel stocke les choix dans une base Redis liée au projet.

La section « Icônes du blaster » permet de comparer cinq directions graphiques. Le visiteur entre son prénom et enregistre son choix. Il peut le changer ensuite depuis le même navigateur.

La section « Sons du blaster » permet d’écouter trois bruitages MP3 et de choisir un favori. Les choix enregistrés, associés aux prénoms, apparaissent sur la page. Les liens `?style=01` à `?style=05` et `?son=impulsion`, `?son=plasma` ou `?son=charge` présélectionnent toujours une option, sans l’enregistrer automatiquement.

L’API nécessite `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN`, fournis par l’intégration Upstash Redis de Vercel.

## Voir le site en local

Depuis la racine du dépôt :

```sh
python -m http.server 4173 --directory dist
```

Puis ouvrir `http://localhost:4173/`.

## Déploiement

`vercel.json` indique à Vercel de publier directement le dossier `dist`. Aucun build ni variable d’environnement n’est nécessaire.
