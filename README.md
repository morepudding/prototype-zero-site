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

## Répartition des secteurs

`dist/repartition.html` présente les responsabilités habituelles de **Akomoses** et **morepudding**. Les 20 secteurs recensés dans le jeu sont initialisés sans responsable dans « À attribuer ». L’édition permet de créer, renommer, décrire, attribuer, désattribuer et archiver/restaurer les secteurs. Les archives sont réversibles. Cette première version ne contient ni tâches ni dépendances ; une responsabilité n’est pas présentée comme un travail en cours.

`api/sectors.js` stocke les secteurs dans un hash Redis distinct des votes et des pushes. L’initialisation est atomique et ne remplace jamais une répartition existante. Chaque modification vérifie la version de la fiche pour éviter d’écraser une modification concurrente. La recherche porte sur tous les secteurs visibles. Les modifications nécessitent `SECTORS_EDIT_CODE`, un code partagé conservé uniquement côté serveur ; le déverrouillage crée une session signée de 8 heures dans un cookie HttpOnly. Le code n’est pas conservé dans le navigateur. Les tentatives sont limitées à huit par quart d’heure et par adresse IP. Sans code configuré, le tableau reste en lecture seule.

La valeur d’attribution `both` affiche une seule fiche partagée dans les deux colonnes. Toute modification ou archive de cette fiche est répercutée des deux côtés. `dist/data/repartition-proposee.json` documente la première proposition tirée des 118 commits du jeu au 29 septembre 2026, avec une justification et des liens vers les commits par secteur. Ce fichier ne réapplique jamais ses suggestions automatiquement : les attributions modifiées sur le site restent dans Redis.

`api/notify-sectors.js` publie la répartition dans le salon associé à `SECTORS_DISCORD_WEBHOOK_URL`. Le workflow `daily-sectors.yml` passe à **9 h 07, Europe/Paris**, puis à 9 h 37 pour reprendre un éventuel échec. Redis limite l’envoi à un récapitulatif par date parisienne. Le message est publié même si la répartition n’a pas changé et comprend les attributions individuelles, les secteurs en commun (une seule fois) et le nombre de secteurs non attribués. Les vingt secteurs initiaux tiennent dans un message complet ; les tableaux plus grands sont résumés avec un lien. Les archives sont exclues. Il utilise le `NOTIFICATION_CRON_SECRET` existant. GitHub peut retarder les exécutions et désactive les workflows planifiés d’un dépôt public après 60 jours sans activité ; vérifier les exécutions dans Actions si le projet reste longtemps inactif. Une interruption après la confirmation Discord et avant l’enregistrement Redis peut exceptionnellement produire un doublon.

Les tests se lancent avec `npm test`.

## Voir le site en local

Depuis la racine du dépôt :

```sh
python -m http.server 4173 --directory dist
```

Puis ouvrir `http://localhost:4173/`.

## Déploiement

`vercel.json` indique à Vercel de publier directement le dossier `dist`. Aucun build n’est nécessaire ; l’API de vote requiert les deux variables Upstash ci-dessus.
