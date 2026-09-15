VERSATECH OS — TESTS & QUALITÉ

OBJECTIF
Tester surtout ce qui peut provoquer une mauvaise décision commerciale, une perte de données ou une rupture de workflow.

UNIT TESTS
- calcul KPI ;
- transitions de statut ;
- pipeline pondéré ;
- MRR ;
- score prospect lorsque défini ;
- règles de dates/relances ;
- validateurs.

INTEGRATION TESTS
- création Company + Contact ;
- Interaction -> FollowUp ;
- Opportunity -> WON -> Project ;
- Quote/Payment ;
- accès BDD ;
- adapters externes simulés.

E2E
Parcours critiques :
1. login ;
2. créer prospect ;
3. enregistrer appel ;
4. programmer relance ;
5. déplacer opportunité ;
6. gagner opportunité ;
7. créer projet ;
8. retrouver les informations depuis dashboard.

QUALITÉ UI
- responsive desktop/mobile ciblé ;
- clavier ;
- focus ;
- contraste ;
- empty/error/loading ;
- reduced motion.

DONNÉES DE TEST
Uniquement fictives dans le repo.
Créer des scénarios réalistes, pas des lorem ipsum partout.

CI
À chaque PR/push principal selon stratégie :
- install ;
- lint ;
- typecheck ;
- tests ;
- build.

REVUE
Toute nouvelle dépendance doit avoir une justification.
Toute migration destructive doit être examinée avant application production.
