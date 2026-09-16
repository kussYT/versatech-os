VERSATECH OS — ARCHITECTURE DECISION RECORDS

ADR-001 — MONOLITHE NEXT.JS
Décision : monolithe modulaire.
Raison : produit interne solo, vitesse, simplicité.
Statut : accepté.

ADR-002 — POSTGRESQL
Décision : PostgreSQL comme base relationnelle.
Raison : relations CRM/projets solides, analytics, maturité.
Statut : accepté.

ADR-003 — PRISMA
Décision : Prisma ORM.
Raison : typage TypeScript, migrations, expérience déjà connue.
Statut : accepté.

ADR-004 — COMPANY UNIQUE
Décision : Prospect et Client ne sont pas deux tables.
Raison : continuité de l'historique et absence de duplication.
Statut : accepté.

ADR-005 — CALENDRIER INTERNE SOURCE DE VÉRITÉ
Décision : CalendarEvent interne ; fournisseurs externes synchronisés.
Raison : ne pas rendre le métier dépendant de Google.
Statut : accepté.

ADR-006 — GITHUB READ-ONLY FIRST
Décision : lecture GitHub d'abord.
Raison : valeur élevée, risque faible, pas besoin d'écrire dans les repos.
Statut : accepté.

ADR-007 — DOCUMENTS PAR LIENS D'ABORD
Décision : stocker références/URLs avant gestionnaire de fichiers complet.
Raison : réduire scope.
Statut : accepté.

ADR-008 — IA APRÈS DONNÉES STRUCTURÉES
Décision : IA après CRM/projets/analytics.
Raison : qualité et utilité des réponses.
Statut : accepté.

ADR-009 — DARK FIRST
Décision : design dark bleu nuit comme identité principale.
Raison : direction artistique VersaTech OS validée.
Statut : accepté.

ADR-010 — WSL POUR DEV
Décision : environnement Linux WSL lorsque autorisé par le poste.
Raison : environnement Node/Git cohérent et permissions plus prévisibles.
Statut : accepté.

ADR-011 — PRISMA ORM 7
Décision : utiliser Prisma ORM 7 tel qu'installé, pas la configuration Prisma 6.
Conséquences :
- `prisma.config.ts` porte l'URL de connexion ; `schema.prisma` ne déclare plus `url = env("DATABASE_URL")`.
- Le client est généré avec `provider = "prisma-client"` vers `src/generated/prisma` (dossier gitignoré).
- L'accès PostgreSQL applicatif passe par `@prisma/adapter-pg` + `pg`. Le singleton `src/lib/db/prisma.ts` est serveur uniquement.
- Le seed n'est plus déclenché par `migrate dev` ; il s'exécute uniquement via `prisma db seed`.
- `prisma.config.ts` retombe sur l'URL illustrative de `.env.example` seulement pour `validate` / `generate`, sans ouvrir de connexion. Le client applicatif et le seed refusent cette URL.
Statut : accepté.

ADR-012 — MONTANTS DECIMAL ET SUPPRESSIONS RESTREINTES
Décision : montants en `Decimal(12, 2)` (euros, centimes). Pas de `Float`.
Les relations commerciales utilisent `onDelete: Restrict` vers Company / Opportunity / User pour empêcher une suppression de Company d'effacer l'historique. Les clés optionnelles (contact, projet lié, etc.) utilisent `SetNull`.
Statut : accepté.

ADR-013 — AUTH CREDENTIALS INTERNES + SESSION JWT
Décision : login e-mail / mot de passe interne, session JWT signée avec `jose`, hash scrypt via `node:crypto`. Pas d'Auth.js en V1, pas d'inscription publique, pas de multi-tenant.
Raisons :
- outil interne, administrateur unique (product spec) ;
- Auth.js n'apporte pas d'OAuth/SSO utile ici ; Credentials + JWT reviendrait au même socle ;
- Next.js 16 documente `jose` pour les sessions stateless et remplace `middleware` par `proxy.ts` (runtime Node) ;
- une seule dépendance d'auth (`jose`) ; le hash reste dans la stdlib.
Conséquences :
- `User.passwordHash` additif et nullable ;
- `AUTH_SECRET` obligatoire pour signer le cookie `vt_os_session` ;
- `getActorUser()` lit la session, plus de création automatique `os@versatech.example` ;
- les Server Actions refusent les mutations sans acteur via `requireActor()`.
Statut : accepté.

AJOUT D'ADR
Créer un ADR lorsqu'une décision est coûteuse à inverser : auth, hébergement, stockage, architecture d'intégration, permissions, etc.
