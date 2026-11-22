VERSATECH OS — INTÉGRATIONS

PRINCIPE
Développer d'abord le métier interne, puis connecter les services. Chaque intégration doit avoir un adapter et pouvoir être désactivée sans casser le cœur de l'application.

GITHUB
Objectif : rattacher un repository à un Project et afficher l'activité technique.
Lecture V1 :
- repository ;
- branche par défaut ;
- derniers commits ;
- issues ;
- pull requests ;
- statut workflows/deployments si utile.
Écriture GitHub : hors scope initial.
Sécurité : token serveur uniquement, permissions minimales, jamais dans le navigateur.
Variable : GITHUB_TOKEN (optionnelle). Sans token, l'association locale reste possible ; l'activité live est masquée.

CALENDRIER / GOOGLE CALENDAR (V2.3 — figé)
Direction : Google Calendar → VersaTech OS en lecture, avec push optionnel des rendez-vous CRM (CalendarEvent type MEETING uniquement) vers Google.
Décisions validées :
- Google est la source de vérité pour les événements **importés**.
- Les rendez-vous CRM restent pilotés depuis VersaTech OS.
- Uniquement les CalendarEvent de type rendez-vous/réunion sont poussés (pas de relances, tâches, visites terrain).
- Aucun doublon lors des synchronisations (`externalProvider` + `externalId` uniques).
- Aucune suppression automatique dans Google sans confirmation explicite.
- Les événements Google importés sont clairement identifiables dans le planning.
- Le push vers Google est optionnel (paramètre de connexion, désactivé par défaut).
- V2.3.1 : si le push est activé, chaque création/modification d’un RDV CRM (`CalendarEvent` type MEETING) déclenche un push ciblé automatique (idempotent via `externalId`). Le rattrapage manuel reste disponible. Échec Google ≠ échec CRM.
- Fuseau : Europe/Paris par défaut ; respecter les fuseaux des événements Google.
- Connexion / déconnexion depuis Paramètres.
- Tokens OAuth chiffrés côté serveur uniquement.
- Première connexion : aucun écriture dans Google (pas de push tant que non activé ; pas de mutation des événements Google existants).

Variables serveur (jamais exposées au navigateur) :
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GOOGLE_REDIRECT_URI (ex. http://localhost:3000/api/integrations/google/oauth/callback)

Scopes minimaux : `openid`, `email`, `https://www.googleapis.com/auth/calendar.events` (events du calendrier sélectionné).

GOOGLE DRIVE / STOCKAGE
V1 : Document peut contenir une URL externe.
Plus tard : sélecteur/connexion Drive ou stockage objet.
Ne pas dupliquer inutilement les fichiers.

EMAIL
Phase future.
Cas d'usage :
- journaliser e-mails liés à un client ;
- éventuellement proposer modèles/relances.
Ne pas construire une boîte mail complète.

SHINE / FACTURATION
VersaTech OS est cockpit, pas logiciel comptable.
V1 : référence, montant, statut, lien externe saisi manuellement.
Intégration API seulement si disponible, stable et utile.

IA
VersaTech AI (ADR-014) est **retirée en V2.3**. Pas de surface `/api/ai`, pas de panel, pas d'Ollama câblé. Ne pas réintroduire sans phase explicite. La table `AiActionConsumption` peut rester en base pour l'historique des migrations.

WEB / PROSPECTION
Éventuelle intégration future pour enrichir un prospect : site, présence web, informations publiques. Toute donnée doit afficher sa provenance et sa date de récupération si automatisée.

WEBHOOKS
Prévoir un endpoint sécurisé pour fournisseurs supportant les événements temps réel.
Vérification signature obligatoire.

RÉSILIENCE
- timeout ;
- retry limité ;
- journal de synchronisation ;
- statut d'erreur visible ;
- idempotence lorsque nécessaire.
