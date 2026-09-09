# CLAUDE.md — Plateforme d'accès en ligne Intercité (version simplifiée)

## Contexte

Intercité est un DVD de 90 minutes de BMX street avec des riders de la scène française. Le DVD est vendu physiquement, mais on veut aussi donner aux acheteurs un accès en ligne au film (téléchargement uniquement, pas de streaming), et permettre en plus une vente 100% numérique (sans DVD physique) via le même système.

## ⚠️ Point vérifié (architecture du parcours numérique)

Question initiale : les commandes passées sur la boutique en ligne SumUp (Online Store) sont-elles récupérables via l'API SumUp avec l'email du client et le produit acheté ?

**Statut : ✅ tranché — option "page d'achat séparée".** Plutôt que de dépendre de l'Online Store existant, le parcours numérique a été implémenté comme une page d'achat séparée sur `video.intercitesbmx.com` qui crée elle-même le paiement via l'API Checkout SumUp (`src/lib/sumup.ts`, `createHostedCheckout`). Ça garantit un accès direct à l'email et à la commande sans dépendre du comportement de l'Online Store.

- ✅ Un vrai paiement test (2€) a été effectué de bout en bout sur `checkout.sumup.com` et confirmé "Paiement réussi" côté SumUp.
  - ⚠️ **Piège rencontré** : à 0,10€ (montant de test initial), la carte était systématiquement refusée — pas un bug de code/API, mais la banque qui flague les micro-transactions comme suspectes (pattern classique de test de carte volée). Passer à un montant plus réaliste (2€ pour les tests, prix réel avant lancement) a résolu le problème.
- ✅ **Corrigé** : après paiement, le client restait bloqué sur l'écran de confirmation SumUp au lieu d'être ramené sur notre site. Cause : le code n'envoyait que `return_url` (callback backend, censé être serveur-à-serveur d'après la doc SumUp) sans jamais renseigner `redirect_url` (le champ dédié à la redirection du navigateur du client après paiement). `redirect_url` est maintenant envoyé (`src/lib/sumup.ts`, `src/app/api/checkout/route.ts`) et pointe vers `/thank-you`, une page de confirmation sur notre domaine avec un champ code intégré pour télécharger directement.
  - ⚠️ Ce fix n'a pas encore été revalidé par un nouveau paiement test de bout en bout (le paiement 2€ ci-dessus a eu lieu avant ce correctif) — reste à confirmer que la redirection vers `/thank-you` fonctionne bien en conditions réelles.
- ⚠️ `return_url` (`/api/checkout/webhook`) reste un callback dont le déclenchement exact par SumUp (serveur-à-serveur vs autre) n'est pas confirmé en pratique — la route ne fait toujours pas confiance au corps reçu et relit systématiquement le statut via l'API. Un vrai webhook `CHECKOUT_STATUS_CHANGED` resterait plus robuste si le client ferme l'onglet avant toute redirection (cf. Phase 3, point 11).

## Domaines

- **Site principal** (vitrine du film + vente du DVD physique) : `intercitesbmx.com`, actuellement sur SumUp (boutique en ligne).
- **Cette plateforme** (redemption du code + téléchargement) : sous-domaine `video.intercitesbmx.com`, hébergée séparément (Vercel), indépendante du site SumUp.
  - 🔄 CNAME DNS `video` → `vercel-dns` confirmé en place côté OVH. Déploiement Vercel effectif (build + accès réel à `video.intercitesbmx.com`) pas revérifié dans cette session — à confirmer.
  - ⚠️ Les variables d'environnement doivent être renseignées séparément sur Vercel (Project Settings → Environment Variables) — `.env` en local n'est jamais lu en prod. Notamment `R2_*` (remplace les anciennes `B2_*`, à supprimer de Vercel) et `SITE_URL` (doit être `https://video.intercitesbmx.com`, pas `localhost`).

## Objectif de la plateforme

1. Un acheteur du DVD physique entre le code imprimé dans la pochette du DVD et télécharge directement le film.
2. Un acheteur qui préfère le numérique clique sur "Acheter", paie sur SumUp, reçoit un code par email, et l'utilise de la même façon que l'acheteur physique.
3. Chaque code ne permet qu'**un seul téléchargement**. Pas de DRM lourd, mais pas un lien partageable à l'infini non plus.

## Page d'accueil (video.intercitesbmx.com)

- La bande-annonce du film joue en fond (autoplay, muet). **Fait** : `src/app/page.tsx` récupère une URL signée via `GET /api/trailer` (stockage R2, voir Stack technique) et l'injecte dans un `<video>`. Deux variantes servies via `<source>` + media query : format 16:9 (`R2_TRAILER_FILE_NAME`) sur desktop, 9:16 (`R2_TRAILER_MOBILE_FILE_NAME`) sur écrans ≤ 767px.
  - ⚠️ **Bug rencontré et corrigé** : la première version de la bande-annonce était encodée en HEVC (H.265) 10-bit, non lue de façon fiable par Safari sur iPhone (échec silencieux, pas d'erreur — juste rien qui s'affiche). Ré-exportée en H.264 8-bit standard (`yuv420p`, profil High) → compatible partout.
  - Titre "Intercités" en `h1` avec une police custom (Gliker, `src/fonts/gliker-regular.ttf`, chargée via `next/font/local`) à la place du logo image.
- Un seul champ : **code d'activation**, avec un bouton "Télécharger" pour valider. **Fait.**
- Un bouton **Acheter** pour l'achat numérique direct. **Fait** : affiche un champ email inline, puis `POST /api/checkout` crée un checkout SumUp (API Checkout, `hosted_checkout`) et redirige vers la page de paiement hébergée SumUp — `src/app/page.tsx`, `src/app/api/checkout/route.ts`.
  - Prix piloté par `NEXT_PUBLIC_DIGITAL_PRICE_EUR` (`.env`) — **actuellement à `2` pour test**, à remettre au prix réel avant mise en prod. (Éviter les montants proches de 0 : les banques flaguent souvent les micro-transactions comme suspectes et refusent la carte, indépendamment de toute config SumUp.)
- Page `/thank-you` (nouvelle) : destination après paiement réussi (`redirect_url` du checkout SumUp). Affiche un message de confirmation (invite à vérifier les spams/indésirables) et un champ code intégré pour télécharger directement sans repasser par la page d'accueil.

## Parcours utilisateurs

### A. Acheteur du DVD physique

1. Le DVD est livré avec un code d'activation unique imprimé sur un encart dans le boîtier (un code par DVD produit, généré à l'avance en lot).
2. Sur la page d'accueil, l'utilisateur saisit son code dans le champ prévu.
3. Le backend vérifie que le code existe, n'a pas déjà été utilisé, et qu'il reste au moins un téléchargement disponible.
4. Si valide : le téléchargement se déclenche, et le code est immédiatement marqué comme utilisé.
5. Le code ne fonctionne plus ensuite, pour personne — un seul téléchargement autorisé par code.

**Statut : logique backend faite** (`src/app/api/redeem/route.ts`), validation atomique via `updateMany` conditionné sur `status: "unused"`. Génération de lien signé testée isolément (R2, voir Stack technique) mais pas encore de test de bout en bout avec un vrai code + Prisma en conditions réelles.

### B. Acheteur numérique direct (sans DVD)

1. Depuis la page d'accueil, l'utilisateur clique sur "Acheter", saisit son email, et est redirigé vers la page de paiement hébergée SumUp (checkout créé via `POST /api/checkout`, qui enregistre une `Order` en `pending`).
2. Une fois le paiement effectué, SumUp redirige le navigateur du client vers `redirect_url` (`/thank-you`), pendant que `return_url` (`/api/checkout/webhook`) sert de callback backend. Cette route ne fait pas confiance au corps reçu : elle relit le statut réel via `GET /v0.1/checkouts/:id`.
3. Si `PAID` : le backend marque l'`Order` `paid` (de façon atomique, pour éviter une double génération en cas de retry), génère un nouveau code (même système que les codes physiques, origine `digital`), le lie à la commande, et l'envoie par email via Resend.
4. Sur `/thank-you`, le client peut entrer directement son code reçu par email dans le champ intégré — à partir de là, le parcours rejoint celui de l'acheteur physique (étape A.3).

**Statut : 🔄 le paiement fonctionne (testé à 2€, "Paiement réussi" confirmé côté SumUp), l'email est envoyé et reçu (Resend, domaine vérifié DKIM/SPF/DMARC), mais le nouveau parcours de redirection (`redirect_url` → `/thank-you`) n'a pas encore été revalidé par un paiement test complet.** `src/app/api/checkout/route.ts`, `src/app/api/checkout/webhook/route.ts`, `src/app/thank-you/page.tsx`, `src/lib/sumup.ts`, `src/lib/email.ts`. Clés `SUMUP_API_KEY`, `SUMUP_MERCHANT_CODE`, `SITE_URL`, `RESEND_API_KEY`, `EMAIL_FROM` renseignées dans `.env`. Reste à valider : un paiement test de bout en bout après le fix `redirect_url` (checkout → paiement → atterrissage sur `/thank-you` → code déjà en main via email → téléchargement).

## Principes de sécurité retenus

- Codes uniques par DVD (10–12 caractères alphanumériques, majuscules, sans caractères ambigus type 0/O ou 1/l). **Fait** : `src/lib/codes.ts`, alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, longueur 12.
- Un code = un seul téléchargement autorisé.

## Stack technique

- **Framework** : Next.js (App Router, Next 16).
- **Base de données** : Supabase (juste une table de codes, usage très léger). Projet Supabase créé et branché (`DATABASE_URL` / `DIRECT_URL` dans `.env`).
  - ⚠️ Le plan gratuit Supabase met le projet en pause après 1 semaine d'inactivité. Ping périodique en place (voir Phase 1 ci-dessous).
- **ORM** : Prisma (v7, avec `@prisma/adapter-pg`). Schéma défini dans `prisma/schema.prisma` ; **première migration pas encore appliquée** (pas de dossier `prisma/migrations` à date — à faire avant tout usage en prod).
- **Paiement** : API SumUp — API Checkout (intégration custom, pas l'Online Store), `src/lib/sumup.ts`. Voir point d'architecture ci-dessus.
- **Vidéo** : Cloudflare R2 (stockage S3-compatible, egress **gratuit et illimité** — sans ça, remplace Backblaze B2 initialement utilisé). Bucket privé `intercites-bmx`, credentials S3 (Account API Token R2, permission "Object Read & Write", restreint à ce bucket) dans `.env` (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`). Liens signés via `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (`src/lib/r2.ts`), même surface d'API que l'ancien `b2.ts` (download signé avec `Content-Disposition: attachment`, lien de lecture pour les bandes-annonces desktop/mobile). Testé de bout en bout (liste des fichiers + requête Range sur lien signé).
  - **Pourquoi la migration depuis B2** : le plan gratuit B2 impose un cap de bande passante de téléchargement journalier (par défaut 1 Go/jour) qui a été dépassé pendant les tests, bloquant la bande-annonce ET le téléchargement du film (`download_cap_exceeded`). R2 n'a pas cet équivalent — le stockage (10 Go gratuits/mois) et les opérations (1M Class A + 10M Class B gratuites/mois) couvrent largement ce projet, et l'egress reste gratuit à tout volume.
  - Le film complet définitif reste à uploader (le fichier actuel, `R2_FILE_NAME`, est toujours un placeholder de test).
- **Email transactionnel** : **Resend** — envoi du code après achat numérique. Intégration branchée (`src/lib/email.ts`, `sendCodeEmail`), `RESEND_API_KEY` / `EMAIL_FROM` renseignés dans `.env`. ✅ Validé par plusieurs envois réels. Domaine `intercitesbmx.com` vérifié sur Resend (DKIM `resend._domainkey`, SPF via CNAME `send`/`rsend`, DMARC `p=none` en mode surveillance). Template HTML + texte brut, avec la ligne "This code can only be used once." en rouge.
  - ⚠️ Les tout premiers emails envoyés atterrissent en indésirable sur Hotmail/Outlook — comportement normal pour un domaine tout juste vérifié sans historique d'envoi auprès de Microsoft, pas un problème de config (SPF/DKIM/DMARC corrects). Ça s'améliore avec le volume/temps d'envoi.
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
2. 🔄 Initialiser le repo Next.js (App Router) — **fait**. CNAME DNS du sous-domaine `video.intercitesbmx.com` vers Vercel confirmé côté OVH — déploiement Vercel effectif (build en prod, site réellement accessible) **à reconfirmer**.
3. 🔄 Créer le projet Supabase, définir le schéma Prisma (tables `Code` et `Order`) — **fait**. Lancer la première migration — **à faire** (pas de dossier `prisma/migrations` actuellement).
4. ✅ Mettre en place le ping périodique (GitHub Actions en cron) pour éviter la pause du projet Supabase gratuit — `.github/workflows/supabase-ping.yml` + `src/app/api/ping/route.ts`.

### Phase 2 — Parcours DVD physique (le cœur du système)
5. ✅ Script d'admin/CLI pour générer un lot de codes uniques (10–12 caractères, sans caractères ambigus) et les insérer en base — `scripts/generate-codes.ts` (`npm run generate-codes -- --count N --origin physical --batch "..."`).
6. ✅ Page d'accueil : bande-annonce en fond, champ code + bouton "Télécharger" — `src/app/page.tsx`.
7. ✅ Route API de validation de code : vérifie existence, statut "non utilisé", décrémente le compteur de téléchargements de façon atomique — `src/app/api/redeem/route.ts`.
8. ✅ Stockage vidéo sur Cloudflare R2 (migré depuis Backblaze B2, voir Stack technique) + endpoint de lien signé à courte durée de vie avec `Content-Disposition: attachment` — `src/lib/r2.ts`. Testé de bout en bout (liste bucket + requête Range sur lien signé).
   - Le film complet définitif reste à uploader dans le bucket (le fichier actuel est un fichier de test).
9. ⏳ Tester le parcours complet de bout en bout avec un code de test réel : saisie → validation → téléchargement → code marqué comme utilisé → nouvelle tentative refusée (nécessite une migration Prisma appliquée + le serveur Next.js lancé).

### Phase 3 — Achat numérique
10. ✅ Page d'achat séparée avec l'API Checkout SumUp — `src/app/api/checkout/route.ts`, `src/lib/sumup.ts`.
11. ✅ Vérification du statut de paiement en place via `return_url` (`/api/checkout/webhook`, relit toujours le statut via l'API avant d'agir), et `redirect_url` ajouté pour ramener le navigateur du client sur `/thank-you` après paiement (voir point d'architecture en haut du doc). Le vrai webhook serveur-à-serveur `CHECKOUT_STATUS_CHANGED` reste absent : si le client ferme l'onglet avant la redirection, rien ne se déclenche. À durcir avant la mise en prod si ce cas devient un problème réel.
12. ✅ Resend branché : génération d'un nouveau code à la confirmation du paiement, envoi par email — `src/lib/email.ts`. Testé et fonctionnel.
13. 🔄 Paiement test de bout en bout effectué à 2€ (avant le fix `redirect_url`) : checkout → paiement confirmé côté SumUp → email reçu avec code. Reste à revalider avec le fix `redirect_url` en place (atterrissage sur `/thank-you` après paiement).

### Phase 4 — Interface d'administration
14. ⏳ Écran listant les lots de codes (généré, utilisé/non utilisé, origine physique/digital) et permettant d'exporter un lot en CSV pour l'impression.
15. ⏳ Fonction de réémission manuelle d'un accès (nouveau code) en cas de demande support.
16. ⏳ Vue des commandes SumUp associées (utile pour le support et la comptabilité).

### Phase 5 — Finitions et lancement
17. ⏳ Vérifier les temps de chargement/poids de la page d'accueil (vidéo de bande-annonce compressée correctement).
18. ⏳ Générer le lot définitif de codes pour l'impression des DVD physiques (avec marge pour les exemplaires de test/presse).
19. ⏳ Test de charge léger sur l'endpoint de téléchargement (simuler plusieurs codes utilisés en même temps).
20. ⏳ Mise en production finale sur `video.intercitesbmx.com` et vérification DNS OVH.
