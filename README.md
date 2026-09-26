# Prototype 0 — site vitrine

Site vitrine du jeu [Prototype 0](https://github.com/aKoMoses/PROTOTYPE-V0.1), créé par deux frères.

## Structure

- `dist/index.html` : contenu de la page.
- `dist/styles.css` : identité visuelle et adaptation mobile.
- `dist/app.js` : menu et présentation interactive de l’équipement.
- `dist/assets/` : captures réelles du jeu, issues du dépôt Prototype 0.

Le site est statique. Pour ajouter un jeu, on peut étendre la page ou créer une nouvelle fiche dans ce dépôt. Il n’y a pas encore d’interface d’administration.

## Voir le site en local

Depuis la racine du dépôt :

```sh
python -m http.server 4173 --directory dist
```

Puis ouvrir `http://localhost:4173/`.

## Déploiement

`vercel.json` indique à Vercel de publier directement le dossier `dist`. Aucun build ni variable d’environnement n’est nécessaire.
