# WarLike Tower

Centre d'administration indépendant pour les projets WarLike hébergés sur Cloudflare Pages. Le déploiement ne dépend pas de ChatGPT Sites.

## Fonctions

- Connexion réservée au propriétaire, vérifiée côté serveur auprès de WarLike Server.
- Liste des projets WarLike connus et état du dernier déploiement Cloudflare. Une publication réussie ne prouve pas que l'application fonctionne.
- Relance explicite uniquement du dernier déploiement en échec d'un projet autorisé.
- Secret Cloudflare conservé côté serveur et jamais envoyé au navigateur.

## Mise en service

Le dossier racine est déployé sur Cloudflare Pages. `_worker.js` utilise le mode avancé Pages et `ASSETS`.

1. Déployer et valider la véritable application WarLike Server et ses comptes à `https://warlike-server.pages.dev`. La page de statut actuelle ne fournit pas d'authentification. Mettre à jour les identifiants temporaires dans Server avant la connexion à Tower.
2. Dans les paramètres Pages du projet Tower, définir le secret `CLOUDFLARE_API_TOKEN` avec un jeton limité au compte Cloudflare concerné et aux permissions Pages nécessaires pour lire les projets et relancer un déploiement. Redéployer après changement du secret. Sans jeton, les états restent indiqués comme non connectés.
3. Vérifier la connexion du propriétaire, le refus d'un compte standard et l'affichage des états réels. Ne jamais committer le jeton.

Les applications Server et Mail nécessitent leur propre migration et leur validation sur Cloudflare ; Tower ne les remplace pas.
