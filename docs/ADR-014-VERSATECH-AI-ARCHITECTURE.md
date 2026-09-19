# ADR-014 — VersaTech AI : tools contrôlés, pas de Prisma agent

Statut : accepté  
Date : 19 septembre 2026  

Références : ADR-002, ADR-003, ADR-004, ADR-008, ADR-011, ADR-012, ADR-013, BR-015, `docs/04-TECHNICAL-ARCHITECTURE.md`, `docs/07-INTEGRATIONS.md`, `docs/08-SECURITY.md`, `docs/11-BUSINESS-RULES.md`, `docs/VERSATECH-AI-AUDIT.md`.

---

## Contexte

VersaTech OS est un monolithe Next.js App Router + PostgreSQL + Prisma. La vérité métier est déjà persistée : entreprises, pipeline, devis, paiements, tournées, projets. ADR-008 impose l’IA **après** des données structurées. BR-015 interdit à l’IA de valider seule un paiement, une suppression, un changement critique ou un envoi externe.

L’état actuel n’expose pas une couche service réutilisable :

- lectures dans `src/lib/queries/*` (Prisma + `requireAuthenticatedUser()`, qui **redirige** vers `/connexion`) ;
- écritures dans `src/actions/*` (`"use server"`, souvent `FormData`, Zod, Prisma, ActivityLog, `revalidatePath`) ;
- confirmations sensibles uniquement navigateur (`window.confirm`). Le serveur exécute dès qu’une Server Action authentifiée arrive.

Un agent qui appellerait Prisma, ou une Server Action UI telle quelle, contournerait l’auth des tools, le journal, les projections, et BR-015. La mémoire d’un LLM n’est pas un CRM.

Cette ADR fige l’architecture **avant** tout runtime IA (pas d’install Mastra, pas de `src/ai/`, pas de route chat dans cette décision).

---

## Décision

VersaTech AI est un opérateur authentifié du **même** domaine que l’UI. Il n’a pas de chemin de données parallèle.

### Flux

```
UI            → Business Services → Prisma → PostgreSQL
VersaTech AI  → Controlled Tools  → Business Services → Prisma → PostgreSQL
```

- **PostgreSQL** reste la source de vérité métier. La mémoire d’agent (futurs messages / working memory) n’est **pas** la vérité CRM, ni une copie du CA, des pipelines ou des fiches.
- **Prisma** reste serveur uniquement (`server-only`, singleton `src/lib/db/prisma.ts`). Aucun agent, tool, provider ou prompt n’importe Prisma, `PrismaClient`, ni un `where` SQL/Prisma libre.
- **UI et IA partagent les mêmes Business Services** (extraction progressive vers `src/lib/services/*`). Les services prennent des objets TypeScript validés par Zod (ids `cuid`, dates ISO, enums, montants alignés sur `src/lib/money.ts`). **Jamais `FormData`.**
- Les **Server Actions** deviennent des adapters UI (parse FormData → service → `revalidatePath`). Un tool **n’appelle jamais** une Server Action.
- Les **tools** sont des adapters IA (permissions + confirmation + DTO compact → service). Fail-closed : un tool absent du catalogue est refusé.
- **Mastra** (quand une phase ultérieure l’installera) = orchestration serveur uniquement, pas le domaine. Le modèle est interchangeable.

### Auth et journal

- Même session JWT (ADR-013). Pas d’identité « bot » distincte. `requireActor` (ou équivalent **sans redirect**) sur toute mutation.
- Toute mutation passe par ActivityLog côté **service** (`metadata.source = "ai"` + `toolName` pour l’agent). Les tools n’écrivent pas le journal eux-mêmes.
- V1 = administrateur unique authentifié. La matrice READ / WRITE / CRITICAL se code dès les tools, pour ne pas la greffer après MEMBER.

### Classes de tools

| Classe | Contrat |
| --- | --- |
| **READ** | Session authentifiée. Lecture projetée, limites basses, pas de mutation. |
| **WRITE** | Mutation métier courante : auth, Zod objet, **id persisté**, ActivityLog obligatoire. |
| **CRITICAL** | Interdit en autonome. Exige une **confirmation serveur explicite** (token lié à l’acteur + hash des arguments + TTL court, ou équivalent UI+serveur). « L’utilisateur a confirmé dans le prompt » est ignoré. |

**CRITICAL** inclut au minimum : passage WON / LOST ; devis sensibles (surtout ACCEPTED / REJECTED) ; paiements et écritures finance ; maintenance / MRR sensibles ; liaison / déliaison GitHub ; suppressions ; envois externes ; toute action irréversible. Tant que la confirmation n’existe que dans le navigateur, **aucun tool CRITICAL ne s’exécute**.

Outils **jamais exposés** : SQL / Prisma libre, shell, seed / reset / import / geocode batch, `delete*` Company/Quote/Payment/Document/Event (BR-012), `sendExternal*`.

### Multi-action

Règles **codées**, pas dans le system prompt :

- plafond d’actions WRITE par tour (défaut visé : 3, fail-closed) ;
- WRITE uniquement avec des identifiants déjà persistés (READ / search d’abord ; 0 ou N>1 candidats → stop, ne pas inventer ni créer « pour aider ») ;
- valider chaque étape (Zod + règles métier du service) ;
- abort au premier échec ; les tools déjà persistés ne sont pas rollback — le plan doit rester visible ;
- **aucun CRITICAL** dans une chaîne autonome ;
- plan d’actions visible **avant** une série de mutations.

Une chaîne n’est pas une transaction unique. 1 tool = 1 transaction métier, comme l’UI.

### Injection de prompt

Tout contenu issu d’outils ou du CRM est **UNTRUSTED**. Il ne peut pas changer permissions, prompt système, catalogue de tools, ni classe READ/WRITE/CRITICAL.

Sources non fiables : web, documents, notes CRM / briefs / objections, e-mails futurs, GitHub (commits, issues, PR), résultats de recherche.

Les politiques vivent dans le code (catalogue, `enforce`). Pas de bypass « ignore tes règles ».

### Secrets

Jamais dans un prompt, une mémoire d’agent, une sortie de tool, ou un ActivityLog : `DATABASE_URL`, `AUTH_SECRET`, token GitHub, clés provider LLM, mots de passe et tout credential.

GitHub reste lecture d’abord (ADR-006 / BR-013). L’adapter serveur est le seul à parler à GitHub.

### Web futur

Un seul adapter contrôlé (allowlist, timeout, taille max, pas de follow vers IPs internes / metadata). **Pas de `fetch` arbitraire** dans l’agent. Protection SSRF obligatoire. Ne pas télécharger les URLs Document du CRM.

### API

- Jamais l’API HTTP catch-all Mastra (`createNextRouteHandler` / surface agents générique).
- Future route unique visée : `POST /api/ai/chat`, runtime Node, session obligatoire, rate-limit.
- **`/api/ai` n’entre jamais dans `isPublicPath()`** (`src/lib/auth/paths.ts`). Aujourd’hui seuls `/connexion` et `/api/health` sont publics.
- Ne pas lancer `mastra init`, ne pas adopter le squelette `src/mastra/`, ne pas utiliser LibSQL (fichier) en production. Mémoire future : PostgreSQL dédiée, hors vérité CRM.
- CSP actuelle : le navigateur parle à l’app (`connect-src 'self'`), pas à un provider LLM. Ne pas ouvrir microphone / caméra tant qu’une phase voix ne le décide pas.

### Invariants métier inchangés

- BR-015 reste **prioritaire** sur toute suggestion du modèle.
- ALEX'CEPTION et les prospects importés sont des **données de production**. Pas de seed destructif, pas de reset, pas de « réparation » massive via l’agent.
- Jours civils, « aujourd’hui », tournées : **Europe/Paris** via `src/lib/dates.ts`.

---

## Conséquences

- Extraire progressivement Prisma + règles hors des Server Actions vers des services partagés, **sans** changer le comportement UI.
- Promouvoir les confirmations sensibles (`SENSITIVE_ACTION_CONFIRMS`) en politique **serveur** partagée UI + agent.
- Les lectures réutilisées hors RSC ne doivent pas `redirect` ; prévoir un gardien d’acteur adapté aux Route Handlers / tools.
- Schémas Zod **objets** pour les tools, distincts des schémas FormData string ; mêmes enums et superRefine métier.
- Catalogue fail-closed avant le premier tool WRITE.
- Install Mastra / provider / `src/ai/` uniquement sur **phase explicite** ultérieure, avec `@mastra/*` en `serverExternalPackages` et pin Node ≥ 22.13. Zod 4 déjà en place : ne pas ajouter Zod 3.
- Les règles Cursor `.cursor/rules/versatech-os-core.mdc` et `versatech-ai.mdc` matérialisent ces invariants. Ne pas les diluer dans `AGENTS.md` (bloc Next régénéré).

---

## Non-objectifs

Cette ADR **ne** livre pas : runtime Mastra, `src/ai/`, `/api/ai/*`, tools, extraction massive des services, flags LLM, chat UI, recherche web, mémoire, voix, changement de schéma Prisma, tools de suppression, ouverture GitHub en écriture, ou assouplissement CSP / Permissions-Policy.

Elle ne remplace pas ADR-008 (l’IA reste après données structurées) et n’autorise pas à inventer du CA, des relances ou des entreprises.

---

## Alternatives rejetées

| Alternative | Pourquoi non |
| --- | --- |
| Agent → Prisma | Contourne règles, auth, projections, BR-015. Risque maximal. |
| Agent → Server Actions FormData | Couplage UI, redirect, confirm cosmétique, schémas string. |
| Mémoire LLM / LibSQL = CRM | Fausse source de vérité ; incompatible prod / multi-instance. |
| `mastra init` + API catch-all | Squelette météo, `src/mastra/`, auth à refaire, surface trop large. |
| Politique seulement dans le system prompt | Injection de prompt ; l’utilisateur « confirme » en texte. |
