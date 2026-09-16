"use client";

import { useMemo, useState } from "react";
import { PaymentList } from "@/components/finances/payment-list";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { controlClassName } from "@/components/ui/field";
import { PAYMENT_STATUS_LABELS } from "@/lib/crm/constants";
import { PAYMENT_STATUSES } from "@/lib/finance";
import type { PaymentListItem } from "@/lib/queries/payments";

type PaymentExplorerProps = {
  payments: PaymentListItem[];
  hideCompany?: boolean;
};

export function PaymentExplorer({ payments, hideCompany = false }: PaymentExplorerProps) {
  const [status, setStatus] = useState("all");

  const filtered = useMemo(() => {
    if (status === "all") {
      return payments;
    }

    return payments.filter((payment) => payment.effectiveStatus === status);
  }, [payments, status]);

  if (payments.length === 0) {
    return (
      <Card className="px-5">
        <EmptyState
          title="Aucun paiement"
          description="Enregistrez un acompte ou un solde rattaché à une entreprise, un devis accepté ou un projet."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <label className="block max-w-xs">
          <span className="mb-1.5 block text-meta font-medium text-muted">Statut</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className={controlClassName}
          >
            <option value="all">Tous</option>
            {PAYMENT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {PAYMENT_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
      </Card>

      {filtered.length === 0 ? (
        <Card className="px-5">
          <EmptyState title="Aucun paiement pour ce statut" />
        </Card>
      ) : (
        <PaymentList payments={filtered} hideCompany={hideCompany} />
      )}
    </div>
  );
}
