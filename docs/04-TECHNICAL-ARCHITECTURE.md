VERSATECH OS — ARCHITECTURE TECHNIQUE

1. ARCHITECTURE
Monolithe web modulaire. Pas de microservices en V1.

2. STACK CIBLE
- Next.js App Router
- TypeScript strict
- React
- Tailwind CSS
- shadcn/ui
- PostgreSQL
- Prisma ORM
- Zod
- React Hook Form lorsque pertinent
- Auth.js ou solution d'auth validée au moment de l'implémentation
- Recharts pour les graphiques
- Lucide pour les icônes

3. ENVIRONNEMENT
Développement : WSL2/Linux.
Node : version LTS/compatible Next retenue au setup.
Gestionnaire : npm initialement.
GitHub : repository privé.

4. STRUCTURE CIBLE
src/
  app/
  components/
    ui/
    layout/
    dashboard/
    crm/
    pipeline/
    projects/
  features/
  lib/
    db/
    auth/
    validations/
    integrations/
  server/
  types/
  styles/
prisma/
docs/
tests/

La structure exacte peut être ajustée avant implémentation ; éviter les dossiers génériques fourre-tout.

5. FRONT/BACK
Server Components par défaut.
Client Components seulement pour interaction navigateur nécessaire.
Mutations via Server Actions ou Route Handlers selon le cas.
Accès BDD exclusivement côté serveur.

6. VALIDATION
Toute entrée utilisateur doit être validée côté serveur avec Zod.
La validation client améliore l'UX mais ne remplace jamais la validation serveur.

7. DATABASE
PostgreSQL.
Prisma migrations versionnées.
Seed de développement avec données fictives.
Aucune donnée client réelle dans le seed Git.

8. CONFIGURATION
Secrets uniquement dans variables d'environnement.
.env jamais commité.
.env.example sans valeurs sensibles.

9. ERREURS
- erreurs métier compréhensibles ;
- erreurs techniques journalisées côté serveur ;
- UI avec états loading/empty/error ;
- ne pas exposer stack traces ou secrets.

10. PERFORMANCE
- pagination pour historiques/listes importantes ;
- requêtes ciblées ;
- index BDD ;
- éviter N+1 ;
- cache uniquement lorsqu'il ne crée pas de données commerciales périmées.

11. API EXTERNE
Créer un adapter par fournisseur : GitHub, Calendar, etc.
Le domaine métier ne doit pas dépendre directement du format de réponse externe.

12. OBSERVABILITÉ
Journalisation structurée.
ActivityLog pour événements métier ; logs techniques séparés.

13. TESTABILITÉ
La logique métier importante doit être isolable de l'UI.
Pas de calcul de KPI uniquement dans des composants React.

14. PRINCIPES
- simplicité avant abstraction ;
- pas de microservice prématuré ;
- pas de dépendance sans besoin ;
- types stricts ;
- migrations reproductibles ;
- composants métier séparés des composants UI génériques.
