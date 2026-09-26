# Prototype 0 — site vitrine

Site vitrine du jeu [Prototype 0](https://github.com/aKoMoses/PROTOTYPE-V0.1), créé par deux frères.

## Structure

- `dist/index.html` : contenu de la page.
- `dist/styles.css` : identité visuelle et adaptation mobile.
- `dist/app.js` : menu, présentation interactive de l’équipement et choix des icônes et sons du blaster.
- `dist/assets/` : captures réelles du jeu, cinq propositions d’icônes et trois sons du blaster.

Le site est statique. Pour ajouter un jeu, on peut étendre la page ou créer une nouvelle fiche dans ce dépôt. Il n’y a pas encore d’interface d’administration.

La section « Icônes du blaster » permet de comparer cinq directions graphiques. Le choix est mémorisé dans le navigateur et le bouton « Valider et partager » prépare un lien contenant `?style=01` à `?style=05`. Le site ne centralise pas les votes : il faut transmettre ce lien ou le message partagé aux créateurs du jeu.

La section « Sons du blaster » permet d’écouter trois bruitages MP3 et de choisir un favori. Elle utilise le même principe de partage, avec `?son=impulsion`, `?son=plasma` ou `?son=charge`. Le lien reçu présélectionne le choix sur le site.

## Voir le site en local

Depuis la racine du dépôt :

```sh
python -m http.server 4173 --directory dist
```

Puis ouvrir `http://localhost:4173/`.

## Déploiement

`vercel.json` indique à Vercel de publier directement le dossier `dist`. Aucun build ni variable d’environnement n’est nécessaire.
