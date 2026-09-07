# Intercité — plateforme d'accès en ligne

Voir [CLAUDE.md](./CLAUDE.md) pour les specs complètes.

## Setup local

```bash
npm install
cp .env.example .env   # puis remplir les valeurs
npx prisma migrate dev # crée les tables Code / Order
npm run dev
```

## Générer un lot de codes

```bash
npm run generate-codes -- --count 100 --origin physical --batch "dvd-run-1"
```

## Variables d'environnement

Voir [.env.example](./.env.example). Nécessite un projet Supabase (Postgres),
un bucket Backblaze B2 privé, et — selon le résultat de la Phase 0 du
CLAUDE.md — une intégration SumUp.

## Déploiement

Hébergé sur Vercel, sous-domaine `video.intercitesbmx.com`.
