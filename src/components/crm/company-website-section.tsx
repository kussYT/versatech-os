import type { ReactNode } from "react";
import { ArrowUpRight, Globe } from "lucide-react";
import Link from "next/link";
import { WebsiteStatusBadge } from "@/components/crm/website-status-badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MAINTENANCE_STATUS_LABELS } from "@/lib/crm/constants";
import { formatDate, formatMoney } from "@/lib/crm/form-data";
import { cn } from "@/lib/cn";
import type { WebsiteStatusView } from "@/lib/website/status";

type CompanyWebsiteSectionProps = {
  model: WebsiteStatusView;
};

export function CompanyWebsiteSection({ model }: CompanyWebsiteSectionProps) {
  const isEmpty = model.status === "NO_WEBSITE" && !model.url && !model.project;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Globe className="size-4 text-muted" aria-hidden="true" />
          <h2 className="text-section text-foreground">Site internet</h2>
        </div>
        {model.status && model.status !== "NO_WEBSITE" ? (
          <WebsiteStatusBadge status={model.status} />
        ) : null}
      </div>

      {isEmpty ? (
        <EmptyState
          title="Aucun site géré"
          description="Pas d'URL ni de projet site pour cette entreprise."
        />
      ) : (
        <div className="mt-4 space-y-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <WebsiteField label="URL">
              {model.url ? (
                <a
                  href={model.url.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex max-w-full items-center gap-1 break-all text-primary hover:text-primary-hover"
                >
                  <span className="truncate">{model.url.host}</span>
                  <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="sr-only">Ouvrir le site</span>
                </a>
              ) : (
                "—"
              )}
            </WebsiteField>
            <WebsiteField label="Projet">
              {model.project ? (
                <Link href={model.project.href} className="text-primary hover:text-primary-hover">
                  {model.project.name}
                </Link>
              ) : (
                "Aucun projet lié"
              )}
            </WebsiteField>
            {model.goLive ? (
              <WebsiteField label="Mise en ligne">
                {formatDate(model.goLive.at)}
                <span className="ml-1 text-meta text-faint">effective</span>
              </WebsiteField>
            ) : null}
            {model.maintenance ? (
              <WebsiteField label="Maintenance">
                <span className="font-sans tabular-nums">
                  {formatMoney(model.maintenance.monthlyAmount)}
                  <span className="ml-1 text-meta font-normal text-muted">/ mois</span>
                </span>
                <span className="mt-0.5 block text-meta text-faint">
                  {MAINTENANCE_STATUS_LABELS[model.maintenance.status]}
                  {model.maintenance.started
                    ? ` · depuis ${formatDate(model.maintenance.startDate)}`
                    : ` · dès ${formatDate(model.maintenance.startDate)}`}
                </span>
              </WebsiteField>
            ) : null}
          </dl>

          <div className="flex flex-wrap gap-2">
            {model.project ? (
              <Link
                href={model.project.href}
                className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
              >
                Voir le projet
              </Link>
            ) : null}
            {model.url ? (
              <a
                href={model.url.href}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
              >
                Ouvrir le site
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </a>
            ) : null}
          </div>
        </div>
      )}
    </Card>
  );
}

function WebsiteField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-meta text-faint">{label}</dt>
      <dd className="mt-0.5 text-body text-foreground">{children}</dd>
    </div>
  );
}
