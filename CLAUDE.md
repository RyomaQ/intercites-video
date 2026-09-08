# CLAUDE.md — Plateforme d'accès en ligne Intercité (version simplifiée)

## Contexte

Intercité est un DVD de 90 minutes de BMX street avec des riders de la scène française. Le DVD est vendu physiquement, mais on veut aussi donner aux acheteurs un accès en ligne au film (téléchargement uniquement, pas de streaming), et permettre en plus une vente 100% numérique (sans DVD physique) via le même système.

## ⚠️ Point à vérifier en priorité (avant de coder la partie paiement)

Il faut confirmer si les commandes passées sur la boutique en ligne SumUp (Online Store, celle qui contient déjà les autres articles physiques) sont récupérables via l'API SumUp — avec l'email du client et le produit acheté. Cette API est bien documentée pour les paiements créés via l'API Checkout (intégration custom), mais rien ne confirme qu'elle couvre aussi les commandes passées via l'Online Store (ça pourrait être un système séparé en coulisses).

**Statut : 🔄 en cours.** Le MCP SumUp est connecté en local (voir section Outils de développement) pour interroger les transactions/checkouts en langage naturel pendant le dev. Le test consistant à passer une vraie commande test sur `intercitesbmx.com` et vérifier si elle apparaît via l'API n'a pas encore été effectué / conclu.

**Comment tester** : ajouter l'article "Film numérique" sur `intercitesbmx.com` (SumUp Online Store), passer une commande test, puis vérifier si elle apparaît via l'API SumUp (Transactions/Checkouts) avec l'email du client et une référence au produit acheté.

- **Si oui** : on garde l'architecture décrite plus bas (redirection vers l'article SumUp existant, récupération via l'API/webhook).
- **Si non** : il faudra construire une page d'achat séparée sur `video.intercitesbmx.com` qui crée elle-même le paiement via l'API Checkout SumUp, pour être certain d'avoir accès aux données de la commande (email notamment).

## Domaines

- **Site principal** (vitrine du film + vente du DVD physique) : `intercitesbmx.com`, actuellement sur SumUp (boutique en ligne).
- **Cette plateforme** (redemption du code + téléchargement) : sous-domaine `video.intercitesbmx.com`, hébergée séparément (Vercel), indépendante du site SumUp.
  - Déploiement Vercel + branchement DNS du sous-domaine : à faire/confirmer (pas de trace de config Vercel dans le repo à date).

## Objectif de la plateforme

1. Un acheteur du DVD physique entre le code imprimé dans la pochette du DVD et télécharge directement le film.
2. Un acheteur qui préfère le numérique clique sur "Acheter", paie sur SumUp, reçoit un code par email, et l'utilise de la même façon que l'acheteur physique.
3. Chaque code ne permet qu'**un seul téléchargement**. Pas de DRM lourd, mais pas un lien partageable à l'infini non plus.

## Page d'accueil (video.intercitesbmx.com)

- La bande-annonce du film joue en fond (autoplay, muet). **Fait** : `src/app/page.tsx` sert actuellement un fichier statique `/trailer.mp4` (dossier `public/`) — distinct du bucket B2 qui contient le film final à télécharger, pas la bande-annonce.
- Un seul champ : **code d'activation**, avec un bouton "Télécharger" pour valider. **Fait.**
- Un bouton **Acheter** pour l'achat numérique direct (redirection SumUp, via `NEXT_PUBLIC_SUMUP_BUY_URL`). **Fait** (l'URL n'est pas encore renseignée dans `.env`).

## Parcours utilisateurs

### A. Acheteur du DVD physique

1. Le DVD est livré avec un code d'activation unique imprimé sur un encart dans le boîtier (un code par DVD produit, généré à l'avance en lot).
2. Sur la page d'accueil, l'utilisateur saisit son code dans le champ prévu.
3. Le backend vérifie que le code existe, n'a pas déjà été utilisé, et qu'il reste au moins un téléchargement disponible.
4. Si valide : le téléchargement se déclenche, et le code est immédiatement marqué comme utilisé.
5. Le code ne fonctionne plus ensuite, pour personne — un seul téléchargement autorisé par code.

**Statut : logique backend faite** (`src/app/api/redeem/route.ts`), validation atomique via `updateMany` conditionné sur `status: "unused"`. Testé isolément (génération du lien B2 signé) mais pas encore de test de bout en bout avec un vrai code + Prisma en conditions réelles.

### B. Acheteur numérique direct (sans DVD)

1. Depuis la page d'accueil, l'utilisateur clique sur "Acheter". On redirige vers l'article SumUp.
2. Une fois le paiement confirmé, on récupère via l'API SumUp le statut et l'email associés à la commande (mécanique exacte — webhook `CHECKOUT_STATUS_CHANGED` + rappel API, ou polling — à confirmer selon le résultat du test ci-dessus).
3. Le backend génère un nouveau code (même système que les codes physiques, juste marqué d'une origine "digital") et l'envoie par email au client.
4. Le client va sur `video.intercitesbmx.com`, entre son code reçu par email — à partir de là, le parcours rejoint celui de l'acheteur physique (étape A.3).

**Statut : ⏳ pas commencé** (bloqué par la vérification Phase 0 ci-dessus).

## Principes de sécurité retenus

- Codes uniques par DVD (10–12 caractères alphanumériques, majuscules, sans caractères ambigus type 0/O ou 1/l). **Fait** : `src/lib/codes.ts`, alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, longueur 12.
- Un code = un seul téléchargement autorisé.

## Stack technique

- **Framework** : Next.js (App Router, Next 16).
- **Base de données** : Supabase (juste une table de codes, usage très léger). Projet Supabase créé et branché (`DATABASE_URL` / `DIRECT_URL` dans `.env`).
  - ⚠️ Le plan gratuit Supabase met le projet en pause après 1 semaine d'inactivité. Ping périodique en place (voir Phase 1 ci-dessous).
- **ORM** : Prisma (v7, avec `@prisma/adapter-pg`). Schéma défini dans `prisma/schema.prisma` ; **première migration pas encore appliquée** (pas de dossier `prisma/migrations` à date — à faire avant tout usage en prod).
- **Paiement** : API SumUp (voir point à vérifier en priorité ci-dessus pour savoir si ça passe par l'Online Store existant ou une intégration Checkout séparée).
- **Vidéo** : Backblaze B2 (stockage, gratuit jusqu'à 10 Go ; pas besoin de Cloudflare devant — à ce volume, le coût d'egress direct de B2 reste négligeable). Bucket privé `intercites-video` créé, clé d'application scopée en place, mécanisme de lien signé (`src/lib/b2.ts`) testé et fonctionnel de bout en bout avec un fichier de test. Le film complet définitif reste à uploader.
- **Email transactionnel** : **Resend** (décidé — envoi du code après achat numérique). Intégration pas encore branchée (`RESEND_API_KEY` vide dans `.env`).
- **Hébergement de l'application** : Vercel (déploiement pas encore confirmé fait).
- **Interface d'administration** : à construire — génération de lots de codes (liés à un batch/référence DVD), consultation des statuts (utilisé/non utilisé), réémission manuelle en cas de demande support, suivi des commandes SumUp.

## Outils de développement

- Le MCP officiel SumUp ([sumup-mcp](https://github.com/sumup/sumup-mcp)) peut être connecté à Claude Code **pendant le développement** — pratique pour interroger son compte SumUp en langage naturel sans quitter l'éditeur. Ce n'est pas un composant de production : l'intégration réelle reste l'API REST SumUp classique (clé API + webhook), décrite plus haut.
  - ⚠️ **Piège rencontré** : la config par défaut (`npx mcp-remote https://mcp.sumup.com/mcp`, serveur hébergé) échoue avec `Incompatible auth server: does not support dynamic client registration` — le serveur d'auth SumUp ne supporte pas l'enregistrement dynamique de client OAuth qu'utilise `mcp-remote` par défaut.
  - **Fix qui marche** : utiliser le mode CLI local du package `@sumup/mcp`, authentifié directement par clé API (pas d'OAuth) :
    ```json
    {
      "mcpServers": {
        "sumup": {
          "command": "npx",
          "args": ["-y", "@sumup/mcp"],
          "env": { "SUMUP_API_KEY": "sup_sk_..." }
        }
      }
    }
    ```
  - Doc : https://developer.sumup.com/tools/llms/mcp-server et https://developer.sumup.com/tools/authorization/api-keys/ (clé générée depuis me.sumup.com → profil → Settings → For Developers → Toolkit → API Keys).

## Modèle de données (implémenté)

Cf. `prisma/schema.prisma` — schéma actuel (affiné par rapport à la version de départ) :

- **Code** : `id`, `codeValue` (unique), `origin` (`physical`/`digital`), `status` (`unused`/`used`), `maxDownloads` (défaut 1), `downloadsUsed`, `batchLabel` (optionnel, référence du lot pour l'export/impression), `redeemedAt`, `createdAt`.
- **Order** (achat numérique uniquement) : `id`, `sumupCheckoutId` (unique), `email`, `status` (`pending`/`paid`/`failed`), `codeId` (relation optionnelle vers `Code`), `createdAt`.

## Étapes de développement

Légende : ✅ fait · 🔄 en cours · ⏳ pas commencé

### Phase 0 — Vérification bloquante
1. 🔄 Tester la récupération des commandes SumUp Online Store via l'API (voir section dédiée plus haut). Ce test conditionne l'architecture du parcours B — à faire avant tout développement de la partie paiement.

### Phase 1 — Fondations
2. 🔄 Initialiser le repo Next.js (App Router) — **fait**. Déployer un premier "hello world" sur Vercel, brancher le sous-domaine `video.intercitesbmx.com` — **à faire/confirmer**.
3. 🔄 Créer le projet Supabase, définir le schéma Prisma (tables `Code` et `Order`) — **fait**. Lancer la première migration — **à faire** (pas de dossier `prisma/migrations` actuellement).
4. ✅ Mettre en place le ping périodique (GitHub Actions en cron) pour éviter la pause du projet Supabase gratuit — `.github/workflows/supabase-ping.yml` + `src/app/api/ping/route.ts`.

### Phase 2 — Parcours DVD physique (le cœur du système)
5. ✅ Script d'admin/CLI pour générer un lot de codes uniques (10–12 caractères, sans caractères ambigus) et les insérer en base — `scripts/generate-codes.ts` (`npm run generate-codes -- --count N --origin physical --batch "..."`).
6. ✅ Page d'accueil : bande-annonce en fond, champ code + bouton "Télécharger" — `src/app/page.tsx`.
7. ✅ Route API de validation de code : vérifie existence, statut "non utilisé", décrémente le compteur de téléchargements de façon atomique — `src/app/api/redeem/route.ts`.
8. ✅ Stockage vidéo sur Backblaze B2 + endpoint de lien signé à courte durée de vie avec `Content-Disposition: attachment` — `src/lib/b2.ts`. Testé de bout en bout avec un fichier de test.
   - ⚠️ **Bug rencontré et corrigé** : le paramètre `b2ContentDisposition` doit être passé à la fois lors de la création du token d'autorisation (`b2_get_download_authorization`) **et** répété en query string sur l'URL de téléchargement finale. Sans ça, B2 renvoie `401 bad_auth_token` (le token signé ne correspond pas à la requête). Le film complet définitif reste à uploader dans le bucket (le fichier actuel est un fichier de test).
9. ⏳ Tester le parcours complet de bout en bout avec un code de test réel : saisie → validation → téléchargement → code marqué comme utilisé → nouvelle tentative refusée (nécessite une migration Prisma appliquée + le serveur Next.js lancé).

### Phase 3 — Achat numérique
10. ⏳ Selon le résultat de la Phase 0 : implémenter soit la récupération via l'Online Store existant, soit une page d'achat séparée avec l'API Checkout SumUp.
11. ⏳ Mettre en place le webhook SumUp (`CHECKOUT_STATUS_CHANGED`) et la vérification du statut de paiement associée.
12. ⏳ Brancher **Resend** : génération d'un nouveau code à la confirmation du paiement, envoi par email avec un gabarit simple.
13. ⏳ Tester le parcours complet : achat test → réception de l'email → code utilisable comme en Phase 2.

### Phase 4 — Interface d'administration
14. ⏳ Écran listant les lots de codes (généré, utilisé/non utilisé, origine physique/digital) et permettant d'exporter un lot en CSV pour l'impression.
15. ⏳ Fonction de réémission manuelle d'un accès (nouveau code) en cas de demande support.
16. ⏳ Vue des commandes SumUp associées (utile pour le support et la comptabilité).

### Phase 5 — Finitions et lancement
17. ⏳ Vérifier les temps de chargement/poids de la page d'accueil (vidéo de bande-annonce compressée correctement).
18. ⏳ Générer le lot définitif de codes pour l'impression des DVD physiques (avec marge pour les exemplaires de test/presse).
19. ⏳ Test de charge léger sur l'endpoint de téléchargement (simuler plusieurs codes utilisés en même temps).
20. ⏳ Mise en production finale sur `video.intercitesbmx.com` et vérification DNS OVH.
