VERSATECH OS — SÉCURITÉ

1. CONTEXTE
Le système pourra contenir coordonnées professionnelles, historique de contacts, montants commerciaux, documents et informations internes. Il doit être privé par défaut.

2. AUTHENTIFICATION
Authentification obligatoire hors éventuelle page de login.
Sessions sécurisées.
MFA à envisager avant exposition importante de données.

3. AUTORISATION
V1 admin unique.
Prévoir un modèle de rôle sans complexifier l'interface.
Toute vérification sensible doit être côté serveur.

4. SECRETS
.env hors Git.
Tokens API serveur uniquement.
Rotation possible.
Permissions minimales.

5. BASE DE DONNÉES
Connexion chiffrée en production.
Backups.
Accès réseau limité.
Pas de mot de passe ou token externe stocké en clair dans une table métier.

6. DONNÉES CLIENT
Minimisation : stocker ce qui sert réellement.
Éviter les données personnelles sensibles sans nécessité.
Prévoir suppression/anonymisation si besoin.
Les notes libres doivent rester professionnelles.

7. VALIDATION
Validation serveur de toute entrée.
Protection contre injection via ORM + pratiques sûres.
Échappement/rendu sécurisé du contenu utilisateur.

8. WEB
HTTPS production.
Cookies Secure/HttpOnly/SameSite appropriés.
Protection CSRF selon mécanisme d'auth/action utilisé.
Headers de sécurité.
Rate limiting pour endpoints sensibles/publics.

9. FICHIERS
Valider type/taille si upload futur.
Ne pas servir arbitrairement un fichier privé via URL publique.

10. INTÉGRATIONS
OAuth/scopes minimaux.
Tokens chiffrés ou stockage de secrets adapté.
Vérification webhooks.
Logs sans secrets.

11. JOURNALISATION
Tracer actions importantes : changements de statut, paiements, suppressions, configuration.
Ne pas logger tokens, mots de passe ou contenu inutilement sensible.

12. SUPPRESSION
Actions destructrices explicites.
Soft delete/archivage privilégié pour données commerciales historiques quand pertinent.

13. POSTE PROFESSIONNEL
Le développement sous WSL ne doit pas servir à contourner les politiques IT de l'entreprise. Respecter les restrictions de l'environnement de travail.

14. AVANT PRODUCTION
Audit dépendances, configuration auth, permissions, secrets, sauvegardes, restauration testée et revue des endpoints.
