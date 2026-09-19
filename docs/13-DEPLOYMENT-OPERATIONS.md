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

VERSATECH AI / OLLAMA
Ollama tourne sur le même VPS que Next.js, en boucle locale uniquement :
- `VERSATECH_AI_PROVIDER=ollama`
- `VERSATECH_AI_MODEL=qwen3:1.7b`
- `OLLAMA_BASE_URL=http://127.0.0.1:11434`
Ne pas ajouter de route Caddy vers le port 11434. Ne pas ouvrir UFW 11434. L'app Next parle à Ollama en interne ; le navigateur n'atteint jamais Ollama.
Modèle volontairement petit (1.7b) : 2 vCPU / 4 Go RAM avec PostgreSQL, Caddy, Docker et SearXNG déjà présents. Ne pas précharger plusieurs modèles. Pas de second serveur d'inférence.
OPENAI_API_KEY n'est pas requis. Ne pas basculer silencieusement vers un LLM payant si Ollama est mal configuré.

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
