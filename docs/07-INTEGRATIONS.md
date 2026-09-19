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

CALENDRIER
Source de vérité : CalendarEvent interne.
Puis synchronisation Google Calendar éventuelle.
V1 sync souhaitée :
- créer/mettre à jour les RDV VersaTech dans calendrier externe ;
- conserver externalId ;
- gérer erreurs et conflits ;
- afficher lastSyncedAt.
Ne pas supprimer silencieusement un événement métier si le fournisseur externe échoue.

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
VersaTech AI (ADR-014) : tools contrôlés → services métier → Prisma. Inférence par défaut : Ollama auto-hébergé sur la même machine (`http://127.0.0.1:11434`, modèle `qwen3:1.7b`). Pas de clé API. Le navigateur ne parle qu'à `/api/ai/chat`. Ne pas publier Ollama (pas de reverse-proxy Caddy sur :11434). OpenAI / Anthropic / Google restent optionnels et explicites, sans fallback payant automatique.
Recherche web : un seul adapter SearXNG (SSRF, budget serveur). Pas de `fetch` arbitraire dans l'agent.
L'IA ne doit pas modifier silencieusement les données critiques (WRITE avec confirmation serveur ; CRITICAL interdit).

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
