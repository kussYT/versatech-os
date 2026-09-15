VERSATECH OS — DÉPLOIEMENT & EXPLOITATION

ENVIRONNEMENTS
Local : WSL.
Preview/Staging : recommandé avant production.
Production : application privée HTTPS + PostgreSQL managé ou sécurisé.

GIT
Branches simples.
main = stable.
Feature branches pour changements significatifs.
Commits conventionnels recommandés : feat, fix, docs, chore, refactor, test.

CI/CD
- lint ;
- typecheck ;
- tests ;
- build ;
- migration contrôlée ;
- déploiement.

DATABASE
Migrations Prisma versionnées.
Sauvegarde automatique production.
Tester périodiquement la restauration.
Ne jamais exécuter une migration destructive sans backup/revue.

SECRETS
Gérés par plateforme de déploiement, jamais dans Git.

MONITORING
- disponibilité ;
- erreurs serveur ;
- erreurs intégrations ;
- latence ;
- santé BDD ;
- synchronisations échouées.

MAINTENANCE
Mettre dépendances à jour régulièrement, sans auto-upgrade aveugle.
Changelog pour évolutions significatives.

DOMAINE
Prévoir sous-domaine privé type app/office/os de VersaTech uniquement au moment du déploiement. Nom final à valider.

PWA
Option future utile pour accès mobile rapide ; ne doit pas bloquer le MVP.
