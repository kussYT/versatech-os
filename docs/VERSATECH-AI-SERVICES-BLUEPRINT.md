# VERSATECH AI — BUSINESS SERVICES BLUEPRINT

Date : 19 septembre 2026  
Périmètre : cartographie réelle Server Actions / queries / règles pures → couche `src/lib/services/*` future.  
**Aucun fichier sous `src/` n’est créé ou modifié ici.** Pas d’install, pas de Prisma, pas de commit.

Alignement : ADR-014 — UI → services → Prisma ; AI → tools → services → Prisma ; pas de Prisma dans les tools ; pas de FormData dans les services ; ActivityLog dans les services WRITE ; CRITICAL plus tard (BR-015). Contrats tools : `docs/VERSATECH-AI-TOOLS-V1.md`.

**Noms canoniques** (identiques dans le document tools) : `XxxService.methodName`, ex. `TodayService.getTodayOverview`. Les aliases dotted (`today.getOverview`) **ne sont pas** des contrats. Fichiers cibles : `src/lib/services/<domaine>/…` (§4).

Source d’audit : `docs/VERSATECH-AI-AUDIT.md`. Ce blueprint descend au niveau **contrats TypeScript** et **ordre d’extraction**.

---

## 1. Pourquoi extraire

Aujourd’hui la logique métier n’est pas une API interne :

| Couche | Rôle réel | Problème pour l’IA |
| --- | --- | --- |
| `src/app/page.tsx` | Compose 9 queries en parallèle | Pas de `getTodayOverview()` réutilisable |
| `src/lib/queries/*` | Lectures Prisma | Chaque fonction appelle `requireAuthenticatedUser()` → **`redirect("/connexion")`** |
| `src/actions/*` | Mutations `"use server"` | `FormData` + Zod string + Prisma + ActivityLog + `revalidatePath` dans le même fichier |
| `src/lib/crm/*`, `dates.ts`, `money.ts`, `finance.ts`, `prospection/*`, `calendar/*`, `maintenance/*` | Règles **pures** déjà testables | À **importer** dans les services, pas à réécrire |

Conséquence : un tool Mastra ne peut ni appeler une Server Action FormData, ni une query qui redirige, ni Prisma. Il lui faut un **service** (objet in, `actor` in, résultat typé, sans Next).

Pattern cible (inchangé pour l’UI) :

```
Zod objet (ISO / enums / nombres)
  → service métier (actor, règles, Prisma, ActivityLog)
    → Server Action  = adapter FormData + revalidatePath
    → AI tool        = adapter permissions + DTO compact
```

---

## 2. Contrats partagés (à poser avant le premier service)

### 2.1 Acteur

`SessionUser` (`src/lib/auth/types.ts`) :

```ts
type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
};
```

`role` existe, **jamais vérifié** hors « session présente ». Les services V1 restent « session = opérateur unique ». La matrice MEMBER viendra plus tard (Phase 8 audit).

### 2.2 Résultat métier (pas `ActionResult`)

`ActionResult` (`src/lib/crm/action-result.ts`) est un sac UI (`fieldErrors`, `data` à clés optionnelles). Les services ne doivent pas le renvoyer.

Proposition (types seulement, **ne pas implémenter maintenant**) :

```ts
type ServiceFieldErrors = Record<string, string[] | undefined>;

type ServiceResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code:
        | "AUTH_REQUIRED"
        | "NOT_FOUND"
        | "VALIDATION"
        | "CONFLICT"
        | "FORBIDDEN"
        | "DEPENDENCY";
      message: string;
      fieldErrors?: ServiceFieldErrors;
    };
```

Les Server Actions mappent `ServiceResult` → `ActionResult`. Les tools mappent vers un DTO compact.

### 2.3 Zod : deux familles, un type interne

Les schémas actuels (`src/lib/validations/*`) transforment des **strings de formulaire** (`parseDateTimeLocal`, montants `"12,5"`, `emptyToNull`). Ils ne sont **pas** des contrats tools.

Cible :

- garder les schémas FormData comme adapters UI ;
- ajouter des schémas **objet** (ISO 8601, `number` / money string déjà normalisée, enums Prisma) qui produisent **le même type interne** que le service consomme ;
- ne jamais faire parser du `FormData` par un tool.

### 2.4 ActivityLog

Helper `logActivity` (`src/lib/crm/activity.ts`) : **jamais appelé**. Toutes les mutations font `tx.activityLog.create` dans la transaction Prisma (correct : même `tx`).

Les services WRITE doivent logger **dans la transaction**, pas via le helper hors-tx. Étendre plus tard `logActivity` pour accepter un `tx`.

Convention future AI : `metadata.source = "ai"` + `toolName` (les tools n’écrivent pas l’ActivityLog eux-mêmes).

`getRecentActivity` ne sélectionne **pas** `metadata` (bon pour un tool READ).

### 2.5 `revalidatePath`

Les helpers `src/lib/crm/revalidate.ts` restent dans les **Server Actions** (Next cache). Les services **ne** les appellent **pas**.

---

## 3. Auth utilisable SANS redirect (Route Handlers / tools)

### 3.1 Chaîne actuelle (code réel)

| Fonction | Fichier | Comportement | Usage IA |
| --- | --- | --- | --- |
| `getSessionUser()` | `src/lib/auth/session.ts` | Cookie `vt_os_session` → JWT `jose` → `prisma.user.findUnique` → `sessionVersion` → `SessionUser \| null`. `cache()` React. | **Source unique** cookie/JWT. OK en Request. |
| `requireAuthenticatedUser()` | `src/lib/auth/dal.ts` | Si pas d’user : **`redirect(LOGIN_PATH)`** (`/connexion`). | **Inadapté** aux Route Handlers / tools (throw `NEXT_REDIRECT`). Utilisé par **toutes** les queries + `layout.tsx`. |
| `actorOrUnauthorized(actor)` | `src/lib/auth/guard.ts` | `{ ok: true, actor }` ou `{ ok: false, result: AUTH_REQUIRED_RESULT }`. | Bonne forme, mais `result` est un `ActionResult` UI. |
| `requireActor()` | `src/lib/crm/actor.ts` | `actorOrUnauthorized(await getSessionUser())`. | Mutations + `searchGlobal`. **Mieux** que redirect, encore couplé à `ActionResult`. |
| `AUTH_REQUIRED_RESULT` | `src/lib/auth/guard.ts` | `{ ok: false, message: "Authentification requise." }` | Message UI. |

`login` / `logout` (`src/actions/auth.ts`) : **hors tools**.

TTL réel : `SESSION_TTL_SECONDS` = **24 h** (pas 7 jours de `docs/08-SECURITY.md`).

### 3.2 Helper futur (signature seulement — ne pas implémenter)

Ne pas dupliquer la lecture cookie. Réutiliser `getSessionUser()`.

```ts
/**
 * Acteur pour Route Handlers, services et tools.
 * Jamais de redirect(). Jamais d'ActionResult.
 * Source : getSessionUser() (cookie JWT + sessionVersion).
 */
export async function requireRequestActor(): Promise<
  { ok: true; actor: SessionUser } | { ok: false; code: "AUTH_REQUIRED" }
>;
```

Emplacement proposé : `src/lib/auth/request-actor.ts` (à côté de `dal.ts` / `guard.ts`), pas sous `src/ai/`.

Règle d’usage :

1. **Pages RSC** : `requireAuthenticatedUser()` reste à la frontière UI (`layout`, pages).
2. **Route Handler / tool** : `requireRequestActor()` ; si `!ok` → 401 JSON, pas de redirect.
3. **Service** : **ne s’authentifie pas**. Il reçoit `actor: SessionUser` déjà résolu. Pas de `cookies()`, pas de `redirect`, pas de `requireActor`, **pas de `ToolContext`**.
4. **Queries** : aujourd’hui chaque `list*` / `get*` appelle `requireAuthenticatedUser()`. Pour les tools, extraire le chargement Prisma **sans** redirect (paramètre `actor` ignoré côté SQL V1, mais obligatoire pour ne pas oublier l’auth en amont). Option : `load*` interne sans auth, appelé seulement depuis un service qui exige `actor`.

Composition avec les tools (`docs/VERSATECH-AI-TOOLS-V1.md`) : le runtime appelle `requireRequestActor()` (session JWT, jamais le body du modèle) → `SessionUser` → enveloppe `ToolContext` (`actorId`, `role`, `requestId`, `source: "AI"`, `confirmation?`). Le tool mappe ensuite `actor` vers le service. `ToolResult` mappe `ServiceResult` (ex. `VALIDATION` → `VALIDATION_FAILED`). `requireActor()` reste l’adapter UI (`ActionResult`).

Exception déjà réelle : `getTodayVisitCompanyIds()` (`src/lib/prospection/today-visits.ts`) touche Prisma **sans** auth. À ne pas exposer tel quel à un tool ; le faire passer par `TourService`.

`searchGlobal` est le seul contrat d’action déjà « tool-like » (`query: string`, `requireActor`, pas de FormData) — mais il appelle `searchWorkspace()` qui **redirige** encore.

---

## 4. Arborescence cible (NE PAS CRÉER)

```
src/lib/services/
  _shared/
    result.ts                 # ServiceResult<T> (plus tard)
  today/
    get-today-overview.ts
  search/
    search-workspace.ts
  activity/
    list-recent-activity.ts
    get-today-interaction-counts.ts
  companies/
    create-company.ts
    update-company.ts
    update-commercial-brief.ts
    get-company.ts            # projection compacte, pas le hub
    list-companies.ts
  interactions/
    create-interaction.ts
    record-terrain-visit.ts   # appelle create-interaction, plus de FormData
  follow-ups/
    create-follow-up.ts
    complete-follow-up.ts
    reschedule-follow-up.ts
    list-follow-ups.ts
  opportunities/
    create-opportunity.ts
    update-opportunity-stage.ts
    get-pipeline.ts
  quotes/                     # WRITE = CRITICAL (surtout ACCEPTED)
    create-quote.ts
    update-quote-status.ts
    list-quotes.ts
  projects/
    create-project.ts         # CRITICAL / structurant
    update-project-status.ts
    list-projects.ts
    get-project.ts
  tasks/
    create-task.ts            # élargir : companyId XOR projectId
    update-task-status.ts
    list-open-tasks.ts
  milestones/
    create-milestone.ts
    update-milestone-status.ts
  calendar/
    create-calendar-event.ts
    update-calendar-event.ts
    list-calendar-items.ts
  tours/
    ensure-today-tour.ts
    add-company-to-today-tour.ts
    remove-company-from-today-tour.ts   # CRITICAL (confirm)
    move-tour-stop.ts
    mark-tour-stop-visited.ts
    get-today-tour.ts
  map/                        # géocode Nominatim — hors premier lot WRITE agent
    geocode-company.ts
    save-company-location.ts
    list-map-companies.ts
  finance/                    # WRITE = CRITICAL (BR-015) ; READ snapshot OK
    get-finance-snapshot.ts
    create-payment.ts
    update-payment-status.ts
  maintenance/                # WRITE = CRITICAL (MRR)
    create-maintenance-contract.ts
    update-maintenance-contract.ts
    update-maintenance-status.ts
    list-maintenance.ts
  documents/
    create-document.ts
    update-document.ts
    list-documents.ts
  github/
    associate-repository.ts   # CRITICAL
    unlink-repository.ts      # CRITICAL (delete row)
    get-github-overview.ts
```

Les Server Actions restent dans `src/actions/*` comme **adapters**.  
Les tools iront plus tard dans `src/ai/tools/*` (hors ce document d’extraction).  
`src/lib/queries/*` peut rester comme chargeurs Prisma, une fois le `redirect` retiré, **ou** être absorbé par les services READ. Ne pas dupliquer les `where` Prisma.

Noms READ V1 (tool → service), identiques au document tools :

| Tool | Service |
| --- | --- |
| `getTodayOverview` | `TodayService.getTodayOverview` |
| `searchCompanies` | `SearchService.searchWorkspace` (projection `kind=company` ; enrichissement `CompanyService` si contact / lifecycle manquent) |
| `getCompany` | `CompanyService.getCompany` |
| `listFollowUps` | `FollowUpService.listFollowUps` |
| `listTasks` | `TaskService.listOpenTasks` |
| `listCalendarItems` | `CalendarService.listCalendarItems` |
| `getTodayTour` | `TourService.getTodayTour` |
| `getPipeline` | `OpportunityService.getPipeline` |
| `getFinanceSnapshot` | `FinanceService.getFinanceSnapshot` (READ agrégats, **pas** CRITICAL) |
| `getRecentActivity` | `ActivityService.getRecentActivity` |

---

## 5. Inventaire par domaine (code réel)

Légende risque d’extraction :

- **P0 lecture** : bas risque, débloque les tools READ.
- **P1 écriture courante** : Zod + transaction déjà clairs, pas d’argent.
- **P2 CRITICAL** : finance, devis ACCEPTED, projet terminal, maintenance, GitHub unlink, WON/LOST, retrait tournée. Documenté, **hors premier lot**.

Tous les WRITE actuels : `requireActor()` sauf `recordTerrainVisit` (délègue à `createInteraction`) et `markCompanyVisited` (FormData → visite). Auth login/logout exclus.

---

### 5.0 Today / dashboard (composition)

**Current Server Action(s)** : aucun. Composition dans `src/app/page.tsx` (`TodayPage`).

**Lectures actuelles** (chacune redirige) :

| Query | Fichier | Défaut |
| --- | --- | --- |
| `getPipelineOverview()` | `queries/opportunities.ts` | brut / pondéré / counts |
| `getFollowUpDashboard(limit = 4)` | `queries/follow-ups.ts` | `dueCount` = overdue + today |
| `getFinanceSnapshot()` | `queries/payments.ts` | signed / collected / remaining / overdue |
| `getTaskDashboard(limit = 5)` | `queries/projects.ts` | `openCount` + preview |
| `getTodayAgenda()` | `queries/calendar.ts` | `listCalendarItems(startOfToday, endOfToday)` |
| `listCompaniesToCall(limit = 5)` | `queries/companies.ts` | lifecycle `LEAD` |
| `getTodayInteractionCounts()` | `queries/activity.ts` | CALL + MEETING **hors visites terrain** |
| `getRecentActivity(limit = 8)` | `queries/activity.ts` | sans `metadata` |
| `getTourDashboard()` | `queries/tours.ts` | planned / visited / remaining / nextNames |

**Business logic dans la page** : uniquement `Promise.all` + passage aux composants. Les règles KPI (BR-008, visites exclues des RDV) sont dans `getTodayInteractionCounts` et `isTerrainVisit`.

**Prisma** : via les 9 queries (Company, FollowUp, Opportunity, Quote, Payment, Task, CalendarEvent, ActivityLog, Interaction, Tour, TourStop).

**Zod** : non.

**ActivityLog** : lecture seulement (`action` + `entityType` + `actorName`).

**revalidatePath** : n/a (lecture).

**FormData** : non.

**Fonctions pures déjà disponibles** :

- `startOfToday` / `endOfToday` (`dates.ts`)
- `computeFinanceTotals`, `effectivePaymentStatus` (`finance.ts`)
- `weightedValue`, `effectiveProbability` (`probability.ts`)
- `isTerrainVisit` (`prospection/visit.ts`)
- `dueBucket` (`dates.ts`)
- `ACTIVITY_LABELS` (`crm/activity-labels.ts`) — libellés UI, pas dans le query

**Service à extraire** : `TodayService.getTodayOverview`

**Contrat recommandé** :

```ts
type GetTodayOverviewInput = {
  actor: SessionUser;
  now?: Date; // défaut : new Date() ; bornes = jour civil Paris
};

type TodayOverview = {
  pipeline: PipelineOverview;           // queries/opportunities
  followUps: { dueCount: number; preview: FollowUpListItem[] };
  finance: FinanceTotals;               // strings money, pas number
  tasks: { openCount: number; preview: DashboardTaskItem[] };
  agenda: CalendarItem[];               // contient encore href (UI) — tool = projection sans href
  calls: CompanyListItem[];
  interactionCounts: { calls: number; meetings: number };
  recentActivity: RecentActivityItem[];
  tour: TourDashboard;
};

function getTodayOverview(
  input: GetTodayOverviewInput,
): Promise<ServiceResult<TodayOverview>>;
```

Implémentation future : un seul `requireRequestActor` en amont, puis `Promise.all` des **loaders** sans redirect. Ne pas renvoyer le hub `getCompanyDetail`. Plafond déjà présent côté dashboard (`limit` 4–8) : les conserver ; pour un tool, `limit` explicite max 20.

---

### 5.1 Company

**Current Server Action(s)** :

| Action | Fichier |
| --- | --- |
| `createCompany(_prev, formData)` | `src/actions/companies.ts` |
| `updateCompany(_prev, formData)` | `src/actions/companies.ts` |
| `updateCommercialBrief(_prev, formData)` | `src/actions/brief.ts` |
| `geocodeCompany(_prev, formData)` | `src/actions/map.ts` |
| `saveCompanyLocation(_prev, formData)` | `src/actions/map.ts` |
| Wrappers `geocodeCompanyForm` / `saveCompanyLocationForm` | `map.ts` |

Pas de CRUD Contact autonome. Pas de delete Company. Pas de `createClient` (CLIENT = lifecycle).

**Lectures** : `listAllCompanies`, `listProspectCompanies`, `listCompaniesToCall`, `getCompanyDetail`, `getProspectionSummary` (`queries/companies.ts`) ; `listClientCompanies` (`queries/clients.ts`) ; `listMapCompanies` (`queries/map.ts`).

`getCompanyDetail` = **hub UI complet** (contacts, interactions, opp, devis, projets, journey, website, finance, documents, maintenance, `allowedLifecycleStatuses`). Trop gros pour un tool.

**Business logic actuellement dans les actions** :

- `createCompany` : `lifecycleStatus: "LEAD"`, `priority: "NORMAL"`, `country: "FR"` ; contact primaire si prénom+nom ; tx.
- `updateCompany` : charge company + 1 contact ; `countCompanyLifecycleFacts` + `validateManualLifecycle` ; upsert contact primaire ; log lifecycle si changement.
- `updateCommercialBrief` : `parseCommercialBrief` / `serializeCommercialBrief` ; statut hors enum → `"UNVERIFIED"` ; **pas de Zod**.
- `geocodeCompany` : **pas de Zod** ; `planCompanyGeocode` (skip protected / ALEX'CEPTION, mark_manual, fetch Nominatim) ; statuts `OK` / `MANUAL` / `FAILED`.
- `saveCompanyLocation` : parse lat/lng `Number` + virgule ; `geocodeStatus: "MANUAL"`.

**Prisma** : `company`, `contact`, `activityLog` ; géocode = `company` only.

**Zod** : `createCompanySchema`, `updateCompanySchema` (`validations/company.ts`) — nom **et adresse** obligatoires ; contact superRefine. Géocode / brief : **aucun schéma**.

**ActivityLog** :

- `company.created`
- `company.updated`
- `company.lifecycle_changed` (direct + via `applyCompanyLifecycleChange`)
- `company.brief_updated`
- `company.geocoded`
- `company.location_saved`

**revalidatePath** : `revalidateCrm(companyId)` (/, prospection, entreprises, relances, pipeline, clients, carte, tournée, fiche). Géocode appelle aussi `revalidateCrm`.

**FormData** : oui partout sauf lectures. Champs create : `name`, `industry`, `address`, `city`, `postalCode`, `phone`, `email`, `website`, `source`, `description`, `contactFirstName`, `contactLastName`, `contactRole`. Update + `id`, `lifecycleStatus`, `priority`, `contactPhone`, `contactEmail`.

**Fonctions pures** :

- `validateManualLifecycle`, `allowedManualLifecycles`, `isClientJustified` (`crm/lifecycle.ts`)
- `countCompanyLifecycleFacts`, `applyCompanyLifecycleChange` (`crm/lifecycle-db.ts`)
- `parseCommercialBrief`, `serializeCommercialBrief`, `isBriefVerificationStatus` (`prospection/brief.ts`)
- `planCompanyGeocode`, `fetchNominatimHit`, `isNominatimConfigured` (`prospection/geocode.ts`)
- `formatCompanyAddress` (`prospection/map-model.ts` / `itinerary.ts`)
- `emptyToNull`, `normalizeWebsite` (form-data / dates)

**Service** : `CompanyService` (+ `MapService` pour géocode, ou sous-dossier `map/`).

**Contrats** :

```ts
function createCompany(input: {
  actor: SessionUser;
  name: string;
  address: string;
  industry?: string | null;
  city?: string | null;
  postalCode?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  source?: string | null;
  description?: string | null;
  contact?: {
    firstName: string;
    lastName: string;
    role?: string | null;
  } | null;
}): Promise<ServiceResult<{ companyId: string; name: string }>>;

function updateCompany(input: {
  actor: SessionUser;
  id: string;
  name: string;
  address: string;
  lifecycleStatus: CompanyLifecycle;
  priority: Priority;
  industry?: string | null;
  city?: string | null;
  postalCode?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  source?: string | null;
  description?: string | null;
  contact?: {
    firstName: string;
    lastName: string;
    role?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
}): Promise<ServiceResult<{ companyId: string }>>;

function updateCommercialBrief(input: {
  actor: SessionUser;
  companyId: string;
  digitalPresence?: string;
  strengths?: string;
  opportunities?: string;
  proposal?: string;
  angle?: string;
  verificationStatus?: "UNVERIFIED" | "PARTIAL" | "VERIFIED";
}): Promise<ServiceResult<{ companyId: string }>>;

function getCompany(input: {
  actor: SessionUser;
  companyId: string;
  include?: Array<
    | "contacts"
    | "lastInteraction"
    | "nextFollowUp"
    | "openOpportunities"
    | "clientFlags"
  >;
}): Promise<ServiceResult<CompanyCompact>>;

function listCompanies(input: {
  actor: SessionUser;
  scope?: "all" | "prospects" | "clients" | "to_call";
  limit?: number;
}): Promise<ServiceResult<CompanyListItem[]>>;

function getProspectionSummary(input: {
  actor: SessionUser;
}): Promise<ServiceResult<{ active: number; toContact: number; dueFollowUps: number }>>;
```

Géocode / location : extraire **après** le lot READ ; Nominatim reste l’adapter `prospection/geocode.ts`. Skip protected inchangé.

Lifecycle manuel → confirm serveur plus tard si tool WRITE (aujourd’hui **pas** de `window.confirm` sur update company).

---

### 5.2 Interaction

**Current Server Action(s)** :

| Action | Fichier |
| --- | --- |
| `createInteraction(_prev, formData)` | `src/actions/interactions.ts` |
| `recordTerrainVisit(companyId, occurredAt?)` | `src/actions/visit.ts` — **reconstruit un FormData** via `visitFormData` puis appelle `createInteraction` |
| `markCompanyVisited(_prev, formData)` | `visit.ts` — lit `companyId`, délègue |

**Lectures** : pas de `listInteractions`. Historique via `getCompanyDetail.interactions` (liste complète, non paginée). Compteurs jour : `getTodayInteractionCounts`.

**Business logic** :

- Company doit exister.
- `lifecycleAfterInteraction(current, type)` : LEAD + CALL/EMAIL/MEETING/MESSAGE → CONTACTED ; sinon no-op.
- Rattache `opportunityId` = dernière opportunité **ouverte** (`OPEN_OPPORTUNITY_STAGES`).
- `occurredAt` obligatoire (BR-006) via Zod `parseDateTimeLocal`.
- `createdById = actor.id`.
- Visite terrain : type `MEETING`, direction `INTERNAL`, result `OTHER`, notes `"Visite terrain"` (`prospection/visit.ts`) pour LEAD→CONTACTED **sans** fausser les KPI RDV (`isTerrainVisit` + filtre dans `getTodayInteractionCounts`).

**Prisma** : `company.findUnique`, `opportunity.findFirst`, tx : `interaction.create`, `applyCompanyLifecycleChange`, `activityLog.create`.

**Zod** : `createInteractionSchema` — types formulaire `CALL \| EMAIL \| MEETING \| MESSAGE \| NOTE` seulement (Prisma a aussi `QUOTE`, `PAYMENT`, `OTHER` : **non exposés**).

**ActivityLog** : `interaction.created` ; éventuellement `company.lifecycle_changed` (`reason: "interaction.created"`).

**revalidatePath** : `revalidateCrm(company.id)`.

**FormData** : oui (`companyId`, `type`, `direction`, `result`, `occurredAt`, `notes`). `recordTerrainVisit` = adapter FormData interne — **à supprimer** dès que le service existe.

**Fonctions pures** :

- `lifecycleAfterInteraction`
- `OPEN_OPPORTUNITY_STAGES`
- `buildVisitInteractionFields`, `isTerrainVisit`, constantes `VISIT_*`
- `parseDateTimeLocal`

**Service** : `InteractionService`

**Contrats** :

```ts
function createInteraction(input: {
  actor: SessionUser;
  companyId: string;
  type: "CALL" | "EMAIL" | "MEETING" | "MESSAGE" | "NOTE";
  direction: InteractionDirection;
  result?: InteractionResult | null;
  occurredAt: Date; // ISO parsé en amont
  notes?: string | null;
}): Promise<ServiceResult<{ interactionId: string; companyId: string }>>;

function recordTerrainVisit(input: {
  actor: SessionUser;
  companyId: string;
  occurredAt?: Date;
}): Promise<ServiceResult<{ interactionId: string; companyId: string }>>;
```

`recordTerrainVisit` doit appeler `createInteraction` **objet**, plus `visitFormData`.

---

### 5.3 FollowUp

**Current Server Action(s)** : `createFollowUp`, `completeFollowUp`, `rescheduleFollowUp` (`src/actions/follow-ups.ts`).

**Pas d’action** `cancelFollowUp` alors que `FollowUpStatus.CANCELED` existe.

**Lectures** : `listFollowUpBoard()`, `getFollowUpDashboard(limit = 4)`. Board : overdue / today / upcoming (`dueBucket`) + completed (take 40). **Pas de filtre `companyId`.** Listes PENDING **sans plafond**.

**Business logic** :

- Company doit exister.
- Titre = `note ?? "Relance"`.
- `opportunityId` = dernière opp. ouverte ; `priority` = `company.priority` ; `status: PENDING`.
- Complete : no-op si déjà `COMPLETED` ; refuse si pas `PENDING` ; pose `completedAt = new Date()` (BR-007).
- Reschedule : `PENDING` only ; metadata `fromDueAt` / `toDueAt` ISO.

**Prisma** : `company`, `opportunity`, `followUp`, `activityLog`.

**Zod** : `createFollowUpSchema` (`companyId`, `dueAt` string datetime-local, `note`), `completeFollowUpSchema`, `rescheduleFollowUpSchema`.

**ActivityLog** : `followup.created` / `followup.completed` / `followup.rescheduled`.

**revalidatePath** : `revalidateFollowUps(companyId)` (relances, /, calendrier, + crm).

**FormData** : oui.

**Fonctions pures** : `dueBucket`, `OPEN_OPPORTUNITY_STAGES`, `parseDateTimeLocal`. **Pas** de règle « relance manquante » (le multi-action IA l’inventera sinon).

**Service** : `FollowUpService`

**Contrats** :

```ts
function createFollowUp(input: {
  actor: SessionUser;
  companyId: string;
  dueAt: Date;
  title?: string | null; // aujourd’hui champ formulaire `note`
}): Promise<ServiceResult<{ followUpId: string; companyId: string }>>;

function completeFollowUp(input: {
  actor: SessionUser;
  followUpId: string;
}): Promise<ServiceResult<{ followUpId: string; companyId: string }>>;

function rescheduleFollowUp(input: {
  actor: SessionUser;
  followUpId: string;
  dueAt: Date;
}): Promise<ServiceResult<{ followUpId: string; companyId: string }>>;

function listFollowUps(input: {
  actor: SessionUser;
  bucket?: "overdue" | "today" | "upcoming" | "completed";
  companyId?: string;
  limit?: number;
}): Promise<ServiceResult<FollowUpListItem[] | FollowUpBoard>>;
```

`cancelFollowUp` : **ne pas inventer** dans le premier lot (pas d’action actuelle).

---

### 5.4 Opportunity

**Current Server Action(s)** : `createOpportunity`, `updateOpportunityStage` (`src/actions/opportunities.ts`).

**Lectures** : `listPipelineBoard()`, `getPipelineOverview()`. Board charge **toutes** les opportunités (pas de pagination). Overview : `groupBy` + open rows pour BR-017 (`weightedValue` × `effectiveProbability`). Totaux board en **`number`** (via `Number(decimal.toString())`) — écart avec money bigint ailleurs.

**Business logic** :

- Create : stages **ouverts seulement** (Zod `OPEN_OPPORTUNITY_STAGES`) ; `probabilityForWrite(stage, override)` ; `source = company.source` ; `opportunityStageHistory` from `null` ; `lifecycleAfterOpportunityCreated` (LEAD/CONTACTED/QUALIFIED → OPPORTUNITY).
- `stageTimestamps` : WON → `wonAt`, LOST → `lostAt` (create n’expose pas WON/LOST).
- Update : no-op si même stage ; `probabilityForWrite(stage)` (override ignoré) ; LOST exige `lostReason` (BR-005, Zod superRefine) ; history ; `countCompanyLifecycleFacts` **après** update stage puis `nextLifecycleAfterOpportunityStageChange` (WON → CLIENT ; quitter WON ne rétrograde un CLIENT justifié — H14/H15).
- **Pas de confirm UI** sur WON/LOST (contrairement aux devis).

**Prisma** : `company`, `opportunity`, `opportunityStageHistory`, `activityLog` + lifecycle company.

**Zod** : `createOpportunitySchema` (montant **string** `"12,5"`), `updateOpportunityStageSchema`.

**ActivityLog** : `opportunity.created`, `opportunity.stage_changed` (+ `company.lifecycle_changed`).

**revalidatePath** : `revalidatePipeline(companyId)`.

**FormData** : oui (`companyId`, `title`, `estimatedValue`, `stage`, `probability` / `opportunityId`, `lostReason`).

**Fonctions pures** :

- `probabilityForWrite`, `effectiveProbability`, `weightedValue`, `STAGE_PROBABILITY`
- `lifecycleAfterOpportunityCreated`, `nextLifecycleAfterOpportunityStageChange`, `lifecycleAfterWon`, `lifecycleAfterLeavingWon`
- `isOpenOpportunityStage`, `OPEN_OPPORTUNITY_STAGES`
- `weightedMoney` (`money.ts`) — **non utilisé** par le pipeline actuel (number)

**Service** : `OpportunityService`

**Contrats** :

```ts
function createOpportunity(input: {
  actor: SessionUser;
  companyId: string;
  title: string;
  estimatedValue: string; // Decimal string normalisée, pas number
  stage: (typeof OPEN_OPPORTUNITY_STAGES)[number];
  probability?: number | null;
}): Promise<ServiceResult<{ opportunityId: string; companyId: string }>>;

function updateOpportunityStage(input: {
  actor: SessionUser;
  opportunityId: string;
  stage: OpportunityStage;
  lostReason?: string | null;
}): Promise<ServiceResult<{ opportunityId: string; companyId: string }>>;
// WON / LOST = CRITICAL pour l’agent (même fonction métier, autre permission).

function getPipeline(input: {
  actor: SessionUser;
  openOnly?: boolean;
}): Promise<ServiceResult<{ overview: PipelineOverview; board?: PipelineColumn[] }>>;
```

---

### 5.5 Quote — **CRITICAL WRITE** (hors premier lot)

**Current Server Action(s)** : `createQuote`, `updateQuoteStatus` (`src/actions/quotes.ts`).

**Lectures** : `listQuotes()`, `getSignedRevenue()` (`queries/quotes.ts`) — liste entière, montant `toString()`.

**Business logic** :

- Devis lié à une Opportunity **de la même Company**.
- Référence optionnelle → `DEV-{annéeParis}-NNN` via `parisParts` + `quote.count` (**hors transaction** : course possible).
- Création `DRAFT` ; si opp ouverte et stage ≠ `QUOTE` → pousse stage `QUOTE` + history + `opportunity.stage_changed`.
- Transitions dures dans l’action :

```
DRAFT → SENT
SENT → VIEWED | ACCEPTED | REJECTED
VIEWED → ACCEPTED | REJECTED
ACCEPTED / REJECTED / EXPIRED → []
```

- `SENT` pose `sentAt` ; `ACCEPTED` pose `acceptedAt`.
- **ACCEPTED** + opp ≠ WON → opp WON + `lifecycleAfterWon` (CLIENT) + logs. C’est le chemin CA signé.

**Prisma** : `opportunity`, `quote`, `opportunityStageHistory`, `company` (via include), `activityLog`.

**Zod** : `createQuoteSchema` (TTC > 0 string), `updateQuoteStatusSchema` (`QUOTE_STATUSES` — EXPIRED accepté par Zod mais **pas** par `ALLOWED_TRANSITIONS`).

**ActivityLog** : `quote.created`, `quote.status_changed`, éventuellement `opportunity.stage_changed`, `company.lifecycle_changed` (`reason: "quote.accepted"`).

**revalidatePath** : `revalidateQuotes(companyId)` (devis, finances, analytics, /, pipeline, crm).

**FormData** : oui. Confirm UI seulement : ACCEPTED / REJECTED (`SENSITIVE_ACTION_CONFIRMS.quoteAccepted/Rejected`) — **cosmétique**, le serveur exécute dès l’action authentifiée.

**Fonctions pures** : `isOpenOpportunityStage`, `probabilityForWrite`, `lifecycleAfterWon`, `parisParts`.

**Service** : `QuoteService` (extraction **après** P0/P1 ; ACCEPTED = CRITICAL).

**Contrats** :

```ts
function createQuote(input: {
  actor: SessionUser;
  companyId: string;
  opportunityId: string;
  amountIncTax: string;
  reference?: string | null;
}): Promise<ServiceResult<{ quoteId: string; companyId: string; opportunityId: string }>>;

function updateQuoteStatus(input: {
  actor: SessionUser;
  quoteId: string;
  status: QuoteStatus;
}): Promise<ServiceResult<{ quoteId: string; companyId: string; opportunityId: string }>>;

function listQuotes(input: {
  actor: SessionUser;
  status?: QuoteStatus;
  companyId?: string;
  limit?: number;
}): Promise<ServiceResult<QuoteListItem[]>>;
```

---

### 5.6 Project — create / COMPLETED / ARCHIVED = **CRITICAL**

**Current Server Action(s)** : `createProject`, `updateProjectStatus` (`src/actions/projects.ts`).

**Lectures** : `listProjects()`, `getProjectDetail(id)` (hub : tâches, jalons, activity, repos, quotes, payments, finance, documents).

**Business logic** :

- Create : company **CLIENT** obligatoire ; `quoteId` optionnel → devis ACCEPTED de la même company, `projectId` encore null ; copie `opportunityId` du devis ; lie `quote.projectId`.
- Transitions :

```
PLANNED → ACTIVE
ACTIVE → WAITING_CLIENT | REVIEW | COMPLETED
WAITING_CLIENT → ACTIVE | REVIEW     // BR-019
REVIEW → ACTIVE | COMPLETED
COMPLETED → ARCHIVED
ARCHIVED → []
```

- COMPLETED pose `completedAt`. Confirm UI COMPLETED / ARCHIVED only.

**Prisma** : `company`, `quote`, `project`, `activityLog`.

**Zod** : `createProjectSchema` (dates `parseDate`, montant string optionnel, `status` parmi `PROJECT_STATUSES`), `updateProjectStatusSchema`.

**ActivityLog** : `project.created`, `project.status_changed`.

**revalidatePath** : `revalidateProjects(companyId, projectId)` (projets, taches, clients, finances, /, calendrier, crm, fiche projet).

**FormData** : oui.

**Fonctions pures** : `projectProgress` (`crm/constants.ts`), `selectPrincipalProject` (`projects/principal.ts`) — utilisés en **lecture** hub, pas dans l’action create.

**Service** : `ProjectService`

**Contrats** :

```ts
function createProject(input: {
  actor: SessionUser;
  companyId: string;
  name: string;
  status: ProjectStatus;
  startDate?: Date | null;
  dueDate?: Date | null;
  amount?: string | null;
  description?: string | null;
  quoteId?: string | null;
}): Promise<ServiceResult<{ projectId: string; companyId: string }>>;

function updateProjectStatus(input: {
  actor: SessionUser;
  projectId: string;
  status: ProjectStatus;
}): Promise<ServiceResult<{ projectId: string; companyId: string }>>;

function listProjects(input: {
  actor: SessionUser;
  status?: ProjectStatus;
  companyId?: string;
  limit?: number;
}): Promise<ServiceResult<ProjectListItem[]>>;

function getProject(input: {
  actor: SessionUser;
  projectId: string;
}): Promise<ServiceResult<ProjectCompact>>; // pas le hub finance+docs+repos entier
```

---

### 5.7 Task

**Current Server Action(s)** : `createTask`, `updateTaskStatus` (`src/actions/tasks.ts`).

**Lectures** : `listOpenTasks()`, `getTaskDashboard(limit = 5)` (statuts `TODO | IN_PROGRESS`). `listOpenTasks` autorise déjà `project: null` / `company: null` en DTO — mais **create exige un projet**.

**Écart schéma / action (bloquant IA « rappeler Jacques »)** :

- Prisma `Task.projectId` **optionnel**, `companyId` optionnel (`onDelete: Restrict` si company).
- `createTaskSchema` : `projectId` **obligatoire**.
- Action : `companyId` / `opportunityId` copiés **depuis le projet** ; `assignedToId = actor.id`.

**Business logic** transitions :

```
TODO → IN_PROGRESS | CANCELED
IN_PROGRESS → DONE | TODO | CANCELED
DONE / CANCELED → []
```

DONE pose `completedAt`.

**Prisma** : `project`, `task`, `activityLog`.

**Zod** : `createTaskSchema`, `updateTaskStatusSchema`.

**ActivityLog** : `task.created`, `task.status_changed`.

**revalidatePath** : `revalidateProjects(companyId?, projectId?)`.

**FormData** : oui (`projectId`, `title`, `priority` défaut `"NORMAL"` si vide, `dueAt`, `description`).

**Fonctions pures** : `OPEN_TASK_STATUSES`, `projectProgress` (agrégat projet), `dueBucket` (non utilisé pour les tâches dashboard — tri `dueAt asc`).

**Service** : `TaskService` — **élargir create** (company-scoped) **avant** d’exposer un tool `createTask`.

**Contrats** :

```ts
function createTask(input: {
  actor: SessionUser;
  title: string;
  priority?: Priority;
  dueAt?: Date | null;
  description?: string | null;
  projectId?: string | null;
  companyId?: string | null;
}): Promise<ServiceResult<{ taskId: string; projectId?: string; companyId?: string }>>;
// Règle à coder : au moins companyId ou projectId ; si projectId, company = project.company.

function updateTaskStatus(input: {
  actor: SessionUser;
  taskId: string;
  status: TaskStatus;
}): Promise<ServiceResult<{ taskId: string; projectId?: string; companyId?: string }>>;

function listOpenTasks(input: {
  actor: SessionUser;
  projectId?: string;
  companyId?: string;
  dueBucket?: "overdue" | "today" | "upcoming";
  limit?: number;
}): Promise<ServiceResult<TaskListItem[]>>;
```

Premier lot READ : `listOpenTasks` / `getTaskDashboard` tels quels (projet souvent présent). L’élargissement WRITE est un **refactor métier** ciblé, pas un changement Prisma.

---

### 5.8 Milestone

**Current Server Action(s)** : `createMilestone`, `updateMilestoneStatus` (`src/actions/milestones.ts`).

**Lectures** : via `getProjectDetail.milestones` et projection calendrier (`kind: "milestone"`).

**Business logic** : projet doit exister ; create `PENDING` ; transitions `PENDING → DONE | CANCELED` ; DONE pose `completedAt`.

**Prisma** : `project`, `milestone`, `activityLog`.

**Zod** : `createMilestoneSchema` (`dueAt` = `parseDate` nullable), `updateMilestoneStatusSchema`.

**ActivityLog** : `milestone.created`, `milestone.status_changed`.

**revalidatePath** : `revalidateProjects`.

**FormData** : oui.

**Fonctions pures** : `MILESTONE_STATUSES` labels. Pas de module dédié.

**Service** : `MilestoneService`

**Contrats** :

```ts
function createMilestone(input: {
  actor: SessionUser;
  projectId: string;
  name: string;
  dueAt?: Date | null;
}): Promise<ServiceResult<{ milestoneId: string; projectId: string; companyId: string }>>;

function updateMilestoneStatus(input: {
  actor: SessionUser;
  milestoneId: string;
  status: MilestoneStatus;
}): Promise<ServiceResult<{ milestoneId: string; projectId: string; companyId: string }>>;
```

Hors premier lot READ (peu utile au briefing du jour sauf via calendrier déjà fusionné).

---

### 5.9 Calendar

**Current Server Action(s)** : `createCalendarEvent`, `updateCalendarEvent` (`src/actions/calendar-events.ts`). **Pas de delete.**

**Lectures** : `listCalendarItems(rangeStart, rangeEnd)`, `getTodayAgenda()`, `listCalendarLinkTargets()` (options de selects — **ne pas** donner à l’agent).

Fusion (`mergeCalendarItems`) : CalendarEvent + FollowUp PENDING + Task ouvertes avec `dueAt` + Project dueDate (hors COMPLETED/ARCHIVED) + Milestone PENDING + **TourStop** via `tourStopsToCalendarItems`. Visites : `editable: false`, `kind: "terrain_visit"`. Items projetés relances/tâches/jalons/projets : `editable: false`. DTO `CalendarItem` contient `href` / `secondaryHref` **UI**.

**Business logic écriture** :

- `resolveLinks` : company/projet doivent exister ; projet doit appartenir à l’entreprise si les deux sont fournis ; sinon company déduite du projet.
- Bornes Paris : all-day → `startOfParisDay` / `endOfParisDay` ; fin ≥ début (Zod).
- Types : `CALENDAR_EVENT_TYPES` (CALL, FOLLOW_UP, MEETING, TASK, DEADLINE, DELIVERY, MAINTENANCE, ADMINISTRATIVE). **Pas** de type visite terrain — ne pas créer un `CalendarEvent` de tournée (BR-011).
- Checkbox `allDay` : `readString(formData, "allDay") === "on"`.

**Prisma** : `company`, `project`, `calendarEvent`, `activityLog` ; lectures aussi `followUp`, `task`, `milestone`, `tour`.

**Zod** : `createCalendarEventSchema`, `updateCalendarEventSchema` (strings dates + transform `Date`).

**ActivityLog** : `calendar.created`, `calendar.updated`.

**revalidatePath** : `revalidateCalendar(companyId?, projectId?)`.

**FormData** : oui.

**Fonctions pures** :

- `startOfParisDay`, `endOfParisDay`, `startOfToday`, `endOfToday`
- `mergeCalendarItems` (query — à descendre dans le service ou rester loader)
- `tourStopsToCalendarItems`, `terrainVisitTitle` (`calendar/terrain-visits.ts`)
- `calendar/dates.ts` (grille UI — pas nécessaire au service métier)

**Service** : `CalendarService`

**Contrats** :

```ts
function createCalendarEvent(input: {
  actor: SessionUser;
  title: string;
  type: CalendarEventType;
  allDay: boolean;
  startsAt: Date;
  endsAt: Date;
  companyId?: string | null;
  projectId?: string | null;
}): Promise<ServiceResult<{ calendarEventId: string; companyId?: string; projectId?: string }>>;

function updateCalendarEvent(input: {
  actor: SessionUser;
  id: string;
  title: string;
  type: CalendarEventType;
  allDay: boolean;
  startsAt: Date;
  endsAt: Date;
  companyId?: string | null;
  projectId?: string | null;
}): Promise<ServiceResult<{ calendarEventId: string; companyId?: string; projectId?: string }>>;

function listCalendarItems(input: {
  actor: SessionUser;
  from: Date;
  to: Date;
}): Promise<ServiceResult<CalendarItem[]>>;
```

Tool READ : omettre `href` / `secondaryHref` ; refuser `kind` visites comme événements éditables.

---

### 5.10 Tour

**Current Server Action(s)** (`src/actions/tours.ts`) :

| Action | FormData | Zod | ActivityLog |
| --- | --- | --- | --- |
| `ensureTodayTour()` | **non** | non | `tour.ensured` **à chaque appel** (même upsert no-op) |
| `addCompanyToTodayTour` | `companyId` | non | `tour.stop_added` seulement si nouveau |
| `removeCompanyFromTodayTour` | `companyId` | non | `tour.stop_removed` |
| `moveTourStop` | `companyId`, `direction` (`up` → -1 sinon +1) | non | **aucun** |
| `markTourStopVisited` | `companyId` | non | `tour.stop_visited` (+ `interaction.created` via visite) |
| Wrappers `*Form(formData)` | oui | — | délèguent |

**Lectures** : `getTodayTour()`, `getTourDashboard()`, `listCompaniesForTourPicker()` (take 200, options UI). `getTodayVisitCompanyIds()` sans auth — à rentrer dans le service.

**Business logic** :

- Vérité terrain = `Tour` / `TourStop` (`date` = `tourDateFor()` = `startOfToday` Paris). Un tour / jour civil.
- Règles pures : `addCompanyToStops` (pas de doublon), `removeCompanyFromStops` + resequence, `moveStop`, `markStopVisited`.
- `markTourStopVisited` : d’abord `recordTerrainVisit` (interaction) ; **puis** `tourStop.updateMany` `visitedAt`. Si pas de tour du jour, l’interaction peut quand même être créée. Message d’erreur si visite OK mais tournée KO.
- Retrait : confirm UI `removeTourCompany` seulement.

**Prisma** : `tour.upsert` / `findUnique`, `tourStop`, `company`, `activityLog`.

**Zod** : **aucun**. IDs bruts.

**revalidatePath** : `revalidateCrm(companyId?)` via helper local `revalidateTour`.

**FormData** : oui sauf `ensureTodayTour`.

**Fonctions pures** : tout `src/lib/prospection/tour.ts` ; `visit.ts` ; `tourStopsToCalendarItems`.

**Service** : `TourService`

**Contrats** :

```ts
function ensureTodayTour(input: {
  actor: SessionUser;
  now?: Date;
}): Promise<ServiceResult<{ tourId: string }>>;

function addCompanyToTodayTour(input: {
  actor: SessionUser;
  companyId: string;
}): Promise<ServiceResult<{ tourId: string; companyId: string }>>;

function removeCompanyFromTodayTour(input: {
  actor: SessionUser;
  companyId: string;
}): Promise<ServiceResult<{ companyId: string }>>; // CRITICAL côté agent

function moveTourStop(input: {
  actor: SessionUser;
  companyId: string;
  direction: -1 | 1;
}): Promise<ServiceResult<{ companyId: string }>>;

function markTourStopVisited(input: {
  actor: SessionUser;
  companyId: string;
  occurredAt?: Date;
}): Promise<ServiceResult<{ companyId: string; interactionId?: string }>>;

function getTodayTour(input: {
  actor: SessionUser;
  now?: Date;
}): Promise<ServiceResult<TodayTour | null>>;

function getTourDashboard(input: {
  actor: SessionUser;
  now?: Date;
}): Promise<ServiceResult<TourDashboard>>;
```

À corriger à l’extraction : ne logger `tour.ensured` que si **création** ; logger `tour.stop_moved` (aujourd’hui silencieux).

---

### 5.11 Finance / Payment — **WRITE CRITICAL (BR-015), READ snapshot P0**

**Current Server Action(s)** : `createPayment`, `updatePaymentStatus` (`src/actions/payments.ts`).

**Lectures** : `getFinanceSnapshot(scope?)`, `listPayments(scope?)`, `listPaymentFormOptions` (selects UI — **pas** pour tools). Scope `{ companyId?, projectId? }`. OVERDUE **dérivé** (`effectivePaymentStatus` + `dueBucket`), pas seulement la colonne Prisma.

**Business logic create** :

- Company obligatoire.
- `quoteId` optionnel : même company, statut **ACCEPTED** uniquement.
- `projectId` = input ou `quote.projectId` ; cohérence company / devis.
- Plafond TTC : `quotePaymentCapacity` (paiements non `CANCELED`).
- Create Zod : statut `PENDING | PAID` seulement (`CREATE_PAYMENT_STATUSES`).
- `persistPaymentStatus` peut persister `OVERDUE` si dueAt dépassée.
- `paidAt` si PAID.

**Update** : `PAYMENT_STATUS_TRANSITIONS` ; PAID / CANCELED **terminaux** ; PENDING re-dérive OVERDUE. Log `payment.marked_paid` si PAID sinon `payment.status_changed`.

Confirm UI : PAID / CANCELED only — cosmétique.

**Prisma** : `company`, `quote`, `project`, `payment`, `activityLog`.

**Zod** : `createPaymentSchema`, `updatePaymentStatusSchema` (montant `isPositiveMoneyString`).

**ActivityLog** : `payment.created`, `payment.marked_paid`, `payment.status_changed`.

**revalidatePath** : `revalidateFinances(companyId, projectId?)`.

**FormData** : oui.

**Fonctions pures** : `computeFinanceTotals`, `quotePaymentCapacity`, `persistPaymentStatus`, `effectivePaymentStatus`, `PAYMENT_STATUS_TRANSITIONS`, tout `money.ts` (bigint centimes). **Interdit** : `number` pour le CA.

**Service** : `FinanceService`

**Contrats** :

```ts
function getFinanceSnapshot(input: {
  actor: SessionUser;
  companyId?: string;
  projectId?: string;
  now?: Date;
}): Promise<ServiceResult<FinanceTotals>>;

function listPayments(input: {
  actor: SessionUser;
  companyId?: string;
  projectId?: string;
  status?: PaymentStatus;
  limit?: number;
  now?: Date;
}): Promise<ServiceResult<PaymentListItem[]>>;

function createPayment(input: {
  actor: SessionUser;
  companyId: string;
  label: string;
  amount: string;
  status: "PENDING" | "PAID";
  quoteId?: string | null;
  projectId?: string | null;
  dueAt?: Date | null;
  paidAt?: Date | null;
  externalReference?: string | null;
}): Promise<ServiceResult<{ paymentId: string; companyId: string; projectId?: string; quoteId?: string }>>;

function updatePaymentStatus(input: {
  actor: SessionUser;
  paymentId: string;
  status: PaymentStatus;
}): Promise<ServiceResult<{ paymentId: string; companyId: string }>>;
```

**Premier lot : uniquement `getFinanceSnapshot` (et éventuellement list bornée). create/update hors extraction V1 agent.**

---

### 5.12 Maintenance — **WRITE CRITICAL (MRR)**

**Current Server Action(s)** : `createMaintenanceContract`, `updateMaintenanceContract`, `updateMaintenanceStatus` (`src/actions/maintenance.ts`).

**Lectures** : `listMaintenanceOverview(now)`, `listMaintenanceContractsForCompany`, `listMaintenanceAssociationOptions` (UI). MRR : `computeMrr`. Pas de Payment auto (commentaire query). `CANCELED` existe en enum Prisma / Zod mais **pas** dans `MAINTENANCE_STATUS_TRANSITIONS` exposées (`ACTIVE ↔ PAUSED → ENDED`).

**Business logic** :

- Create : status `ACTIVE`, `normalizeMoney(monthlyAmount)`, projet optionnel même company.
- Update : peut changer `companyId` (revalidate les deux).
- Status ENDED : `maintenanceTerminationDate(existingEnd, startOfToday())`.
- Confirm UI activate / pause / end.

**Prisma** : `company`, `project`, `maintenanceContract`, `activityLog`.

**Zod** : `createMaintenanceContractSchema`, `updateMaintenanceContractSchema`, `updateMaintenanceStatusSchema`.

**ActivityLog** : `maintenance.created`, `maintenance.updated`, `maintenance.status_changed`.

**revalidatePath** : `revalidateMaintenance`.

**FormData** : oui.

**Fonctions pures** : `canTransitionMaintenanceStatus`, `maintenanceTerminationDate`, `computeMrr`, `nextMaintenanceDueDate`, `isUpcomingMaintenanceDue`, `normalizeMoney`.

**Service** : `MaintenanceService`

**Contrats** :

```ts
function listMaintenance(input: {
  actor: SessionUser;
  companyId?: string;
  now?: Date;
}): Promise<ServiceResult<MaintenanceOverview | MaintenanceContractItem[]>>;

function createMaintenanceContract(input: {
  actor: SessionUser;
  companyId: string;
  monthlyAmount: string;
  startDate: Date;
  endDate?: Date | null;
  projectId?: string | null;
  description?: string | null;
}): Promise<ServiceResult<{ maintenanceContractId: string; companyId: string }>>;

function updateMaintenanceContract(input: {
  actor: SessionUser;
  id: string;
  companyId: string;
  monthlyAmount: string;
  startDate: Date;
  endDate?: Date | null;
  projectId?: string | null;
  description?: string | null;
}): Promise<ServiceResult<{ maintenanceContractId: string; companyId: string }>>;

function updateMaintenanceStatus(input: {
  actor: SessionUser;
  contractId: string;
  status: MaintenanceStatus;
}): Promise<ServiceResult<{ maintenanceContractId: string; companyId: string }>>;
```

READ overview OK plus tard ; WRITE hors premier lot.

---

### 5.13 Documents

**Current Server Action(s)** : `createDocument`, `updateDocument` (`src/actions/documents.ts`). **Pas de delete. Pas d’upload. Pas de fetch d’URL.**

**Lectures** : `listDocuments`, `listDocumentsForCompany`, `listDocumentsForProject`, `listDocumentAssociationOptions` (UI). DTO inclut `url`.

**Business logic** : `resolveDocumentLinks` — projet gagne (company + `opportunityId` du projet) ; company seule ; ou orphelin (`companyId/projectId` null). URL http(s) only (ADR-007) via `normalizeWebsite` + refine.

**Prisma** : `project`, `company`, `document`, `activityLog`.

**Zod** : `createDocumentSchema`, `updateDocumentSchema`.

**ActivityLog** : `document.created`, `document.updated`.

**revalidatePath** : `revalidateDocuments` (et les deux côtés si re-lien).

**FormData** : oui.

**Fonctions pures** : `normalizeWebsite`, `DOCUMENT_TYPES`.

**Service** : `DocumentService`

**Contrats** :

```ts
function createDocument(input: {
  actor: SessionUser;
  name: string;
  type: DocumentType;
  url: string;
  companyId?: string | null;
  projectId?: string | null;
}): Promise<ServiceResult<{ documentId: string; companyId?: string; projectId?: string }>>;

function updateDocument(input: {
  actor: SessionUser;
  id: string;
  name: string;
  type: DocumentType;
  url: string;
  companyId?: string | null;
  projectId?: string | null;
}): Promise<ServiceResult<{ documentId: string }>>;

function listDocuments(input: {
  actor: SessionUser;
  companyId?: string;
  projectId?: string;
  limit?: number;
}): Promise<ServiceResult<DocumentRecord[]>>;
```

Tool : métadonnées OK ; **ne pas fetcher** `url`. Hors premier lot WRITE.

---

### 5.14 GitHub — **unlink = CRITICAL (delete réel)**

**Current Server Action(s)** : `associateGitHubRepository`, `unlinkGitHubRepository` (`src/actions/repositories.ts`).

**Lectures** : `getGitHubOverview()`, `getGitHubProjectSnapshot(repos)` (`queries/github.ts`) → adapter `src/lib/integrations/github.ts` (timeout 8 s, token serveur). Association locale possible **sans** token (`isGitHubConfigured()`).

**Business logic associate** :

- `parseGitHubRepositoryRef` (`owner/name`, URL, SSH).
- Un repo GitHub = un projet (lookup insensible à la casse + P2002).
- Si configuré : `fetchGitHubRepository` ; erreur live → refuse.
- Persiste `lastSyncedAt` si live (BR-014).

Unlink : `repository.delete` — **seule suppression métier persistée** avec `TourStop`. Confirm UI only.

**Prisma** : `project`, `repository`, `activityLog`. EntityType log = `"Project"`.

**Zod** : `associateRepositorySchema`, `unlinkRepositorySchema` + parseur pur.

**ActivityLog** : `repository.linked`, `repository.unlinked`.

**revalidatePath** : `revalidateGithub` → `/github` + `revalidateProjects`.

**FormData** : oui.

**Fonctions pures / adapter** : `parseGitHubRepositoryRef`, `fetchGitHubRepository`, `fetchGitHubRepositoryActivity`, `isGitHubConfigured`. **Jamais** `getGitHubToken()` dans un DTO / log / contexte LLM.

**Service** : `GitHubService`

**Contrats** :

```ts
function getGitHubOverview(input: {
  actor: SessionUser;
  projectId?: string;
}): Promise<ServiceResult<GitHubOverview>>; // commits OK, token interdit

function associateGitHubRepository(input: {
  actor: SessionUser;
  projectId: string;
  repository: string; // owner/name ou URL
}): Promise<ServiceResult<{ repositoryId: string; projectId: string; companyId: string }>>;

function unlinkGitHubRepository(input: {
  actor: SessionUser;
  repositoryId: string;
}): Promise<ServiceResult<{ repositoryId: string; projectId: string }>>;
```

Hors premier lot WRITE. READ overview possible après Today/Search si le token ne fuit pas.

---

### 5.15 Search (transversal, pas un domaine table)

**Current Server Action** : `searchGlobal(query: string)` (`src/actions/search.ts`) — **pas de FormData**, `requireActor`, catch → `emptySearchResults`.

**Loader** : `searchWorkspace` (`queries/search.ts`) — **`requireAuthenticatedUser()` redirect** + Prisma.

**Règles pures** (`crm/search.ts`) : 2–80 chars, 6 hits / kind, kinds `company | contact | project | opportunity | document`. **Pas** Task, Quote, FollowUp, Payment.

Hits portent `href` UI.

**Service** : `SearchService` — **premier candidat d’extraction** (déjà objet, risque bas). Ce n’est **pas** le premier slice IA utilisateur (`getTodayOverview`). Le tool V1 `searchCompanies` appelle `searchWorkspace` en projection entreprises seulement (le tool global `searchWorkspace` reste hors V1 agent).

```ts
function searchWorkspace(input: {
  actor: SessionUser;
  query: string;
}): Promise<ServiceResult<SearchResults>>;
```

Pour tools : ajouter `companyId` sur les hits contact/opportunity ; optionnellement kinds follow-up/task plus tard. Ne pas se contenter de `href`.

---

## 6. Matrice rapide Auth / Zod / FormData / Log / Revalidate

| Domaine | Actions | Zod | FormData | ActivityLog | Revalidate helper | Risque 1er lot |
| --- | --- | --- | --- | --- | --- | --- |
| Today | — | — | — | lecture | — | P0 |
| Search | `searchGlobal` | search.ts pur | non | — | — | P0 |
| Company | create/update + brief + map | company ; brief/map **non** | oui | `company.*` | `revalidateCrm` | P0 read / P1 write fiche |
| Interaction | create + visit adapters | interaction | oui (+ FormData interne visite) | `interaction.created` | `revalidateCrm` | P1 |
| FollowUp | create/complete/reschedule | follow-up | oui | `followup.*` | `revalidateFollowUps` | P0 read / P1 write |
| Opportunity | create / stage | opportunity | oui | `opportunity.*` | `revalidatePipeline` | P0 read / P1 write ouvert ; WON/LOST P2 |
| Quote | create / status | quote | oui | `quote.*` | `revalidateQuotes` | P2 (ACCEPTED) |
| Project | create / status | project | oui | `project.*` | `revalidateProjects` | P2 |
| Task | create / status | task (`projectId` requis) | oui | `task.*` | `revalidateProjects` | P0 read / P1 write après élargissement |
| Milestone | create / status | milestone | oui | `milestone.*` | `revalidateProjects` | plus tard |
| Calendar | create / update | calendar-event | oui | `calendar.*` | `revalidateCalendar` | P0 read / P1 write |
| Tour | ensure/add/remove/move/visit | **non** | mixte | `tour.*` (move = silence) | `revalidateCrm` | P0 read / P1 write add/move ; remove P2 |
| Finance | create / status | payment | oui | `payment.*` | `revalidateFinances` | P0 snapshot / P2 write |
| Maintenance | create/update/status | maintenance | oui | `maintenance.*` | `revalidateMaintenance` | P2 write |
| Documents | create / update | document | oui | `document.*` | `revalidateDocuments` | plus tard |
| GitHub | associate / unlink | repository | oui | `repository.*` | `revalidateGithub` | P2 write ; READ après |

Auth mutations : `requireActor` partout (sauf visite qui délègue). Auth lectures : `requireAuthenticatedUser` partout (sauf `getTodayVisitCompanyIds`).

---

## 7. Problèmes structurels découverts

1. **Pas de couche service.** Prisma + règles + FormData + cache Next collés dans les actions. Queries collées au `redirect`.
2. **`requireAuthenticatedUser()` dans chaque query** (9 appels sur le dashboard). Inutilisable depuis `/api/ai/*` ou un tool.
3. **Zod FormData-string** vs besoin ISO/objets. Deux schémas devront converger vers un type interne unique.
4. **`logActivity` mort.** Les services doivent logger dans `tx`.
5. **Confirmations sensibles = `window.confirm` seulement** (`confirm-sensitive-action.ts`). Le serveur ne reçoit aucun token. Un tool WRITE finance contournerait BR-015 tant que la politique n’est pas serveur.
6. **`recordTerrainVisit` est un adapter FormData** autour de `createInteraction`. Première dette à tuer dès `InteractionService`.
7. **Tours / map sans Zod.** IDs et lat/lng parsés à la main.
8. **`ensureTodayTour` journalise à chaque upsert** ; `moveTourStop` ne journalise pas.
9. **`createTask` exige un projet** alors que Prisma autorise une tâche company-only. Bloque le scénario « tâche pour Jacques ».
10. **Pas de `cancelFollowUp`** malgré `CANCELED`.
11. **`getCompanyDetail` / `getProjectDetail` / analytics** trop gros pour un LLM. Today compose déjà des DTOs plus petits — s’en inspirer.
12. **Search** : `href` comme identifiant de navigation ; kinds incomplets ; double auth (actor + redirect).
13. **Pipeline totaux en `number`**, finances en strings Decimal. À unifier vers `money.ts` quand on touche opportunity/finance.
14. **`nextQuoteReference` hors transaction.**
15. **`User.role` jamais appliqué.**
16. **`getTodayVisitCompanyIds` Prisma sans auth.**
17. Types interaction Prisma `QUOTE`/`PAYMENT`/`OTHER` non exposés par Zod — ne pas les « ouvrir » par accident dans un tool.

---

## 8. Ordre recommandé — 8 premiers services (bas risque, tools READ)

Deux axes distincts — ne pas les confondre :

| Axe | Premier | Pourquoi |
| --- | --- | --- |
| **Extraction (risque / code)** | `SearchService.searchWorkspace` puis `ActivityService` | Déjà objet / petites queries ; retirer le `redirect` ; zéro composition métier. |
| **Premier slice IA visible** | tool `getTodayOverview` → `TodayService.getTodayOverview` | Briefing opérateur ; premier contrat tool à évaluer, pas forcément le premier fichier à extraire. |

`TodayService` peut donc être le **3e** service extrait et pourtant le **premier** tool utilisateur. Extraire Search/Activity n’ouvre pas de chat : ça débloque les loaders sans redirect dont Today a besoin.

Priorité **produit** à débloquer (tools) : today overview, search entreprises, company compact, follow-ups, tasks, calendar, tour, pipeline, finance snapshot, recent activity.

**Préalable transversal (pas un dossier métier)** : `requireRequestActor()` + loaders **sans** `redirect`. Sans ça, extraire un service qui rappelle `getPipelineOverview()` actuelle ne sert pas les Route Handlers. Plafond WRITE agent (plus tard) : **défaut 3** (ADR-014).

| # | Service | Pourquoi c’est le plus facile | Débloque |
| --- | --- | --- | --- |
| 1 | `SearchService.searchWorkspace` | Déjà `query: string`, règles pures isolées, une action fine. Retirer le redirect du loader. | tool `searchWorkspace` / `searchCompanies` |
| 2 | `ActivityService` | 2 petites queries, pas de FormData, pas de metadata secrets. | tool `getRecentActivity` + compteurs jour |
| 3 | `TodayService.getTodayOverview` | Pure composition des queries **une fois** auth sortie. Aucune nouvelle règle. | tool `getTodayOverview` |
| 4 | `FollowUpService` (READ d’abord, WRITE juste après) | Board + dashboard clairs ; writes Zod + tx simples ; pas d’argent. | tools `listFollowUps`, plus tard create/complete/reschedule |
| 5 | `CompanyService` READ compact + `listCompanies` / `getProspectionSummary` | Listes déjà DTOisées ; **ne pas** extraire `getCompanyDetail` tel quel — projection `include?`. Enrichit `searchCompanies` (contact / lifecycle) ; le search texte reste `SearchService`. | tools `getCompany`, enrichissement `searchCompanies`, plus tard `listClients` |
| 6 | `TaskService` READ (`listOpenTasks`, dashboard) | Query déjà propre ; `project` nullable en lecture. | tool `listTasks` |
| 7 | `CalendarService.listCalendarItems` + `TourService.getTodayTour` / dashboard | Fusion calendrier déjà isolée ; tournée lecture simple (`tourDateFor`). Géocode/WRITE tournée plus tard. | tools `listCalendarItems`, `getTodayTour` |
| 8 | `OpportunityService.getPipeline` + `FinanceService.getFinanceSnapshot` | Lectures agrégées déjà là ; **aucun** WRITE quote/payment. | tools `getPipeline`, `getFinanceSnapshot` (dans Today et seuls) |

Hors ces 8, mais **prochains writes faciles** (P1, pas CRITICAL) : `FollowUpService` mutations, `InteractionService` (+ tuer FormData visite), `CalendarService` create/update, `TourService.ensure/add/move/markVisited`, `CompanyService.create/update`.

**Ne pas extraire en premier** (documentés ci-dessus, BR-015) :

- `createPayment` / `updatePaymentStatus`
- `updateQuoteStatus` surtout `ACCEPTED`
- `createQuote` (peut pousser QUOTE)
- `createProject` / COMPLETED / ARCHIVED
- maintenance WRITE
- GitHub associate/unlink
- `removeCompanyFromTodayTour`
- `updateOpportunityStage` vers WON/LOST

Ces WRITE peuvent quand même **descendre en services** plus tard pour l’UI (même code que l’agent) ; l’agent ne les appelle pas sans confirm serveur.

---

## 9. Recette d’extraction (quand on touchera `src/`)

Pour un WRITE pilote (ex. follow-up), sans changer le comportement UI :

1. Types `ServiceResult` + `actor` en argument.
2. Copier la transaction Prisma + ActivityLog **hors** `revalidatePath` / `readString`.
3. Zod objet (Date / enums) ; l’action continue de parser FormData vers ce type.
4. Action : `requireActor` → parse FormData → `service({ actor, ... })` → `revalidate*` → map `ActionResult`.
5. Query : cesser `requireAuthenticatedUser` à l’intérieur si le service / la page a déjà l’acteur ; ou `load*` privé.
6. Tests : rester sur les pures existantes ; ajouter des tests service avec Prisma **seulement** quand une harness existera (hors ce blueprint).
7. Ne pas créer `src/ai/` ni Mastra dans cette extraction.

---

## 10. Alignement ADR-014 / BR-015

| Principe | Application ici |
| --- | --- |
| UI → services → Prisma | Actions = adapters FormData + `revalidatePath` |
| AI → tools → services → Prisma | Tools n’importent pas `prisma` |
| Pas de FormData dans les services | `recordTerrainVisit` cesse de fabriquer un `FormData` |
| ActivityLog dans WRITE services | Dans la `tx`, `actor.id` ; plus tard `metadata.source` |
| CRITICAL plus tard | **Écritures** finance / devis ACCEPTED / deletes / GitHub unlink / WON/LOST / maintenance / createProject. `FinanceService.getFinanceSnapshot` = READ agrégats |
| BR-015 | L’IA ne valide pas seule un paiement / suppression / changement critique / envoi externe — donc ces services existent pour l’UI d’abord, catalogue tools fail-closed ensuite |
| Noms services | `XxxService.methodName` partagés avec `docs/VERSATECH-AI-TOOLS-V1.md` |
| Extraction vs slice IA | Search/Activity d’abord (risque) ; premier tool utilisateur = `TodayService.getTodayOverview` |
| Acteur | `requireRequestActor` → session ; service reçoit `actor`, pas `ToolContext` |
| Plafond WRITE | défaut **3** (ADR-014), hors extraction V1 |
| Europe/Paris | `dates.ts` uniquement |
| Money | `money.ts` bigint ; snapshot finance déjà correct |

---

## Annexe — Fichiers inspectés (blueprint)

**Docs** : `VERSATECH-AI-AUDIT.md`, `14-ADR-REGISTER.md`, `04-TECHNICAL-ARCHITECTURE.md`, `08-SECURITY.md`, `11-BUSINESS-RULES.md`, `AGENTS.md` (non modifié).

**Actions** : `auth`, `companies`, `interactions`, `follow-ups`, `opportunities`, `quotes`, `payments`, `projects`, `tasks`, `milestones`, `calendar-events`, `maintenance`, `documents`, `tours`, `visit`, `map`, `brief`, `search`, `repositories`.

**Queries** : `companies`, `clients`, `follow-ups`, `opportunities`, `quotes`, `payments`, `projects`, `calendar`, `activity`, `tours`, `map`, `search`, `documents`, `maintenance`, `github`, `analytics` (hors 8 premiers services).

**CRM / auth / domaine** : `actor`, `activity`, `activity-labels`, `action-result`, `lifecycle`, `lifecycle-db`, `probability`, `constants`, `revalidate`, `form-data`, `search`, `confirm-sensitive-action` ; `auth/{dal,guard,actor via crm,session,types}` ; `dates.ts`, `money.ts`, `finance.ts` ; `calendar/*` ; `prospection/{tour,visit,brief,geocode,map-model,today-visits}` ; `projects/principal.ts` ; `maintenance/{status,mrr,due}` ; `integrations/github.ts` ; `validations/*`.

**Page composition** : `src/app/page.tsx`.

**Prisma** : modèles `Task` (projectId optionnel), `FollowUp` (`CANCELED`), `Interaction` (types extra), `CalendarEvent`, `Quote`, `Tour`/`TourStop` (via actions).
