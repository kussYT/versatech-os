/** Prepared hook for Agent C. This worktree does not implement Tour. */
export function prospectionTourIntent(companyId: string) {
  return {
    href: `/tournee?add=${encodeURIComponent(companyId)}`,
    label: "Ajouter à la tournée",
  } as const;
}
