# Notifications Discord

## Répartition du travail

Le salon `#repartition-du-travail` de Studio JV reçoit les secteurs attribués à **Akomoses** et **morepudding**, puis le nombre de secteurs encore à attribuer. Il utilise un webhook séparé (`SECTORS_DISCORD_WEBHOOK_URL` sur Vercel) et le secret de notification existant. Le workflow `daily-sectors.yml` passe chaque jour à 9 h 07 puis 9 h 37, heure de Paris ; le second passage ne publie rien si le premier a réussi. Un verrou protège les envois simultanés, et la dernière date d’envoi est enregistrée dans Redis. La page affiche le dernier envoi confirmé. Le workflow peut être lancé manuellement pour vérifier la livraison, une fois par date parisienne. Les secteurs sont des responsabilités, pas des tâches actives.

## Annonces existantes

Le salon Discord reçoit trois types d'annonces : les pushes sur `main` du dépôt du jeu, les nouveaux fichiers de vote du site et un récapitulatif des votes toutes les 30 minutes s'il y a des changements.

## Configuration

1. Créer un webhook dans le salon Discord et conserver son URL comme secret.
2. Dans le projet Vercel `prototype-zero-site`, définir `DISCORD_WEBHOOK_URL` et `NOTIFICATION_CRON_SECRET` pour Production. Garder les variables Redis existantes.
3. Dans les secrets GitHub du dépôt `morepudding/prototype-zero-site`, définir `DISCORD_WEBHOOK_URL` et `NOTIFICATION_CRON_SECRET` avec les mêmes valeurs que sur Vercel.
4. Dans Vercel et dans les secrets GitHub du dépôt `aKoMoses/PROTOTYPE-V0.1`, définir le même `GAME_PUSH_SECRET`. Ajouter aussi `DISCORD_WEBHOOK_URL` dans ce dépôt.

Le workflow du site appelle `POST /api/notify-votes` à 7 et 37 minutes de chaque heure. L'en-tête `Authorization: Bearer <NOTIFICATION_CRON_SECRET>` protège cet endpoint. Le planificateur GitHub peut être retardé ; le prochain passage reprend les votes en attente. Le workflow peut aussi être lancé manuellement dans GitHub Actions.

## Fonctionnement

Les votes modifiés sont ajoutés à une file Redis. Le récapitulatif regroupe les votes successifs d'une même personne sur un même élément. Une sélection répétée sans changement n'est pas annoncée. La file n'est vidée qu'après confirmation de Discord ; en cas d'échec, le prochain passage réessaie. Un verrou évite deux envois simultanés. Une interruption après l'envoi mais avant la suppression de la file peut exceptionnellement produire un doublon.

Le workflow du site annonce les icônes `dist/assets/equipment-icons/*-a.png` et `*-b.png`, ainsi que les sons `dist/assets/audio/*.mp3`, quand ils sont ajoutés ou modifiés sur `main`. Le workflow du jeu crée automatiquement une fiche sur `/patchs.html` et annonce le push en trois phrases avec un lien direct vers la confirmation du pull. Le résumé est construit à partir des titres de commits et des zones de fichiers modifiées.

Les noms de vote proviennent du formulaire public, et l'identifiant de vote est stocké dans chaque navigateur. Le récapitulatif ne garantit donc pas l'identité de la personne ; il indique le nom saisi et ne révèle pas ses choix A/B.
