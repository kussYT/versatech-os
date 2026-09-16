# AUDIT V1 — VersaTech OS

Date : 16 septembre 2026  
Branche d’origine : `fix/audit-v1` (`C:/Users/Marius/Projects/versatech-os-audit`)  
Intégration : réappliqué manuellement dans le working tree `feature/calendrier-v1` (Calendar + GitHub + Documents conservés).  
Périmètre : application existante (Dashboard, Prospection, Entreprises, Company Hub, Pipeline, Relances, Devis, Clients, Projets, Project Hub, Tasks, Milestones).  
Hors implémentation ici : Finance, Analytics, Maintenance, Google Calendar/Drive, automatisations. Calendrier / GitHub / Documents : livrés par les agents parallèles, **intégrés**.

Références lues : `docs/11-BUSINESS-RULES.md`, `docs/01-PRODUCT-SPEC.md`, `docs/02-FUNCTIONAL-ARCHITECTURE.md`, `docs/03-DATA-MODEL.md`, `docs/04-TECHNICAL-ARCHITECTURE.md`, `docs/05-UX-SPEC.md`.

---

## Synthèse

L’application V1 commerciale / projets est globalement cohérente (Zod serveur, transactions Prisma, ActivityLog, pas de duplication Company/Client). Plusieurs **états vides étaient faux** (dashboard, `/taches`) et quelques **règles de cycle de vie** n’étaient pas appliquées à l’écriture.

- **BLOCKER** : 0 restant (1 corrigé : page Tâches qui niait l’existence des tâches).
- **HIGH** : 9 corrigés, 6 restants (dette métier / architecture, pas des plantages).
- **MEDIUM** : 2 corrigés, 12 restants (à traiter sans gros refactor).
- **LOW** : 2 corrigés, 7 restants.

Aucune migration Prisma, aucun changement d’ENV, aucune dépendance ajoutée.

---

## BLOCKER

### B1 — `/taches` affiche « Aucune tâche » alors que des tâches existent
- **Zone** : Tâches (`src/app/taches/page.tsx`)
- **Problème** : placeholder générique, état vide incorrect. Le dashboard et le Project Hub listent déjà des tâches persistées.
- **Impact** : navigation mobile (onglet Tâches) et sidebar mènent à une page qui nie les données. Bloquant pour l’usage quotidien.
- **Correction effectuée** : vue réelle des tâches ouvertes, buckets En retard / Aujourd’hui / À venir / Sans échéance, actions de statut existantes. Fichiers : `src/app/taches/page.tsx`, `src/components/projects/task-board.tsx`, `src/lib/queries/projects.ts`. Revalidation `/taches` ajoutée.

---

## HIGH

### H1 — Activité récente du dashboard toujours vide
- **Zone** : Dashboard
- **Problème** : `RecentActivity` était un empty state codé en dur malgré `ActivityLog`.
- **Impact** : BR-008 / spec dashboard non respectés ; l’OS paraît inactif.
- **Correction effectuée** : lecture des 8 derniers logs. `src/lib/queries/activity.ts`, `src/components/dashboard/recent-activity.tsx`, `src/app/page.tsx`.

### H2 — KPI Appels / RDV non calculés (BR-008)
- **Zone** : Dashboard KPI
- **Problème** : valeurs « — » et hints « aucun », indépendants des `Interaction`.
- **Impact** : indicateurs trompeurs.
- **Correction effectuée** : comptage des interactions `CALL` / `MEETING` du jour. `src/lib/queries/activity.ts`, `src/components/dashboard/kpi-zone.tsx`.

### H3 — Panneau Appels toujours vide
- **Zone** : Dashboard
- **Problème** : empty state fixe alors que des LEAD existent (file « à contacter »).
- **Impact** : pas de vue « prospects à appeler » (spec fonctionnelle).
- **Correction effectuée** : liste des entreprises `LEAD`. `listCompaniesToCall`, `src/components/dashboard/calls-followups.tsx`.

### H4 — Revalidation CRM incomplète
- **Zone** : `src/lib/crm/revalidate.ts`
- **Problème** : `revalidateCrm` ne touchait ni `/` ni `/pipeline` ni `/clients`. Une interaction / entreprise ne rafraîchissait pas le dashboard ni le kanban.
- **Impact** : données périmées après mutation.
- **Correction effectuée** : `/`, `/pipeline`, `/clients` dans `revalidateCrm` ; `/taches` dans `revalidateProjects`.

### H5 — Interactions et relances UI non liées à l’opportunité
- **Zone** : Pipeline, actions Interaction / FollowUp
- **Problème** : le seed renseigne `opportunityId` ; les actions UI ne le faisaient pas. Les cartes pipeline lisaient seulement `opportunity.followUps` / `opportunity.interactions`.
- **Impact** : après usage réel, relance et dernière interaction disparaissaient du kanban.
- **Correction effectuée** : rattachement à la dernière opportunité ouverte ; fallback company-level dans `listPipelineBoard`.

### H6 — Création de devis sans passage au stage Devis
- **Zone** : Pipeline / Devis
- **Problème** : un devis laissait l’opportunité en RDV / Intéressé / etc. La colonne Devis restait vide.
- **Impact** : pipeline faux par rapport au workflow Identification → … → Devis.
- **Correction effectuée** : si le stage est ouvert et ≠ `QUOTE` / `WON` / `LOST`, passage à `QUOTE` + historique + ActivityLog.

### H7 — Une seule opportunité possible par Company (BR-003)
- **Zone** : Company Hub
- **Problème** : bouton unique « Créer une opportunité » **ou** « Créer un devis ». Impossible d’ouvrir une 2ᵉ opportunité tant qu’une est ouverte. Aucune liste d’opportunités.
- **Impact** : BR-003 « plusieurs opportunités dans le temps » non opérable.
- **Correction effectuée** : les deux actions coexistent ; section Opportunités ajoutée.

### H8 — Passage en LOST sans raison (BR-005)
- **Zone** : Pipeline
- **Problème** : `lostReason` optionnel, jamais saisi dans le formulaire.
- **Impact** : pertes inexploitables (analytics / historique).
- **Correction effectuée** : Zod `superRefine` + `prompt` obligatoire. Select re-sync via `key={stage}`.

### H9 — Statut projet figé après création
- **Zone** : Project Hub
- **Problème** : aucun `updateProjectStatus`. WAITING_CLIENT (BR-019) inexploitable.
- **Impact** : projets coincés au statut initial.
- **Correction effectuée** : transitions limitées + actions UI (même pattern que tâches / devis).

### H10 — Recherche globale / Ctrl+K inerte
- **Zone** : Topbar
- **Problème** : champ « Rechercher… » et raccourci affichés, aucun handler.
- **Impact** : affordance fausse (spec UX recherche globale).
- **Correction recommandée** : commande palette (Company, Contact, Opportunity, Project, Task, Quote). Refactor UI dédié, hors correctif à faible risque.

### H11 — Pas d’authentification
- **Zone** : App globale / `getActorUser`
- **Problème** : premier utilisateur créé à la volée (`os@versatech.example`). Product spec MVP : authentification.
- **Impact** : pas de session, pas de permissions futures, acteur technique si seed absent.
- **Correction effectuée** (branche `feature/auth-v1`) : login interne + session JWT, routes métier protégées, Server Actions via `requireActor()`, actor ActivityLog = utilisateur authentifié.

### H12 — Probabilité toujours à 0 (BR-017)
- **Zone** : Opportunity
- **Problème** : `probability` défaut 0, jamais saisi ni dérivé. Pipeline pondéré impossible.
- **Impact** : KPI pondéré faux / absent.
- **Correction recommandée** : probabilités par stage (configurables) + saisie manuelle ; KPI pondéré = Σ valeur × p.

### H13 — Fuseau Europe/Paris vs minuit serveur
- **Zone** : Dates (`startOfToday` / `endOfToday` vs header dashboard)
- **Problème** : le header formate en `Europe/Paris` ; les buckets relances / tâches / agenda utilisent le fuseau du process Node.
- **Impact** : en prod UTC, décalage des « aujourd’hui » / relances dues.
- **Correction recommandée** : helper unique « jour civil Paris » pour tous les bornes.

### H14 — Revenir d’un WON ne corrige pas le lifecycle
- **Zone** : Pipeline
- **Problème** : `wonAt` / `lostAt` uniquement posés, jamais effacés. Company reste `CLIENT` si on recule le stage.
- **Impact** : historique et listes Clients incohérents.
- **Correction recommandée** : politique explicite (interdire de quitter WON/LOST, ou rollback lifecycle seulement s’il n’y a plus d’autre WON).

### H15 — Lifecycle Company modifiable à la main
- **Zone** : Edit Company
- **Problème** : `lifecycleStatus` libre (CLIENT sans WON, LEAD avec projets).
- **Impact** : contournement BR-001 / workflow Gagné → Client.
- **Correction recommandée** : transitions contraintes, ou champ lecture seule + actions métier.

### H16 — Stubs Calendrier / GitHub / Documents
- **Zone** : `/calendrier`, `/github`, `/documents` + Agenda dashboard
- **Problème** : `SectionPlaceholder`. L’agenda dashboard n’affichait que tâches / jalons / deadlines projet du jour, pas d’événements `CalendarEvent`.
- **Impact** : navigation vers des modules vides.
- **Correction effectuée (intégration A/B/C)** : Calendrier V1 (agrégation + CRUD événements manuels + Agenda `getTodayAgenda()`), GitHub V1 (association repo + hub + `/github`), Documents V1 (registre + hubs). `getTodayDeadlines()` n’est plus utilisé.

---

## MEDIUM

### M1 — Projets sans deadline en tête de liste
- **Zone** : `/projets`
- **Problème** : `orderBy dueDate asc` (NULLS FIRST Postgres).
- **Impact** : projets datés noyés.
- **Correction effectuée** : `nulls: "last"`.

### M2 — Montants affichés sans centimes
- **Zone** : `formatMoney`
- **Problème** : `maximumFractionDigits: 0` arrondissait 1499,50 €.
- **Impact** : devis / CA visuellement faux.
- **Correction effectuée** : 0 à 2 décimales.

### M3 — Pipeline sans drag & drop
- **Zone** : Pipeline
- **Problème** : spec UX = kanban DnD + confirmation WON/LOST. Implémenté : `<select>`.
- **Impact** : friction desktop, OK mobile.
- **Correction recommandée** : DnD plus tard ; le select + confirm/prompt est acceptable en V1.

### M4 — Company Hub sans onglets spec
- **Zone** : Company Hub
- **Problème** : spec = Aperçu / Contacts / Activité / Opportunités / Projets / Documents / Finance. Page plate.
- **Impact** : densité ; Finance toujours hors scope. Documents sont maintenant visibles dans les hubs (sans onglets).
- **Correction recommandée** : onglets quand Documents/Finance arriveront. Opportunités / devis / projets sont maintenant visibles.

### M5 — Référence devis `count + 1` (course)
- **Zone** : `nextQuoteReference`
- **Problème** : hors transaction ; trous si suppression ; collision unique `P2002`.
- **Impact** : erreur générique « Impossible de créer le devis ».
- **Correction recommandée** : séquence / retry sur P2002 dans la transaction.

### M6 — Listes non paginées
- **Zone** : Entreprises, Pipeline, Relances, Devis, Clients, Projets
- **Problème** : architecture exige pagination des historiques.
- **Impact** : perf à moyen volume (quelques années).
- **Correction recommandée** : cursor pagination, sans changer le modèle.

### M7 — Dashboard relances surcharge
- **Zone** : `getFollowUpDashboard`
- **Problème** : charge **toutes** les relances pending pour n’en afficher 4.
- **Impact** : N petit aujourd’hui, coût linéaire plus tard.
- **Correction recommandée** : requête bornée overdue+today+upcoming `take`.

### M8 — Un seul contact éditable
- **Zone** : Company Hub / updateCompany
- **Problème** : contact principal only ; pas d’ajout de contacts.
- **Impact** : modèle Contact sous-utilisé.
- **Correction recommandée** : CRUD contacts, unique `isPrimary` par company.

### M9 — Tâche TODO → DONE interdit
- **Zone** : Tasks
- **Problème** : TODO ne peut aller qu’en IN_PROGRESS ou CANCELED.
- **Impact** : deux clics pour une micro-tâche.
- **Correction recommandée** : autoriser TODO → DONE si produit validé.

### M10 — Tâches / jalons DONE ou CANCELED irréversibles
- **Zone** : Tasks, Milestones
- **Problème** : transitions sortantes vides.
- **Impact** : erreur de clic définitive.
- **Correction recommandée** : réouverture DONE → IN_PROGRESS / PENDING.

### M11 — Devis : pas de EXPIRED, SENT peut sauter VIEWED
- **Zone** : Quotes
- **Problème** : `EXPIRED` dans l’enum, aucune transition. VIEWED optionnel.
- **Impact** : devis périmés restent SENT.
- **Correction recommandée** : action « Expirer » + job plus tard (pas d’automatisation V1 forcée).

### M12 — Message Clients trompeur
- **Zone** : `/clients` empty state
- **Problème** : « après l’acceptation d’un devis » alors que WON pipeline passe aussi en CLIENT.
- **Impact** : incompréhension du workflow.
- **Correction recommandée** : « après une opportunité gagnée ou un devis accepté ».

### M13 — Tâches uniquement depuis un projet
- **Zone** : Tasks
- **Problème** : schéma : `companyId` / `opportunityId` / `projectId` nullable. UI : création seulement via projet. `/taches` ne liste que les ouvertes (projet ou non).
- **Impact** : pas de tâche commerciale autonome (spec « relation facultative »).
- **Correction recommandée** : création depuis dashboard / company avec liens optionnels.

### M14 — `qualificationScore` jamais exposé
- **Zone** : CRM
- **Problème** : champ seedé, absent UI (BR-009 score explicable).
- **Impact** : qualification opaque.
- **Correction recommandée** : afficher le score + source, pas d’IA auto-validante.

### M15 — Overlay lignes de tableaux
- **Zone** : explorers Entreprises / Clients / Projets
- **Problème** : `after:absolute after:inset-0` sur le nom rend la ligne entière cliquable vers la fiche, au détriment d’un lien projet distinct.
- **Impact** : nav projet depuis Clients impossible dans le tableau.
- **Correction recommandée** : lien projet en `relative z-10`.

### M16 — Finances / Analytics / Paramètres / Notifications
- **Zone** : pages stub + cloche topbar
- **Problème** : placeholders. Hors scope d’implémentation demandé.
- **Correction recommandée** : plus tard. KPI dashboard couvrent déjà un sous-ensemble (pipeline brut, CA signé).

---

## LOW

### L1 — Helper `logActivity` inutilisé
- **Zone** : `src/lib/crm/activity.ts`
- **Problème** : les actions inlinent `activityLog.create`.
- **Correction recommandée** : centraliser pour typer le metadata.

### L2 — Activité récente sans lien vers l’entité
- **Zone** : Dashboard / Project Hub
- **Problème** : logs texte only.
- **Correction recommandée** : résoudre `entityType` + `metadata.companyId` vers `/entreprises/:id` / `/projets/:id`.

### L3 — Pipeline mobile réutilise EmptyState
- **Zone** : `pipeline-preview.tsx`
- **Problème** : même composant « vide » pour afficher « N opportunités ».
- **Correction recommandée** : compteur simple.

### L4 — Sommes Decimal via `Number()`
- **Zone** : pipeline, clients
- **Problème** : float JS sur Decimal(12,2). OK à l’échelle V1, pas comptable.
- **Correction recommandée** : addition en string/cents si Finance arrive.

### L5 — `hasOpenOpportunity` plus consommé par le hub
- **Zone** : `CompanyDetail`
- **Problème** : champ conservé, plus d’usage UI après H7.
- **Correction recommandée** : supprimer plus tard ou réutiliser.

### L6 — Création d’opportunité encore autorisée en WON/LOST côté API historique
- **Zone** : create opportunity
- **Problème** : UI limitée aux stages ouverts ; timestamps WON sur create restent no-op.
- **Correction effectuée (partielle)** : schéma Zod + select = `OPEN_OPPORTUNITY_STAGES`.

### L7 — Notifications topbar sans action
- **Zone** : `app-topbar.tsx`
- **Correction recommandée** : masquer jusqu’à un vrai centre d’alertes (relances dues).

### L8 — Pas de `not-found` dédié `/projets/[id]`
- **Zone** : Project Hub
- **Problème** : fallback `not-found.tsx` global (« page n’existe pas encore »).
- **Correction recommandée** : copie du not-found entreprise.

### L9 — GitHub / documents dans les hubs
- **Zone** : Company Hub / Project Hub
- **Problème** : sections absentes au moment de l’audit.
- **Correction effectuée (intégration)** : `DocumentSection` (Company + Project), `ProjectGithubSection` + `ProjectStatusActions` sur le Project Hub.

---

## État actuel des modules hors périmètre Audit (ne pas implémenter Finance / Analytics ici)

| Route | État |
| --- | --- |
| `/calendrier` | **Livré** — vue mois, agrégation, CRUD événements manuels |
| `/github` | **Livré** — association repo, hub projet, état Hors API |
| `/documents` | **Livré** — registre métadonnées + URL externe, hubs |
| `/finances` | Stub (hors scope) |
| `/analytics` | Stub (hors scope) |
| `/parametres` | Stub |
| Dashboard Agenda | **Livré** — `getTodayAgenda()` (CalendarEvent + relances + tâches + jalons + deadlines) |

---

## Corrections effectuées (fichiers)

Voir liste git du worktree. Points clés :

- Cycle de vie : devis → stage QUOTE ; LOST + raison ; multi-opportunités UI ; statut projet.
- Données affichées : activité, KPI appels/RDV, leads à appeler, `/taches`, opportunités hub, actions devis hub.
- Revalidation élargie (`revalidate.ts` **partagé** — les autres agents devront l’étendre, pas l’écraser).
- Liaison Interaction/FollowUp → opportunité ouverte + fallback pipeline.
- Money / tri projets.

**Non modifié** : `prisma/schema.prisma`, pages calendrier/github/documents, `agenda-panel.tsx`.

---

## Tests

- `npx tsc --noEmit` : 5 erreurs **préexistantes** hors `.next` (`PageProps` / `LayoutProps` générés par `next dev`). Aucune erreur sur les fichiers touchés.
- `npm run lint` : OK (exit 0).
- Pas de `next build` (consigne).
- Pas de suite de tests unitaires dans le repo.
- Navigateur : un `npm run dev` tourne déjà sur le worktree **main** (`http://localhost:3000`). Aucun 2ᵉ serveur lancé. Les correctifs de `fix/audit-v1` n’y sont donc **pas** hot-reloadés. Outil browser MCP indisponible (onglet non attachable). Vérification visuelle à faire après bascule du serveur sur ce worktree.

---

## Notes d’intégration (fichiers partagés)

- **`src/lib/crm/revalidate.ts`** : union Dashboard (`/`), `/pipeline`, `/clients`, `/taches`, `/calendrier`, `/github`, `/documents`.
- **Dashboard `src/app/page.tsx`** : `getTodayAgenda()` **et** KPI appels/RDV + activité récente + file LEAD. Pas de `getTodayDeadlines()`.
- **Company Hub / Project Hub** : Opportunités / devis / statut projet **plus** Documents / GitHub.
- **Actions** `interactions.ts`, `follow-ups.ts`, `quotes.ts`, `opportunities.ts`, `projects.ts` : comportements métier V1 (opportunityId, QUOTE, lostReason, statut projet).
- **Pas de schema / migration.** ENV : `GITHUB_TOKEN` optionnel (GitHub V1).
