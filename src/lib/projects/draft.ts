export type ProjectSaleDraft = {
  companyId: string;
  name: string;
  amount: string;
  quoteId: string;
  description: string;
};

/**
 * Le montant du devis accepté est la source du budget projet.
 * L'estimation d'opportunité reste une hypothèse, pas le prix signé.
 */
export function projectDraftFromSale(input: {
  companyId: string;
  companyName: string;
  opportunityTitle: string;
  quoteAmountIncTax: string;
  quoteId: string;
}): ProjectSaleDraft {
  const title = input.opportunityTitle.trim();
  const company = input.companyName.trim();
  return {
    companyId: input.companyId,
    name: `${title} — ${company}`,
    amount: input.quoteAmountIncTax.trim(),
    quoteId: input.quoteId,
    description: "",
  };
}
