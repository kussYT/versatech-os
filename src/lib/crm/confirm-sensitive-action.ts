import type { FormEvent } from "react";

export const SENSITIVE_ACTION_CONFIRMS = {
  quoteAccepted:
    "Accepter ce devis ? Le CA signé sera mis à jour et l'opportunité liée pourra passer en Gagné.",
  quoteRejected:
    "Refuser ce devis ? Cette décision clôt le devis dans le workflow actuel.",
  paymentPaid:
    "Marquer ce paiement comme encaissé ? Le montant sera compté dans le CA encaissé.",
  paymentCanceled:
    "Annuler ce paiement ? Il ne sera plus compté dans les encaissements ni le restant dû.",
  maintenanceActivate:
    "Activer ce contrat de maintenance ? Il pourra entrer dans le MRR.",
  maintenancePause:
    "Suspendre ce contrat de maintenance ? Il sortira du MRR tant qu'il restera suspendu.",
  maintenanceEnd:
    "Terminer ce contrat de maintenance ? Il sortira définitivement du MRR.",
  projectCompleted:
    "Marquer ce projet comme terminé ? Cela clôt le développement et compte comme mise en ligne.",
  projectArchived: "Archiver ce projet ? Il sortira des projets actifs.",
  unlinkGithub: (repo: string) =>
    `Retirer l'association GitHub « ${repo} » de ce projet ? Le dépôt ne sera plus lié dans VersaTech OS.`,
  removeTourCompany: (companyName: string) =>
    `Retirer « ${companyName} » de la tournée du jour ?`,
} as const;

export function confirmSensitiveAction(
  message: string,
  confirmFn: (prompt: string) => boolean = (prompt) => window.confirm(prompt),
) {
  return confirmFn(message);
}

export function preventUnconfirmedSubmit(
  message: string,
  confirmFn?: (prompt: string) => boolean,
) {
  return (event: Pick<FormEvent<HTMLFormElement>, "preventDefault">) => {
    if (!confirmSensitiveAction(message, confirmFn ?? ((prompt) => window.confirm(prompt)))) {
      event.preventDefault();
    }
  };
}
