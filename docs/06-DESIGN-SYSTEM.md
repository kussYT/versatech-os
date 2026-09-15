VERSATECH OS — DESIGN SYSTEM
Direction : MIDNIGHT INTELLIGENCE x HOLOGRAPHIC DATA

1. INTENTION
Application SaaS professionnelle bleu nuit, dense mais élégante, avec forte codification visuelle. Inspiration foil/holographique de cartes premium : reflets subtils, jamais esthétique gaming/RGB.

2. TYPOGRAPHIE
Geist Sans : interface entière.
Geist Mono : IDs, références, hashes, branches, timestamps ou valeurs techniques.
Hiérarchie indicative :
H1 32/700
KPI 28-32/650
H2 20-24/650
Section 16/600
Body 14/400-500
Meta 12-13/400
Badge 11/600 uppercase facultatif.

3. TOKENS COULEUR
Background: #050814
Sidebar: #080D1C
Surface: #0B1224
Surface High: #101A30
Border: #1C2944
Text Primary: #F4F7FF
Text Secondary: #9CAAC4
Text Muted: #66738C
Primary: #4C7DFF
Primary Hover: #6E9BFF
Primary Active: #365FE5
Cyan: #52E5FF
Purple: #9B7CFF
Pink: #F472B6
Success: #34D399
Warning: #FBBF24
Orange: #FB923C
Danger: #FB7185

4. HOLOGRAPHIC GRADIENT
#4C7DFF -> #52E5FF -> #9B7CFF -> #F472B6 -> #4C7DFF.
Utilisation faible opacité, principalement bordure/reflet hover.

5. CARTES
Card : surface solide, bordure discrète.
InteractiveCard : légère élévation + reflet foil au hover.
PremiumCard : réservée KPI majeurs/événements importants.
Interdit : glow massif permanent, néon, rainbow saturé.

6. RADIUS
Petits éléments : 8px.
Cards : 12-16px.
Modales : 16-20px.
Pills/badges : radius complet.

7. OMBRES
Très discrètes, froides, principalement pour séparer les niveaux. La profondeur doit venir surtout des surfaces/bordures.

8. BOUTONS
Primary : bleu VersaTech, hover plus clair, translateY(-1px) possible.
Secondary : midnight + bordure.
Ghost : navigation/actions secondaires.
Danger : uniquement actions destructrices.
Transitions 150-220ms.

9. CODES MÉTIER
Prospect : bleu.
Contacté : violet.
Intéressé : jaune.
RDV : orange.
Devis : cyan.
Gagné : vert.
Perdu : rouge/rose.
Toujours ajouter texte/icône ; jamais couleur seule.

10. INTERACTIONS / REPÈRES
Appel : téléphone.
Email : enveloppe.
RDV : poignée de main/calendrier.
Message : bulle.
Note : note.
Devis : document.
Paiement : euro.
Relance : rotation/clock.
GitHub : GitHub.
Déploiement : rocket.
Dans les contrôles UI, privilégier Lucide. Les emojis peuvent servir de repères dans timeline, résumé et contenu humain.

11. PRIORITÉ
URGENT rouge
HIGH orange
MEDIUM jaune
NORMAL bleu
LOW gris

12. PROSPECT SCORE
HOT 80-100
WARM 60-79
COOL 40-59
LOW <40
Le score doit être explicable ; ne pas afficher une fausse précision si le calcul n'est pas encore défini.

13. ANIMATIONS
Hover 180-250ms.
Modales : fade/scale léger.
Kanban : mouvement court.
Respect prefers-reduced-motion.
Effet holographique piloté par CSS ; suivi souris seulement si performant et discret.

14. BACKGROUND
Fond #050814 avec gradients radiaux bleu/violet très faibles. Pas de texture gênant la lecture.

15. GLASS
Réservé aux overlays : command palette, menus flottants, tooltips, éventuellement topbar. Cards métier solides.

16. GRAPHIQUES
Fond transparent.
Couleurs fonctionnelles cohérentes.
Tooltips sombres.
Éviter de multiplier les couleurs sans signification.

17. DENSITÉ
Beaucoup d'informations mais hiérarchie forte : whitespace contrôlé, tables compactes, badges lisibles.

18. IDENTITÉ
Le produit doit être reconnaissable par : bleu nuit profond + Geist + bleu électrique + données codées + micro-reflets cyan/violet/rose.
