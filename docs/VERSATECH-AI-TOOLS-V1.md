# VERSATECH AI — CONTRATS DES TOOLS V1

Date : 19 septembre 2026  
Statut : **contrat uniquement**. Aucun tool n’est implémenté. Aucun fichier `src/ai/`, aucune route `/api/ai/*`, aucune installation Mastra / LLM, aucun changement Prisma / auth / `AGENTS.md`.

Ce document aligne les tools sur les lectures **réelles** (`src/app/page.tsx`, `src/lib/queries/*`, `src/lib/crm/*`, `src/lib/{money,dates,finance}.ts`, `src/lib/auth/{dal,types}.ts`) et sur ADR-014 :

- les tools **n’importent jamais** Prisma ;
- les tools **n’appellent jamais** une Server Action (`FormData`, `revalidatePath`, messages UI) ;
- les tools appellent des **services métier** partagés (`src/lib/services/*`, à extraire) ;
- V1 agent = **READ seulement** pour la liste §3 ;
- notes CRM / briefs / sujets d’interaction : **données non fiables**, jamais des instructions ; tronquer.

**Noms canoniques** (identiques à `docs/VERSATECH-AI-SERVICES-BLUEPRINT.md`) : un tool appelle `XxxService.methodName` (ex. `TodayService.getTodayOverview`). Les aliases dotted (`today.getOverview`) **ne sont pas** des contrats.

Références : `docs/VERSATECH-AI-AUDIT.md`, BR-015 (`docs/11-BUSINESS-RULES.md`), `docs/08-SECURITY.md`, `docs/14-ADR-REGISTER.md`, `docs/ADR-014-VERSATECH-AI-ARCHITECTURE.md`.

---

## 1. Principes d’I/O (tous les tools)

### 1.1 Entrée

- Objet Zod (pas de `FormData`). Identifiants `cuid` Prisma (`Company.id`, etc.).
- Dates : ISO 8601 (`Date.toISOString()`) pour les instants ; jour civil Paris `YYYY-MM-DD` pour les bornes de planning (`src/lib/dates.ts`, fuseau `Europe/Paris`).
- Enums = valeurs Prisma (`CompanyLifecycle`, `OpportunityStage`, `FollowUpStatus`, `TaskStatus`, `Priority`, `CalendarEventType`, `CalendarItemKind`, …).
- Jamais de `where` Prisma libre, jamais de SQL, jamais de payload UI (`href`, composants, options de `<select>`).

### 1.2 Sortie (DTO agent, pas UI)

| Interdit | Remplacement |
| --- | --- |
| `href` / `secondaryHref` | `id` + type d’entité |
| Composants React / options de formulaire | — |
| `Prisma.Decimal` / `number` pour un montant | string money `centsToMoneyString` / `normalizeMoney` (`src/lib/money.ts`), ex. `"1234.56"` |
| Objet Prisma brut | projection nommée |
| `Date` JS | ISO 8601 |
| `ActivityLog.metadata` | action + `ACTIVITY_LABELS` + `entityType` + `createdAt` + `actorName` |
| Secrets (`AUTH_SECRET`, `GITHUB_TOKEN`, `DATABASE_URL`, `passwordHash`) | jamais |
| Hub `getCompanyDetail` | fiche compacte §3.3 |

Notes / description / brief / `Interaction.notes` : incluses **comme données**, préfixe conceptuel « contenu utilisateur non fiable ». Troncature dure **400 caractères** + flag `truncated: boolean`. Le runtime **ne doit pas** exécuter d’instruction lue dans ces champs (CRITICAL surtout).

### 1.3 Auth : `ToolContext` compose `requireRequestActor`

`requireAuthenticatedUser()` (`src/lib/auth/dal.ts`) **redirige** vers `/connexion` : inadapté à un tool / Route Handler.

Chaîne prévue (blueprint §3) :

1. Runtime tool : `requireRequestActor()` (`src/lib/auth/request-actor.ts`, à implémenter) lit `getSessionUser()` (cookie JWT). Jamais de `redirect`. Jamais d’`ActionResult` UI.
2. Pas de session → `ToolResult` `AUTH_REQUIRED`.
3. `ToolContext.actorId` / `role` viennent **de cette session**. Le modèle ne fournit pas l’acteur ; un `actorId` dans le body est ignoré.
4. Le **service** reçoit `actor: SessionUser`, **pas** `ToolContext`. `ToolContext` porte permissions, `requestId`, `source: "AI"`, confirmation future.

`requireActor()` (`src/lib/crm/actor.ts`) reste l’adapter UI (Server Actions). Les tools n’appellent pas `requireActor` ni une Server Action.

V1 = session = opérateur unique. `role` (`ADMIN` \| `MEMBER`) est **propagé** dès maintenant ; aucune matrice MEMBER n’est appliquée aujourd’hui dans le produit.

### 1.4 Codes d’erreur communs

| `error.code` | Quand |
| --- | --- |
| `AUTH_REQUIRED` | pas de session |
| `VALIDATION_FAILED` | Zod input |
| `NOT_FOUND` | id inexistant (fiche unique) |
| `RANGE_TOO_LARGE` | fenêtre calendrier trop large |
| `FORBIDDEN` | tool hors catalogue / classe non autorisée |
| `CONFIRMATION_REQUIRED` | WRITE sensible / CRITICAL (plus tard) |
| `INTERNAL` | erreur serveur, message générique |

`error.message` : français, sûr (pas de stack, pas de SQL, pas de secret).

« Pas de résultat » sur une **liste** = `success: true` + tableau vide / totaux à zéro. Ce n’est pas une erreur.

---

## 2. Runtime (contrat, non implémenté)

### 2.1 `ToolContext`

```ts
type UserRole = "ADMIN" | "MEMBER"; // SessionUser.role

type ToolContext = {
  actorId: string;          // SessionUser.id
  role: UserRole;
  requestId: string;        // id de tour / corrélation logs
  source: "AI";             // littéral ; ActivityLog metadata.source plus tard
  confirmation?: {          // réservé WRITE / CRITICAL — absent en READ V1
    token: string;          // émis serveur, lié à actorId + toolName + hash args + TTL court
    toolName: string;
    argsHash: string;
  };
};
```

Le modèle ne fournit **pas** `actorId` : le runtime le lit depuis le cookie de session (`getSessionUser` / `requireRequestActor`). Un `actorId` dans le body est ignoré.

`source = "AI"` n’élargit aucune permission (matrice audit §5).

### 2.2 `ToolResult<T>`

Distinct de `ActionResult` UI (`ok`, `fieldErrors`, `data.companyId`, …).

```ts
type ToolError = {
  code:
    | "AUTH_REQUIRED"
    | "VALIDATION_FAILED"
    | "NOT_FOUND"
    | "RANGE_TOO_LARGE"
    | "FORBIDDEN"
    | "CONFIRMATION_REQUIRED"
    | "INTERNAL";
  message: string; // message opérateur, sûr
};

type ToolResult<T> = {
  success: boolean;
  data?: T;         // présent si success === true
  error?: ToolError; // présent si success === false
};
```

Règles : `success === true` ⇒ `data` défini, pas d’`error` ; `success === false` ⇒ pas de `data` métier, `error` obligatoire. Une liste vide reste un succès.

---

## 3. READ tools V1

Permission de **tous** les tools de cette section : **READ**. Pas de confirmation. Pas d’`ActivityLog` d’écriture (la lecture ne journalise pas aujourd’hui).

Schémas Zod = **conceptuels** (objets ISO / enums / limites). Ils ne réutilisent pas les schémas FormData de `src/lib/validations/*`.

Limites durcies : défaut bas, plafond dur. Pagination = `limit` + éventuellement `cursor` plus tard ; V1 = `limit` seulement (offset interdit pour éviter des dumps).

---

### 3.1 `getTodayOverview`

**Description LLM :** Briefing du jour civil Europe/Paris : tournée, KPI, appels, relances dues, tâches ouvertes, agenda, pipeline, finance agrégée et activité récente. « Aujourd’hui » est calculé côté serveur, sans date en entrée.

**Permission :** READ

**Service futur :** `TodayService.getTodayOverview`

**Source réelle :** composition de `src/app/page.tsx` :

| Bloc page | Query actuelle | Dans le DTO agent |
| --- | --- | --- |
| Tournée | `getTourDashboard` (+ stops de `getTodayTour` pour les ids) | compteurs + 3 prochains arrêts **avec** `companyId` |
| KPI | `getPipelineOverview`, `getFollowUpDashboard`, `getFinanceSnapshot`, `getTaskDashboard`, `getTodayInteractionCounts` | totaux bornés ; montants en strings money |
| Appels / relances | `listCompaniesToCall(5)`, `getFollowUpDashboard().preview` (4) | listes plus courtes, **sans** `href` |
| Tâches | `getTaskDashboard().preview` (5) | id, titre, dueAt ISO, priorité, projet |
| Agenda | `getTodayAgenda()` = `listCalendarItems(startOfToday, endOfToday)` | items fusionnés **dont visites `TourStop`** ; plafond |
| Pipeline | `getPipelineOverview()` | counts + brut / pondéré **en money string** (l’UI utilise encore des `number`) |
| Activité | `getRecentActivity(8)` | libellés `ACTIVITY_LABELS`, **sans** `metadata` |

Les réunions du jour **excluent** les visites terrain (`MEETING` + `INTERNAL` + `result: OTHER` + notes `"Visite terrain"`), comme `getTodayInteractionCounts`.

**Input Zod conceptuel :**

```ts
z.object({}); // now = serveur, startOfToday()/endOfToday() Paris
```

**Output DTO :**

```ts
type TodayOverviewDto = {
  generatedAt: string;          // ISO
  civilDate: string;            // YYYY-MM-DD Paris (parisDateKey)
  timezone: "Europe/Paris";
  kpi: {
    pipelineBrut: string;       // money, pas brutTotal number
    pipelineWeighted: string;   // money via weightedMoney, pas weightedValue number
    pipelineOpenCount: number;
    dueFollowUps: number;       // overdue + today (getFollowUpDashboard.dueCount)
    signedRevenue: string;
    collectedRevenue: string;
    remainingRevenue: string;
    overduePayments: number;    // FinanceTotals.overdueCount
    openTasks: number;
    callsToday: number;
    meetingsToday: number;      // hors visites terrain
  };
  tour: {
    planned: number;
    visited: number;
    remaining: number;
    nextStops: { companyId: string; name: string }[]; // max 3, ids issus de TourStop
  };
  calls: {                      // LEAD — champs CompanyListItem seulement (pas de phone : absent du list item)
    id: string;
    name: string;
    city: string | null;
    priority: Priority;
    primaryContact: { firstName: string; lastName: string; role: string | null } | null;
    lastInteractionAt: string | null;
    lastInteractionType: InteractionType | null;
    nextFollowUpAt: string | null;
  }[];
  followUps: {                  // max 8 — projection du preview getFollowUpDashboard
    id: string;
    title: string;
    dueAt: string;
    status: FollowUpStatus;
    company: { id: string; name: string };
  }[];
  tasks: {
    id: string;
    title: string;
    dueAt: string | null;
    priority: Priority;
    project: { id: string; name: string } | null;
  }[];                          // max 8
  agenda: CalendarItemAgentDto[]; // max 20, journée Paris, kinds réels
  pipelineCounts: Record<OpportunityStage, number>;
  recentActivity: RecentActivityAgentDto[]; // max 8
};
```

`phone` n’existe **pas** sur `CompanyListItem` (`listCompaniesToCall`). **Ne pas l’inventer** dans le DTO d’overview : le bloc `calls` reprend uniquement les champs de `CompanyListItem` utiles (id, name, city, priority, primaryContact, lastInteraction*, nextFollowUp*). Le téléphone se lit via `getCompany` ou `getTodayTour`.

**Pipeline money :** aujourd’hui `PipelineOverview.brutTotal` / `weightedTotal` sont des `number` (`decimalToNumber` + `weightedValue`). Le service agent **doit** projeter des strings via `src/lib/money.ts` (`normalizeMoney` sur `estimatedValue.toString()`, `weightedMoney(amount, probabilityPercent)`). Ne pas renvoyer de `number` CA.

**Limites :** 1 appel = 1 journée. Listes : appels 8, relances 8, tâches 8, agenda 20, activité 8, nextStops 3. Pas de pagination.

**Données sensibles :** montants CA, noms d’entreprises, contacts, libellés d’activité. Pas de metadata ActivityLog, pas de brief, pas de notes d’interaction dans cet overview.

**Erreurs :** `AUTH_REQUIRED`, `INTERNAL`. Jamais `NOT_FOUND`.

**Si vide :** `success: true`, KPI à `"0.00"` / `0`, tableaux vides, `tour` à zéros. C’est un lundi sans tournée, pas un échec.

---

### 3.2 `searchCompanies`

**Description LLM :** Recherche d’entreprises par texte (nom, ville, secteur, e-mail), filtres lifecycle et ville. Renvoie des ids CRM, pas des liens de navigation.

**Permission :** READ

**Service futur :** `SearchService.searchWorkspace` (projection `kind=company` uniquement). Enrichissement contact / lifecycle via `CompanyService` si le hit search ne les porte pas. Pas d’alias `companies.search`.

**Source réelle :** `searchWorkspace` (`src/lib/queries/search.ts` + `src/lib/crm/search.ts`) pour le volet Company, et `listAllCompanies` / `CompanyListItem` pour contact primaire et lifecycle. La recherche globale (contact/projet/opportunité/document) : **hors** ce tool — le tool agent `searchWorkspace` n’est pas dans le catalogue V1 ; le **service** `SearchService.searchWorkspace` reste le contrat d’extraction (UI `searchGlobal` + ce tool).

Règles query existantes : 2–80 caractères, `normalizeSearchQuery`, `SEARCH_LIMIT_PER_KIND = 6` (plafond agent un peu plus haut, toujours borné).

**Input Zod conceptuel :**

```ts
z.object({
  query: z.string().trim().min(2).max(80),
  lifecycle: z.enum([
    "LEAD", "CONTACTED", "QUALIFIED", "OPPORTUNITY", "CLIENT", "INACTIVE", "LOST",
  ]).optional(),
  city: z.string().trim().min(1).max(80).optional(), // contains insensible, comme search city
  limit: z.number().int().min(1).max(20).default(10),
});
```

**Output DTO :**

```ts
type CompanySearchHitDto = {
  id: string;
  name: string;
  lifecycleStatus: CompanyLifecycle;
  city: string | null;
  industry: string | null;
  primaryContact: { firstName: string; lastName: string; role: string | null } | null;
  // pas de href
};

type CompanySearchDto = {
  query: string; // normalisée
  total: number; // hits retournés (borné), pas un count SQL global
  items: CompanySearchHitDto[];
};
```

Champs repris de `CompanyListItem` + select search Company (`id`, `name`, `city`, `industry`, `lifecycleStatus`). Pas d’e-mail / téléphone dans ce hit (minimisation) : la fiche `getCompany` les porte.

**Limites :** `limit` défaut 10, max 20. Pas de cursor V1.

**Données sensibles :** noms, ville, secteur, prénom/nom du contact. Pas de notes.

**Erreurs :** `AUTH_REQUIRED`, `VALIDATION_FAILED` (query < 2), `INTERNAL`.

**Si vide :** `success: true`, `items: []`, `total: 0`. Le modèle doit **demander** une précision, pas créer d’entreprise.

---

### 3.3 `getCompany`

**Description LLM :** Fiche compacte d’une entreprise : identité, contacts, dernière interaction, prochaine relance, opportunités ouvertes, drapeau client. Ce n’est pas le hub `/entreprises/[id]`.

**Permission :** READ

**Service futur :** `CompanyService.getCompany`

**Source réelle :** projection de `getCompanyDetail` — **interdire** de renvoyer `CompanyDetail` (quotes, payments, documents, maintenance, journey, websiteStatus, `allowedLifecycleStatuses`, `principalProject`, tous les projets, toutes les interactions, `commercialBrief` JSON complet).

**Input Zod conceptuel :**

```ts
z.object({
  companyId: z.string().min(1), // cuid
});
```

Pas de `include` ouvrant le hub. Un seul niveau de compact.

**Output DTO :**

```ts
type CompanyCompactDto = {
  id: string;
  name: string;
  lifecycleStatus: CompanyLifecycle;
  industry: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  source: string | null;
  priority: Priority;
  geocodeStatus: GeocodeStatus | null;
  description: { text: string; truncated: boolean } | null; // max 400
  contacts: {                 // max 8, même take que listInclude
    id: string;
    firstName: string;
    lastName: string;
    role: string | null;
    phone: string | null;
    email: string | null;
    isPrimary: boolean;
  }[];
  lastInteraction: {
    id: string;
    type: InteractionType;
    direction: InteractionDirection;
    result: InteractionResult | null;
    subject: { text: string; truncated: boolean } | null;
    notes: { text: string; truncated: boolean } | null; // untrusted
    occurredAt: string; // ISO
  } | null;
  nextFollowUp: {
    id: string;
    title: string;
    dueAt: string;
    status: FollowUpStatus;
  } | null;
  hasOpenOpportunity: boolean;
  openOpportunities: {        // stages OPEN_OPPORTUNITY_STAGES seulement, max 8
    id: string;
    title: string;
    stage: OpportunityStage;
    estimatedValue: string;   // money string, pas Decimal
    updatedAt: string;
  }[];
  isClient: boolean;          // lifecycleStatus === "CLIENT" (pas une table Client)
};
```

`lastInteraction` : aujourd’hui `toListItem` ne garde que `occurredAt` + `type` ; le détail charge **toutes** les interactions. Le service compact charge **la plus récente** (comme `listInclude.take: 1`) avec notes tronquées — pas la liste complète.

Pas de `latitude` / `longitude` dans V1 compact (minimisation ; utiles à `getTodayTour`).

Pas de brief commercial dans V1 compact (texte libre, injection). Si un wave ultérieur l’ajoute : mêmes règles untrusted + truncate, jamais `VERIFIED` inventé.

**Limites :** 8 contacts, 1 interaction, 1 relance PENDING, 8 opportunités ouvertes.

**Données sensibles :** coordonnées, e-mails, téléphones, notes d’interaction (injection), montants d’opportunités.

**Erreurs :** `AUTH_REQUIRED`, `VALIDATION_FAILED`, `NOT_FOUND` (« Entreprise introuvable. »), `INTERNAL`.

**Si vide :** id inconnu → `success: false`, `NOT_FOUND`. Pas d’objet partiel.

---

### 3.4 `listFollowUps`

**Description LLM :** Relances du board (en retard, aujourd’hui, à venir, éventuellement terminées), filtrables par entreprise.

**Permission :** READ

**Service futur :** `FollowUpService.listFollowUps`

**Source réelle :** `listFollowUpBoard` / `FollowUpListItem` / `dueBucket` (`src/lib/dates.ts`). Buckets : `overdue` | `today` | `upcoming` | `completed`. Statuts Prisma : `PENDING` | `COMPLETED` | `CANCELED`. Le board actuel ne liste pas `CANCELED` (pas d’action `cancelFollowUp`).

**Input Zod conceptuel :**

```ts
z.object({
  bucket: z.enum(["overdue", "today", "upcoming", "completed"]).optional(),
  companyId: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(30).default(15),
});
```

Sans `bucket` : concaténation overdue → today → upcoming (comme le preview dashboard), **sans** completed, puis `limit`.

**Output DTO :**

```ts
type FollowUpAgentDto = {
  id: string;
  title: string;
  dueAt: string;
  status: FollowUpStatus;
  completedAt: string | null;
  bucket: "overdue" | "today" | "upcoming" | "completed";
  company: { id: string; name: string };
  lastInteraction: { type: InteractionType; occurredAt: string } | null;
  // FollowUpListItem expose aussi company.phone/email et phone/email contact :
  // V1 agent omet les coordonnées ici (minimisation). Utiliser getCompany.
};

type FollowUpListDto = {
  items: FollowUpAgentDto[];
  returned: number;
  limit: number;
};
```

**Limites :** défaut 15, max 30. Le board UI charge **toutes** les PENDING + 40 COMPLETED : le service agent **doit** `take` SQL, pas slicer après coup un dump.

**Données sensibles :** titres (texte libre, untrusted si note → title), noms d’entreprises. Coordonnées volontairement hors V1 de ce tool.

**Erreurs :** `AUTH_REQUIRED`, `VALIDATION_FAILED`, `NOT_FOUND` seulement si `companyId` fourni et inconnu, `INTERNAL`.

**Si vide :** `success: true`, `items: []`.

---

### 3.5 `listTasks`

**Description LLM :** Tâches ouvertes (à faire / en cours), filtrables par échéance, projet ou entreprise.

**Permission :** READ

**Service futur :** `TaskService.listOpenTasks`

**Source réelle :** `listOpenTasks` / `TaskListItem` (`status in OPEN_TASK_STATUSES` = `TODO` | `IN_PROGRESS`). `getTaskDashboard` est un preview sans `company`. Le schéma Prisma autorise une tâche **sans** `projectId` ; l’action `createTask` exige encore un projet — hors READ.

`dueBucket` n’existe pas sur la query actuelle : le service filtre avec `dueBucket(dueAt)` de `src/lib/dates.ts`. `dueAt === null` : exclu de `overdue` / `today` ; inclus si pas de bucket ou bucket `upcoming`.

**Input Zod conceptuel :**

```ts
z.object({
  dueBucket: z.enum(["overdue", "today", "upcoming"]).optional(),
  projectId: z.string().min(1).optional(),
  companyId: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(30).default(15),
});
```

**Output DTO :**

```ts
type TaskAgentDto = {
  id: string;
  title: string;
  dueAt: string | null;
  priority: Priority;
  status: "TODO" | "IN_PROGRESS";
  project: { id: string; name: string } | null;
  company: { id: string; name: string } | null;
};

type TaskListDto = {
  items: TaskAgentDto[];
  returned: number;
  limit: number;
};
```

Pas de `description` (texte libre) en liste V1.

**Limites :** défaut 15, max 30. Query actuelle : liste entière sans `take` — le service **ajoute** le plafond.

**Données sensibles :** titres de tâches, rattachement entreprise/projet.

**Erreurs :** `AUTH_REQUIRED`, `VALIDATION_FAILED`, `NOT_FOUND` si `projectId` / `companyId` fourni et inconnu, `INTERNAL`.

**Si vide :** `success: true`, `items: []`.

---

### 3.6 `listCalendarItems`

**Description LLM :** Planning fusionné sur une plage de jours civils Paris : événements, relances, tâches, deadlines projet, jalons, et visites terrain issues des `TourStop`. Ne crée pas d’événement calendrier pour une visite.

**Permission :** READ

**Service futur :** `CalendarService.listCalendarItems`

**Source réelle :** `listCalendarItems(rangeStart, rangeEnd)` + `tourStopsToCalendarItems` (`src/lib/calendar/terrain-visits.ts`). Kinds existants (`CALENDAR_ITEM_KINDS`) : `event` | `follow_up` | `task` | `project` | `milestone` | `terrain_visit`. BR-011 : un item projeté ne remplace pas l’objet métier ; `editable: false` pour visites / relances / tâches / projets / jalons.

**Ne pas** inventer de `CalendarEvent` de visite. `kind: "terrain_visit"`, `entityId` = `TourStop.id`, `visitOrder` / `visitStatus` (`pending` | `visited`).

**Input Zod conceptuel :**

```ts
z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // civil Paris
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  limit: z.number().int().min(1).max(50).default(30),
});
```

Interprétation : `startOfParisDay(from)` … `endOfParisDay(to)`. `from > to` → `VALIDATION_FAILED`. Nombre de jours civils > **31** → `RANGE_TOO_LARGE`.

**Output DTO :**

```ts
type CalendarItemAgentDto = {
  id: string;                 // `${kind}:${entityId}` comme aujourd’hui
  kind: CalendarItemKind;
  entityId: string;
  title: string;
  startsAt: string;           // ISO
  endsAt: string;
  allDay: boolean;
  eventType: CalendarEventType | null; // seulement kind === "event"
  company: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
  overdue: boolean;
  visitOrder: number | null;
  visitStatus: "pending" | "visited" | null;
  // pas de href, pas de secondaryHref, pas besoin d’editable pour l’agent READ
};

type CalendarListDto = {
  from: string;
  to: string;
  items: CalendarItemAgentDto[];
  returned: number;
  truncated: boolean; // true si plus d’items que limit (ordre identique à mergeCalendarItems)
};
```

**Limites :** défaut 30, max 50, fenêtre max 31 jours. La query UI n’a pas de `take` : le service borne après merge (déjà trié).

**Données sensibles :** titres (dont `Visite terrain — {name}`), noms d’entreprises/projets.

**Erreurs :** `AUTH_REQUIRED`, `VALIDATION_FAILED`, `RANGE_TOO_LARGE`, `INTERNAL`.

**Si vide :** `success: true`, `items: []`.

---

### 3.7 `getTodayTour`

**Description LLM :** Tournée du jour (vérité terrain `Tour` / `TourStop`) : arrêts ordonnés, visités ou restants. Jour civil Paris, sans date en entrée.

**Permission :** READ

**Service futur :** `TourService.getTodayTour`

**Source réelle :** `getTodayTour` / `TourStopItem` / `tourDateFor()` (`startOfToday` Paris). Une tournée par jour (`@@unique([date])`).

**Input Zod conceptuel :**

```ts
z.object({});
```

**Output DTO :**

```ts
type TodayTourStopDto = {
  id: string;                 // TourStop.id
  order: number;
  visitedAt: string | null;   // ISO
  company: {
    id: string;
    name: string;
    lifecycleStatus: CompanyLifecycle;
    address: string | null;
    city: string | null;
    postalCode: string | null;
    country: string | null;
    phone: string | null;
    // latitude / longitude : utiles au terrain mais sensibles.
    // V1 : les omettre (minimisation). La carte n’est pas ce tool.
  };
};

type TodayTourDto = {
  id: string;
  date: string;               // ISO start-of-day Paris (déjà tour.date.toISOString())
  planned: number;
  visited: number;
  remaining: number;
  stops: TodayTourStopDto[];
} | null;
```

Compteurs = même règle que `getTourDashboard`. `TourStop.notes` existe en schéma : **ne pas** le renvoyer en V1 (texte libre).

**Limites :** tous les stops du jour (une tournée opérationnelle reste petite). Plafond dur de sécurité **50** stops ; au-delà `truncated: true` (ajouter le flag sur l’objet non-null si atteint).

**Données sensibles :** adresse, téléphone, lifecycle.

**Erreurs :** `AUTH_REQUIRED`, `INTERNAL`. Pas de `NOT_FOUND` si aucune tournée.

**Si vide :** `success: true`, `data: null` (pas de `Tour` pour aujourd’hui — l’UI affiche une tournée vide via `getTourDashboard` zéro). Ne pas appeler `ensureTodayTour` depuis ce READ.

---

### 3.8 `getPipeline`

**Description LLM :** Pipeline commercial : colonnes par stage, totaux brut et pondéré (BR-017), cartes d’opportunités ouvertes.

**Permission :** READ

**Service futur :** `OpportunityService.getPipeline`

**Source réelle :** `getPipelineOverview` + `listPipelineBoard` / `PipelineOpportunityCard`. Stages : `TO_QUALIFY` … `QUOTE`, `WON`, `LOST`. Ouverts : `OPEN_OPPORTUNITY_STAGES`. Probabilité : `effectiveProbability` (entier 0–100). Valeur : `estimatedValue.toString()` aujourd’hui ; l’agent exige une string money normalisée.

**Input Zod conceptuel :**

```ts
z.object({
  openOnly: z.boolean().default(true),
  limitPerStage: z.number().int().min(1).max(15).default(8),
});
```

`openOnly: true` (défaut) : cartes seulement sur stages ouverts ; `counts` reste **tous** les stages (comme l’overview). `WON` / `LOST` : totaux dans `counts`, pas de dump historique.

**Output DTO :**

```ts
type PipelineCardDto = {
  id: string;
  title: string;
  stage: OpportunityStage;
  estimatedValue: string;     // money
  probability: number;        // 0–100 entier
  weightedValue: string;      // money = weightedMoney(estimatedValue, probability)
  company: { id: string; name: string; city: string | null };
  nextFollowUp: { title: string; dueAt: string } | null;
  lastInteraction: { type: InteractionType; occurredAt: string } | null;
};

type PipelineStageDto = {
  stage: OpportunityStage;
  count: number;              // count réel de la colonne (peut dépasser les cartes renvoyées)
  estimatedTotal: string;     // money, pas number
  weightedTotal: string;      // money
  opportunities: PipelineCardDto[]; // length ≤ limitPerStage
};

type PipelineDto = {
  openCount: number;
  brutTotal: string;
  weightedTotal: string;
  counts: Record<OpportunityStage, number>;
  stages: PipelineStageDto[]; // si openOnly : 6 stages ouverts seulement
};
```

Omettre `company.industry` en V1 (présent sur la card UI, peu utile au briefing).

**Limites :** 8 cartes / stage défaut, max 15. 6 stages ouverts × 15 = 90 cartes max. Interdit de renvoyer `listPipelineBoard` entier sans plafond (query actuelle : toutes les opportunités).

**Données sensibles :** montants estimés, titres, noms d’entreprises. Ce n’est **pas** du CA signé (`Quote.ACCEPTED`) — ne pas confondre avec `getFinanceSnapshot`.

**Erreurs :** `AUTH_REQUIRED`, `VALIDATION_FAILED`, `INTERNAL`.

**Si vide :** `success: true`, counts à 0, `brutTotal` / `weightedTotal` `"0.00"`, `opportunities: []`.

---

### 3.9 `getFinanceSnapshot`

**Description LLM :** Pilotage CA : totaux signé, encaissé, restant dû et retards, éventuellement bornés à une entreprise ou un projet. Lecture d’agrégats uniquement, pas d’écriture de paiement.

**Permission :** READ (ce n’est **pas** un tool CRITICAL d’écriture). Les montants restent **sensibles**.

**Service futur :** `FinanceService.getFinanceSnapshot`

**Source réelle :** `getFinanceSnapshot` + `computeFinanceTotals` (`src/lib/finance.ts`). Signé = somme TTC des devis `ACCEPTED` ; encaissé = paiements effectifs `PAID` ; restant = `max(signed - collected, 0)` ; `OVERDUE` dérivé via `effectivePaymentStatus` / `dueBucket`. Scope : `FinanceScope` `{ companyId?, projectId? }`.

L’UI dashboard n’utilise que `signed`, `collected`, `remaining`, `overdueCount`. Le snapshot query retourne déjà tout `FinanceTotals` — le DTO agent peut exposer le même objet (toujours des strings money).

**Input Zod conceptuel :**

```ts
z.object({
  companyId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
});
```

Pas de liste de paiements (ça serait `listPayments`, hors READ V1 prioritaire).

**Output DTO :**

```ts
type FinanceSnapshotDto = {
  scope: { companyId: string | null; projectId: string | null };
  signed: string;
  collected: string;
  remaining: string;
  pending: string;
  overdue: string;
  pendingCount: number;
  overdueCount: number;
  paidCount: number;
  paymentCount: number;
};
```

Identique à `FinanceTotals` + scope. **Aucune** ligne de paiement, **aucun** `externalReference`.

**Limites :** agrégats seulement — payload fixe. Si `companyId` et `projectId` sont tous deux fournis, le service applique les deux filtres Prisma existants (AND), sans inventer d’autre sémantique.

**Données sensibles :** **tous** les montants et compteurs. Futur MEMBER : candidat à restriction (audit matrice). Ne jamais laisser le modèle « corriger » un total (BR-008 : KPI depuis données persistées).

**Erreurs :** `AUTH_REQUIRED`, `VALIDATION_FAILED`, `NOT_FOUND` si id de scope inconnu, `INTERNAL`.

**Si vide :** `success: true`, strings `"0.00"`, compteurs `0` (pas de devis accepté / pas de paiement).

---

### 3.10 `getRecentActivity`

**Description LLM :** Journal métier récent : actions libellées (entreprise créée, relance planifiée, etc.), sans métadonnées brutes.

**Permission :** READ

**Service futur :** `ActivityService.getRecentActivity`

**Source réelle :** `getRecentActivity` (`id`, `action`, `entityType`, `createdAt`, `actorName`) + `ACTIVITY_LABELS` (`src/lib/crm/activity-labels.ts`). Select actuel : **pas** de `metadata`, **pas** d’`entityId`. Ne pas ajouter `metadata`. `entityId` existe sur `ActivityLog` mais n’est pas dans le DTO query : **ne pas l’inventer** en V1 (rester aligné sur `RecentActivityItem` + `label`).

**Input Zod conceptuel :**

```ts
z.object({
  limit: z.number().int().min(1).max(20).default(8),
});
```

Plafond audit : max 20. Dashboard : 8.

**Output DTO :**

```ts
type RecentActivityAgentDto = {
  id: string;
  action: string;             // ex. "followup.created"
  label: string;              // ACTIVITY_LABELS[action] ?? action
  entityType: string;         // "Company", "FollowUp", …
  createdAt: string;          // ISO
  actorName: string | null;
};

type RecentActivityDto = {
  items: RecentActivityAgentDto[];
};
```

Pas de dump JSON, pas de montants issus de metadata (`payment.marked_paid` reste un libellé).

**Limites :** défaut 8, max 20 (`take` SQL).

**Données sensibles :** noms d’acteurs, types d’entités. Risque faible si metadata absente.

**Erreurs :** `AUTH_REQUIRED`, `VALIDATION_FAILED`, `INTERNAL`.

**Si vide :** `success: true`, `items: []`.

---

## 4. Catalogue READ V1 (rappel)

| Tool | Service | Confirm |
| --- | --- | --- |
| `getTodayOverview` | `TodayService.getTodayOverview` | non |
| `searchCompanies` | `SearchService.searchWorkspace` (kind company) | non |
| `getCompany` | `CompanyService.getCompany` | non |
| `listFollowUps` | `FollowUpService.listFollowUps` | non |
| `listTasks` | `TaskService.listOpenTasks` | non |
| `listCalendarItems` | `CalendarService.listCalendarItems` | non |
| `getTodayTour` | `TourService.getTodayTour` | non |
| `getPipeline` | `OpportunityService.getPipeline` | non |
| `getFinanceSnapshot` | `FinanceService.getFinanceSnapshot` | non |
| `getRecentActivity` | `ActivityService.getRecentActivity` | non |

Hors V1 **tools** (inventaire audit, à ne pas implémenter maintenant) : tool `searchWorkspace` global, `listProjects`, `getProject`, `listClients`, `listQuotes`, `listPayments`, `listMaintenance`, `getAnalyticsSnapshot`, `getGitHubOverview`, `listMapCompanies`, `getProspectionSummary`, `listDocuments`. Le **service** `SearchService.searchWorkspace` est bien le contrat d’extraction (UI + projection `searchCompanies`).

---

## 5. WRITE V1 — documenté, **non implémenté**

Classe **WRITE**. Même service que l’UI, après extraction. Zod objet (ISO / enums). Runtime : `requireRequestActor` → `actor` passé au service ; ActivityLog dans le **service** (`metadata.source = "ai"` + `toolName`). Tools **sans** Prisma et **sans** Server Action.

**Hors WRITE V1 agent :** toute finance, devis, maintenance, GitHub, `createProject`, lifecycle `CLIENT` manuel, documents, géocode. WON/LOST n’est pas WRITE : voir §6.

Écriture **par id** uniquement. 0 ou N>1 candidats après search → stop, ne pas créer. Plafond WRITE par tour : **défaut 3** (ADR-014), fail-closed ; abort au premier `success: false`. Pas de transaction multi-tools.

| Tool | Description | Input conceptuel | Sortie | Service | Confirm |
| --- | --- | --- | --- | --- | --- |
| `createCompany` | Créer un lead (`LEAD`) | `name`, `address` (obligatoires comme `createCompanySchema`), contact optionnel prénom+nom, `city?`, `phone?`, `email?`, `source?`… | `{ companyId }` | `CompanyService.createCompany` | non, sauf politique doublon nom plus tard |
| `createFollowUp` | Planifier une relance | `companyId`, `dueAt` ISO, `title?` (l’UI mappe `note` → `title`, défaut `"Relance"`) | `{ followUpId }` | `FollowUpService.createFollowUp` | non |
| `completeFollowUp` | Terminer (PENDING only, `completedAt`, BR-007) | `followUpId` | `{ followUpId }` | `FollowUpService.completeFollowUp` | non |
| `rescheduleFollowUp` | Reporter (PENDING only) | `followUpId`, `dueAt` ISO | `{ followUpId }` | `FollowUpService.rescheduleFollowUp` | non |
| `recordInteraction` | Journaliser appel / mail / RDV / message / note | `companyId`, `type` ∈ `CALL\|EMAIL\|MEETING\|MESSAGE\|NOTE`, `direction`, `result?`, `occurredAt` ISO (BR-006), `notes?` truncatable | `{ interactionId }` | `InteractionService.createInteraction` | non |
| `recordTerrainVisit` | Visite terrain : Interaction visite + `TourStop.visitedAt`, **pas** de `CalendarEvent` | `companyId` | `{ interactionId, tourStopId? }` | `TourService.markTourStopVisited` (via `InteractionService.recordTerrainVisit` objet ; **pas** l’adapter FormData) | non |
| `createTask` | Tâche | `title`, `dueAt?`, `priority?`, `projectId?`, `companyId?` | `{ taskId }` | `TaskService.createTask` | non |
| `updateTaskStatus` | `TODO` / `IN_PROGRESS` / `DONE` / `CANCELED` | `taskId`, `status` | `{ taskId }` | `TaskService.updateTaskStatus` | non |
| `createCalendarEvent` | RDV / admin / deadline **éditable** | `title`, `type` ∈ `CALENDAR_EVENT_TYPES`, `startsAt`/`endsAt` ISO, `allDay`, `companyId?`, `projectId?` | `{ calendarEventId }` | `CalendarService.createCalendarEvent` | non |
| `updateCalendarEvent` | Modifier un événement **éditable** (refuser `terrain_visit` projeté) | `id` + mêmes champs | `{ calendarEventId }` | `CalendarService.updateCalendarEvent` | non |
| `createOpportunity` | Opportunité, stages **ouverts** seulement | `companyId`, `title`, `estimatedValue` money string, `stage` ∈ `OPEN_OPPORTUNITY_STAGES`, `probability?` 0–100 | `{ opportunityId }` | `OpportunityService.createOpportunity` | non |
| `updateOpportunityStage` | Déplacer vers un **stage ouvert** | `opportunityId`, `stage` ∈ `OPEN_OPPORTUNITY_STAGES` | `{ opportunityId }` | `OpportunityService.updateOpportunityStage` | non |
| `ensureTodayTour` | Ouvrir la tournée du jour Paris | `{}` | `{ tourId }` | `TourService.ensureTodayTour` | non |
| `addCompanyToTodayTour` | Ajouter un stop (pas de doublon) | `companyId` | `{ tourId }` | `TourService.addCompanyToTodayTour` | non |
| `moveTourStop` | Réordonner | `companyId`, `direction: -1 \| 1` | `{ tourId }` | `TourService.moveTourStop` | non |

**Blocage connu avant `createTask` agent :** l’action actuelle exige `projectId`. Le schéma `Task` autorise une tâche company-only. Extraire `TaskService.createTask` **company-scoped** avant d’exposer le tool, sinon « rappeler Jacques » est impossible (audit). En attendant, mapper vers `createFollowUp` n’est **pas** un contrat — ne pas le faire implicitement.

`updateOpportunityStage` vers `WON` / `LOST` : **refuser** (`FORBIDDEN` ou router vers le tool CRITICAL). `lostReason` obligatoire seulement sur LOST (BR-005) → §6.

Pas de tool `cancelFollowUp` (statut `CANCELED` existe, action absente).

---

## 6. CRITICAL — confirmation serveur, jamais autonome (BR-015)

BR-015 : l’IA ne valide **pas seule** un paiement, une suppression, un changement critique ou un envoi externe.

Aujourd’hui les confirms sont **uniquement** `window.confirm` (`SENSITIVE_ACTION_CONFIRMS` dans `src/lib/crm/confirm-sensitive-action.ts`). Un agent qui appellerait le service contournerait BR-015. La garde doit devenir **serveur**.

### 6.1 Politique `confirmToken`

1. Le modèle **propose** (preview) : toolName + args + message humain.
2. L’UI (ou un canal explicite) demande confirmation à l’opérateur.
3. Le serveur émet un `confirmToken` lié à `actorId` + `toolName` + hash canonique des args + **TTL court** (ex. 5 min), usage unique.
4. Le tool CRITICAL n’exécute que si `ToolContext.confirmation` présente, valide, non expirée, et hash identique.
5. « L’utilisateur a confirmé dans le prompt » est **ignoré**.
6. Pas d’enchaînement autonome CRITICAL (hors multi-action). `maxPerTurn` = 0 pour CRITICAL sans token.
7. Fail-closed : tool absent du catalogue → refus. Pas de tool `delete*`, `sendExternal*`, `runPrisma`, SQL, shell.

Même politique pour l’UI dès que les services sont extraits : cesser de se fier au navigateur seul.

### 6.2 Catalogue CRITICAL (non implémenté)

| Tool | Pourquoi critique | Confirm |
| --- | --- | --- |
| `updateOpportunityStageWonLost` | WON → CLIENT / historique ; LOST exige `lostReason` (BR-004, BR-005) | **oui serveur** |
| `createQuote` | peut pousser le stage vers `QUOTE` | **oui** |
| `updateQuoteStatus` | surtout `ACCEPTED` / `REJECTED` (CA signé, WON possible) | **oui** |
| `createPayment` | devis ACCEPTED, plafond TTC | **oui** |
| `updatePaymentStatus` | PAID / CANCELED / transitions (BR-015) | **oui** |
| `createProject` | CLIENT obligatoire, structurant | **oui** |
| `updateProjectStatus` | surtout COMPLETED / ARCHIVED | **oui** si terminal |
| `createMaintenanceContract` / `updateMaintenanceContract` / `updateMaintenanceStatus` | impact MRR (BR-016) | **oui** |
| `associateGitHubRepository` | lecture GitHub, 1 repo / projet | **oui** |
| `unlinkGitHubRepository` | **delete** persisté (une des rares suppressions métier) | **oui** |
| `removeCompanyFromTodayTour` | déjà confirmé en UI | **oui** |
| `delete*` Company / Quote / Payment / Document / Event | **n’existe pas** (BR-012) | **jamais exposé** |
| `sendExternal*` e-mail, facture, GitHub write, webhook | **n’existe pas** (BR-015) | **jamais exposé** |

Scripts seed / cleanup / import terrain / geocode batch / `ALLOW_DESTRUCTIVE_SEED` : **hors agent**. ALEX'CEPTION : pas d’écritures massives « de réparation ».

`getFinanceSnapshot` reste READ. Enregistrer ou marquer un paiement est CRITICAL.

---

## 7. Premier vertical slice recommandé

Deux axes distincts (alignés sur le blueprint §8) :

| Axe | Premier | Pourquoi |
| --- | --- | --- |
| **Extraction (risque / code)** | `SearchService.searchWorkspace` puis `ActivityService` | Déjà objet / petites queries ; retirer le `redirect`. |
| **Premier slice IA visible** | tool `getTodayOverview` → `TodayService.getTodayOverview` | Briefing opérateur ; premier contrat tool utilisateur. |

**Cible d’évaluation (slice IA) :**

```
Utilisateur → (futur) agent → getTodayOverview → TodayService.getTodayOverview → PostgreSQL
```

`TodayService` peut être le 3e service extrait et pourtant le premier tool. Extraire Search/Activity n’ouvre pas de chat.

### 7.1 Pourquoi `getTodayOverview`

1. **Déjà composé** : `src/app/page.tsx` est le briefing opérateur ; extraire `TodayService.getTodayOverview` ne crée pas un nouveau métier, ça **projette** les 9 lectures existantes.
2. **Valeur immédiate** : « Qu’est-ce que je fais aujourd’hui ? » sans WRITE, sans ambiguïté d’entité.
3. **Contraint les fondations** : auth sans `redirect` (`requireRequestActor` → `ToolContext` → `actor` au service), DTO sans `href`, money strings, limites, visites terrain via `TourStop` dans l’agenda — tout ce qui cassera si on branche Prisma dans un tool.
4. **READ pur** : zéro confirmation, zéro BR-015, zéro risque CA signé / paiement (`getFinanceSnapshot` dans l’overview reste un agrégat READ).
5. **Borne le payload** : le dashboard peut tout charger ; l’agent ne doit pas avaler `getCompanyDetail` ni le board pipeline complet.

### 7.2 Ce que le slice doit inclure (quand on l’implémentera — **pas cette vague**)

- Service `TodayService.getTodayOverview({ actor, now? })` dans `src/lib/services/today/` (nom cible), **sans** `requireAuthenticatedUser()` redirect.
- Projection `TodayOverviewDto` §3.1 (limites, money strings, pas de `href`, activité sans metadata).
- Plus tard : tool READ `getTodayOverview` = Zod `{}` → permission READ → service → `ToolResult<TodayOverviewDto>`.

### 7.3 Ce que ce slice / cette vague **ne** doit **pas** inclure

- Aucun tool WRITE ou CRITICAL.
- Aucune installation Mastra / provider LLM / `src/mastra/` / LibSQL.
- Aucun `src/ai/` obligatoire, aucune route `/api/ai/*`.
- Aucun appel Server Action depuis un tool.
- Aucun import Prisma sous un futur `src/ai/`.
- Aucun `createTask` / relances « manquantes » inventées.
- Pas de modification `src/`, Prisma, auth, `AGENTS.md` pour ce contrat.

Extraction ensuite (blueprint) : Search/Activity (risque bas) puis `TodayService` pour le slice ; **pas** d’install Mastra tant qu’une phase runtime n’est pas demandée. Tools READ catalogue §3 seulement après services + auth sans redirect.

---

## 8. Alignement ADR-014

| Règle | Application ici |
| --- | --- |
| Tools never import Prisma | contrat §1 ; services seuls parlent à `src/lib/db/prisma.ts` |
| Tools never call Server Actions | I/O objet, pas `FormData` / `revalidatePath` |
| Tools call business services | `XxxService.methodName` §3–§6 (mêmes noms que le blueprint) |
| READ only for V1 list | §3 uniquement pour l’agent V1 ; finance snapshot = READ agrégats |
| WRITE ceiling | défaut **3** (ADR-014), abort au premier échec |
| Actor from session | `requireRequestActor` → `ToolContext` ; service reçoit `actor: SessionUser` |
| Untrusted CRM notes | tronquées, données ≠ instructions ; overview n’en embarque presque pas |
| Secrets | jamais dans prompt / mémoire / sortie tool / ActivityLog |

Mastra = orchestration future, pas le domaine. Catalogue fail-closed. Mémoire ≠ CRM. Pas d’API Mastra catch-all. `/api/ai/*` ne sera jamais `isPublicPath()`.
