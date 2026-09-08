# CLAUDE.md — Plateforme d'accès en ligne Intercité (version simplifiée)

## Contexte

Intercité est un DVD de 90 minutes de BMX street avec des riders de la scène française. Le DVD est vendu physiquement, mais on veut aussi donner aux acheteurs un accès en ligne au film (téléchargement uniquement, pas de streaming), et permettre en plus une vente 100% numérique (sans DVD physique) via le même système.

## ⚠️ Point vérifié (architecture du parcours numérique)

Question initiale : les commandes passées sur la boutique en ligne SumUp (Online Store) sont-elles récupérables via l'API SumUp avec l'email du client et le produit acheté ?

**Statut : ✅ tranché — option "page d'achat séparée".** Plutôt que de dépendre de l'Online Store existant, le parcours numérique a été implémenté comme une page d'achat séparée sur `video.intercitesbmx.com` qui crée elle-même le paiement via l'API Checkout SumUp (`src/lib/sumup.ts`, `createHostedCheckout`). Ça garantit un accès direct à l'email et à la commande sans dépendre du comportement de l'Online Store.

- ⚠️ Cette page reste à tester de bout en bout en conditions réelles (voir Phase 3 ci-dessous) — le code existe mais n'a pas encore été validé par un vrai paiement test.
- ⚠️ Le "webhook" actuel n'en est pas vraiment un : `return_url` pointe vers `/api/checkout/webhook`, mais c'est le **navigateur du client** qui y est redirigé après paiement (pas un appel serveur-à-serveur SumUp). Si le client ferme l'onglet avant la redirection, le code ne sera jamais généré ni envoyé. Un vrai webhook `CHECKOUT_STATUS_CHANGED` serait plus robuste (cf. Phase 3, point 11).

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
- Un bouton **Acheter** pour l'achat numérique direct. **Fait** : affiche un champ email inline, puis `POST /api/checkout` crée un checkout SumUp (API Checkout, `hosted_checkout`) et redirige vers la page de paiement hébergée SumUp — `src/app/page.tsx`, `src/app/api/checkout/route.ts`.
  - Prix piloté par `NEXT_PUBLIC_DIGITAL_PRICE_EUR` (`.env`) — **actuellement à `0.10` pour test** (SumUp rejette `amount: 0` avec une erreur de validation), à remettre au prix réel avant mise en prod.

## Parcours utilisateurs

### A. Acheteur du DVD physique

1. Le DVD est livré avec un code d'activation unique imprimé sur un encart dans le boîtier (un code par DVD produit, généré à l'avance en lot).
2. Sur la page d'accueil, l'utilisateur saisit son code dans le champ prévu.
3. Le backend vérifie que le code existe, n'a pas déjà été utilisé, et qu'il reste au moins un téléchargement disponible.
4. Si valide : le téléchargement se déclenche, et le code est immédiatement marqué comme utilisé.
5. Le code ne fonctionne plus ensuite, pour personne — un seul téléchargement autorisé par code.

**Statut : logique backend faite** (`src/app/api/redeem/route.ts`), validation atomique via `updateMany` conditionné sur `status: "unused"`. Testé isolément (génération du lien B2 signé) mais pas encore de test de bout en bout avec un vrai code + Prisma en conditions réelles.

### B. Acheteur numérique direct (sans DVD)

1. Depuis la page d'accueil, l'utilisateur clique sur "Acheter", saisit son email, et est redirigé vers la page de paiement hébergée SumUp (checkout créé via `POST /api/checkout`, qui enregistre une `Order` en `pending`).
2. Une fois le paiement effectué, SumUp redirige le navigateur du client vers `return_url` (`/api/checkout/webhook`). Cette route ne fait pas confiance au corps reçu : elle relit le statut réel via `GET /v0.1/checkouts/:id`.
3. Si `PAID` : le backend marque l'`Order` `paid` (de façon atomique, pour éviter une double génération en cas de retry), génère un nouveau code (même système que les codes physiques, origine `digital`), le lie à la commande, et l'envoie par email via Resend.
4. Le client va sur `video.intercitesbmx.com`, entre son code reçu par email — à partir de là, le parcours rejoint celui de l'acheteur physique (étape A.3).

**Statut : 🔄 codé, pas encore testé de bout en bout.** `src/app/api/checkout/route.ts`, `src/app/api/checkout/webhook/route.ts`, `src/lib/sumup.ts`, `src/lib/email.ts`. Clés `SUMUP_API_KEY`, `SUMUP_MERCHANT_CODE`, `SITE_URL`, `RESEND_API_KEY`, `EMAIL_FROM` renseignées dans `.env`. Prix mis à `0.10` temporairement pour permettre un achat test à coût minime (SumUp rejette `amount: 0`). Reste à valider : un vrai paiement test de bout en bout (checkout → redirection → code généré → email reçu → code utilisable), et la fiabilité du `return_url`-comme-webhook (cf. point d'architecture plus haut).

## Principes de sécurité retenus

- Codes uniques par DVD (10–12 caractères alphanumériques, majuscules, sans caractères ambigus type 0/O ou 1/l). **Fait** : `src/lib/codes.ts`, alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, longueur 12.
- Un code = un seul téléchargement autorisé.

## Stack technique

- **Framework** : Next.js (App Router, Next 16).
- **Base de données** : Supabase (juste une table de codes, usage très léger). Projet Supabase créé et branché (`DATABASE_URL` / `DIRECT_URL` dans `.env`).
  - ⚠️ Le plan gratuit Supabase met le projet en pause après 1 semaine d'inactivité. Ping périodique en place (voir Phase 1 ci-dessous).
- **ORM** : Prisma (v7, avec `@prisma/adapter-pg`). Schéma défini dans `prisma/schema.prisma` ; **première migration pas encore appliquée** (pas de dossier `prisma/migrations` à date — à faire avant tout usage en prod).
- **Paiement** : API SumUp — API Checkout (intégration custom, pas l'Online Store), `src/lib/sumup.ts`. Voir point d'architecture ci-dessus.
- **Vidéo** : Backblaze B2 (stockage, gratuit jusqu'à 10 Go ; pas besoin de Cloudflare devant — à ce volume, le coût d'egress direct de B2 reste négligeable). Bucket privé `intercites-video` créé, clé d'application scopée en place, mécanisme de lien signé (`src/lib/b2.ts`) testé et fonctionnel de bout en bout avec un fichier de test. Le film complet définitif reste à uploader.
- **Email transactionnel** : **Resend** — envoi du code après achat numérique. Intégration branchée (`src/lib/email.ts`, `sendCodeEmail`), `RESEND_API_KEY` / `EMAIL_FROM` renseignés dans `.env`. Reste à valider par un envoi réel.
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
1. ✅ Décision d'architecture prise : page d'achat séparée + API Checkout SumUp (voir section dédiée plus haut), plutôt que dépendre de l'Online Store.

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
10. ✅ Page d'achat séparée avec l'API Checkout SumUp — `src/app/api/checkout/route.ts`, `src/lib/sumup.ts`.
11. 🔄 Vérification du statut de paiement en place via `return_url` (`/api/checkout/webhook`, relit toujours le statut via l'API avant d'agir) — mais ce n'est pas un vrai webhook serveur-à-serveur `CHECKOUT_STATUS_CHANGED` : si le client ferme l'onglet avant la redirection, rien ne se déclenche. À durcir avant la mise en prod.
12. ✅ Resend branché : génération d'un nouveau code à la confirmation du paiement, envoi par email — `src/lib/email.ts`.
13. ⏳ Tester le parcours complet : achat test (prix à `0` actuellement pour ça) → réception de l'email → code utilisable comme en Phase 2. Pas encore fait.

### Phase 4 — Interface d'administration
14. ⏳ Écran listant les lots de codes (généré, utilisé/non utilisé, origine physique/digital) et permettant d'exporter un lot en CSV pour l'impression.
15. ⏳ Fonction de réémission manuelle d'un accès (nouveau code) en cas de demande support.
16. ⏳ Vue des commandes SumUp associées (utile pour le support et la comptabilité).

### Phase 5 — Finitions et lancement
17. ⏳ Vérifier les temps de chargement/poids de la page d'accueil (vidéo de bande-annonce compressée correctement).
18. ⏳ Générer le lot définitif de codes pour l'impression des DVD physiques (avec marge pour les exemplaires de test/presse).
19. ⏳ Test de charge léger sur l'endpoint de téléchargement (simuler plusieurs codes utilisés en même temps).
20. ⏳ Mise en production finale sur `video.intercitesbmx.com` et vérification DNS OVH.
