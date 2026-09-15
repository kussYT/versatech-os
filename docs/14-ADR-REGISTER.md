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

AJOUT D'ADR
Créer un ADR lorsqu'une décision est coûteuse à inverser : auth, hébergement, stockage, architecture d'intégration, permissions, etc.
