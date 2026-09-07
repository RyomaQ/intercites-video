# CLAUDE.md — Plateforme d'accès en ligne Intercité (version simplifiée)

## Contexte

Intercité est un DVD de 90 minutes de BMX street avec des riders de la scène française. Le DVD est vendu physiquement, mais on veut aussi donner aux acheteurs un accès en ligne au film (téléchargement uniquement, pas de streaming), et permettre en plus une vente 100% numérique (sans DVD physique) via le même système.

## ⚠️ Point à vérifier en priorité (avant de coder la partie paiement)

Il faut confirmer si les commandes passées sur la boutique en ligne SumUp (Online Store, celle qui contient déjà les autres articles physiques) sont récupérables via l'API SumUp — avec l'email du client et le produit acheté. Cette API est bien documentée pour les paiements créés via l'API Checkout (intégration custom), mais rien ne confirme qu'elle couvre aussi les commandes passées via l'Online Store (ça pourrait être un système séparé en coulisses).

**Comment tester** : ajouter l'article "Film numérique" sur `intercitesbmx.com` (SumUp Online Store), passer une commande test, puis vérifier si elle apparaît via l'API SumUp (Transactions/Checkouts) avec l'email du client et une référence au produit acheté.

- **Si oui** : on garde l'architecture décrite plus bas (redirection vers l'article SumUp existant, récupération via l'API/webhook).
- **Si non** : il faudra construire une page d'achat séparée sur `video.intercitesbmx.com` qui crée elle-même le paiement via l'API Checkout SumUp, pour être certain d'avoir accès aux données de la commande (email notamment).

## Domaines

- **Site principal** (vitrine du film + vente du DVD physique) : `intercitesbmx.com`, actuellement sur SumUp (boutique en ligne).
- **Cette plateforme** (redemption du code + téléchargement) : sous-domaine `video.intercitesbmx.com`, hébergée séparément (Vercel), indépendante du site SumUp.

## Objectif de la plateforme

1. Un acheteur du DVD physique entre le code imprimé dans la pochette du DVD et télécharge directement le film.
2. Un acheteur qui préfère le numérique clique sur "Acheter", paie sur SumUp, reçoit un code par email, et l'utilise de la même façon que l'acheteur physique.
3. Chaque code ne permet qu'**un seul téléchargement**. Pas de DRM lourd, mais pas un lien partageable à l'infini non plus.

## Page d'accueil (video.intercitesbmx.com)

- La bande-annonce du film joue en fond (autoplay, muet).
- Un seul champ : **code d'activation**, avec un bouton "Télécharger" pour valider.
- Un bouton **Acheter** pour l'achat numérique direct (redirection SumUp).

## Parcours utilisateurs

### A. Acheteur du DVD physique

1. Le DVD est livré avec un code d'activation unique imprimé sur un encart dans le boîtier (un code par DVD produit, généré à l'avance en lot).
2. Sur la page d'accueil, l'utilisateur saisit son code dans le champ prévu.
3. Le backend vérifie que le code existe, n'a pas déjà été utilisé, et qu'il reste au moins un téléchargement disponible.
4. Si valide : le téléchargement se déclenche, et le code est immédiatement marqué comme utilisé.
5. Le code ne fonctionne plus ensuite, pour personne — un seul téléchargement autorisé par code.

### B. Acheteur numérique direct (sans DVD)

1. Depuis la page d'accueil, l'utilisateur clique sur "Acheter". On redirige vers l'article SumUp.
2. Une fois le paiement confirmé, on récupère via l'API SumUp le statut et l'email associés à la commande (mécanique exacte — webhook `CHECKOUT_STATUS_CHANGED` + rappel API, ou polling — à confirmer selon le résultat du test ci-dessus).
3. Le backend génère un nouveau code (même système que les codes physiques, juste marqué d'une origine "digital") et l'envoie par email au client.
4. Le client va sur `video.intercitesbmx.com`, entre son code reçu par email — à partir de là, le parcours rejoint celui de l'acheteur physique (étape A.3).

## Principes de sécurité retenus

- Codes uniques par DVD (10–12 caractères alphanumériques, majuscules, sans caractères ambigus type 0/O ou 1/l).
- Un code = un seul téléchargement autorisé.

## Stack technique

- **Framework** : Next.js (App Router).
- **Base de données** : Supabase (juste une table de codes, usage très léger).
  - ⚠️ Le plan gratuit Supabase met le projet en pause après 1 semaine d'inactivité. Mettre en place un ping périodique (GitHub Actions en cron, une requête légère quotidienne) pour l'éviter en production.
- **ORM** : Prisma.
- **Paiement** : API SumUp (voir point à vérifier en priorité ci-dessus pour savoir si ça passe par l'Online Store existant ou une intégration Checkout séparée).
- **Vidéo** : Backblaze B2 (stockage, gratuit jusqu'à 10 Go ; pas besoin de Cloudflare devant — à ce volume, le coût d'egress direct de B2 reste négligeable).
- **Email transactionnel** : Resend ou Postmark (envoi du code après achat numérique) — à trancher.
- **Hébergement de l'application** : Vercel.
- **Interface d'administration** : à construire — génération de lots de codes (liés à un batch/référence DVD), consultation des statuts (utilisé/non utilisé), réémission manuelle en cas de demande support, suivi des commandes SumUp.

## Outils de développement

- Le MCP officiel SumUp ([sumup-mcp](https://github.com/sumup/sumup-mcp), packagé aussi via [sumup-skills](https://github.com/sumup/sumup-skills) pour Claude Code) peut être connecté à Claude Code **pendant le développement** — pratique pour interroger son compte SumUp en langage naturel sans quitter l'éditeur. Ce n'est pas un composant de production : l'intégration réelle reste l'API REST SumUp classique (clé API + webhook), décrite plus haut.

## Modèle de données (point de départ, à affiner)

- **Code** : id, code_value (unique), origin (physical/digital), status (unused/used), max_downloads (1), downloads_used, redeemed_at.
- **Order** (achat numérique uniquement) : id, sumup_checkout_id, email, status, code_id (lié), created_at.

## Étapes de développement

### Phase 0 — Vérification bloquante
1. Tester la récupération des commandes SumUp Online Store via l'API (voir section dédiée plus haut). Ce test conditionne l'architecture du parcours B — à faire avant tout développement de la partie paiement.

### Phase 1 — Fondations
2. Initialiser le repo Next.js (App Router), déployer un premier "hello world" sur Vercel, brancher le sous-domaine `video.intercitesbmx.com`.
3. Créer le projet Supabase, définir le schéma Prisma (tables `Code` et `Order`), lancer la première migration.
4. Mettre en place le ping périodique (GitHub Actions en cron) pour éviter la pause du projet Supabase gratuit.

### Phase 2 — Parcours DVD physique (le cœur du système)
5. Script d'admin/CLI pour générer un lot de codes uniques (10–12 caractères, sans caractères ambigus) et les insérer en base — utilisable dès le début pour tester en local.
6. Page d'accueil : bande-annonce en fond, champ code + bouton "Télécharger".
7. Route API de validation de code : vérifie existence, statut "non utilisé", décrémente le compteur de téléchargements de façon atomique (transaction en base pour éviter toute double validation simultanée).
8. Mettre en place le stockage vidéo sur Backblaze B2 (upload du fichier final), et l'endpoint qui génère un lien signé à courte durée de vie puis répond avec `Content-Disposition: attachment` pour déclencher le téléchargement.
9. Tester le parcours complet de bout en bout avec un code de test : saisie → validation → téléchargement → code marqué comme utilisé → nouvelle tentative refusée.

### Phase 3 — Achat numérique
10. Selon le résultat de la Phase 0 : implémenter soit la récupération via l'Online Store existant, soit une page d'achat séparée avec l'API Checkout SumUp.
11. Mettre en place le webhook SumUp (`CHECKOUT_STATUS_CHANGED`) et la vérification du statut de paiement associée.
12. Brancher le service d'email transactionnel (Resend ou Postmark) : génération d'un nouveau code à la confirmation du paiement, envoi par email avec un gabarit simple.
13. Tester le parcours complet : achat test → réception de l'email → code utilisable comme en Phase 2.

### Phase 4 — Interface d'administration
14. Écran listant les lots de codes (généré, utilisé/non utilisé, origine physique/digital) et permettant d'exporter un lot en CSV pour l'impression.
15. Fonction de réémission manuelle d'un accès (nouveau code) en cas de demande support.
16. Vue des commandes SumUp associées (utile pour le support et la comptabilité).

### Phase 5 — Finitions et lancement
17. Vérifier les temps de chargement/poids de la page d'accueil (vidéo de bande-annonce compressée correctement).
18. Générer le lot définitif de codes pour l'impression des DVD physiques (avec marge pour les exemplaires de test/presse).
19. Test de charge léger sur l'endpoint de téléchargement (simuler plusieurs codes utilisés en même temps).
20. Mise en production finale sur `video.intercitesbmx.com` et vérification DNS OVH.