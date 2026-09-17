import Link from "next/link";
import { PaymentStatusActions } from "@/components/finances/payment-status-actions";
import { PaymentStatusBadge } from "@/components/finances/payment-status-badge";
import { formatDate, formatMoney } from "@/lib/crm/form-data";
import type { PaymentListItem } from "@/lib/queries/payments";

type PaymentListProps = {
  payments: PaymentListItem[];
  hideCompany?: boolean;
};

export function PaymentList({ payments, hideCompany = false }: PaymentListProps) {
  return (
    <ul className="space-y-2">
      {payments.map((payment) => (
        <li
          key={payment.id}
          className="flex flex-col gap-3 rounded-xl border border-border bg-background/60 px-4 py-3 lg:flex-row lg:items-start lg:justify-between"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-body font-medium text-foreground">{payment.label}</p>
              <PaymentStatusBadge status={payment.effectiveStatus} />
            </div>
            <p className="mt-2 font-sans text-body font-semibold tabular-nums text-foreground">
              {formatMoney(payment.amount)}
            </p>
            <p className="mt-1 text-meta text-muted">
              {!hideCompany ? (
                <>
                  <Link
                    href={`/entreprises/${payment.company.id}`}
                    className="text-primary hover:text-primary-hover"
                  >
                    {payment.company.name}
                  </Link>
                  {" · "}
                </>
              ) : null}
              {payment.quote ? `Devis ${payment.quote.reference}` : "Sans devis"}
              {payment.project ? (
                <>
                  {" · "}
                  <Link
                    href={`/projets/${payment.project.id}`}
                    className="text-primary hover:text-primary-hover"
                  >
                    {payment.project.name}
                  </Link>
                </>
              ) : null}
            </p>
            <p className="mt-1 font-mono text-meta text-faint">
              {payment.paidAt
                ? `Encaissé ${formatDate(payment.paidAt)}`
                : payment.dueAt
                  ? `Échéance ${formatDate(payment.dueAt)}`
                  : `Créé ${formatDate(payment.createdAt)}`}
              {payment.externalReference ? ` · ${payment.externalReference}` : ""}
            </p>
          </div>
          <PaymentStatusActions paymentId={payment.id} status={payment.effectiveStatus} />
        </li>
      ))}
    </ul>
  );
}
