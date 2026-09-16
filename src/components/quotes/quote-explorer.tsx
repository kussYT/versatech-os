"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { QuoteStatusActions } from "@/components/quotes/quote-status-actions";
import { QuoteStatusBadge } from "@/components/quotes/quote-status-badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { controlClassName } from "@/components/ui/field";
import { QUOTE_STATUS_LABELS, QUOTE_STATUSES } from "@/lib/crm/constants";
import { formatDateTime, formatMoney } from "@/lib/crm/form-data";
import type { QuoteListItem } from "@/lib/queries/quotes";

type QuoteExplorerProps = {
  quotes: QuoteListItem[];
};

export function QuoteExplorer({ quotes }: QuoteExplorerProps) {
  const [status, setStatus] = useState("all");

  const filtered = useMemo(() => {
    if (status === "all") {
      return quotes;
    }

    return quotes.filter((quote) => quote.status === status);
  }, [quotes, status]);

  if (quotes.length === 0) {
    return (
      <Card className="px-5">
        <EmptyState
          title="Aucun devis"
          description="Créez un devis depuis une fiche entreprise qui a une opportunité."
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
            {QUOTE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {QUOTE_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
      </Card>

      {filtered.length === 0 ? (
        <Card className="px-5">
          <EmptyState title="Aucun devis pour ce statut" />
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((quote) => (
            <article
              key={quote.id}
              className="rounded-xl border border-border bg-background/90 p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-body font-medium text-foreground">
                      {quote.reference}
                    </p>
                    <QuoteStatusBadge status={quote.status} />
                  </div>
                  <Link
                    href={`/entreprises/${quote.company.id}`}
                    className="mt-2 inline-block text-body text-primary hover:text-primary-hover"
                  >
                    {quote.company.name}
                  </Link>
                  <p className="mt-1 text-meta text-muted">{quote.opportunity.title}</p>
                  <p className="mt-2 font-sans text-body font-semibold tabular-nums text-foreground">
                    {formatMoney(quote.amountIncTax)}
                  </p>
                  <p className="mt-1 text-meta text-faint">
                    Créé {formatDateTime(quote.createdAt)}
                    {" · "}
                    {formatDateTime(quote.relevantAt)}
                  </p>
                </div>
                <QuoteStatusActions quoteId={quote.id} status={quote.status} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
