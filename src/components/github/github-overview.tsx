import type { ReactNode } from "react";
import Link from "next/link";
import { GitBranch } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/crm/form-data";
import type { GitHubOverview, GitHubOverviewItem } from "@/lib/queries/github";

type GithubOverviewProps = {
  overview: GitHubOverview;
};

export function GithubOverview({ overview }: GithubOverviewProps) {
  return (
    <div className="space-y-4">
      {!overview.configured ? (
        <Card className="p-5">
          <EmptyState
            icon={GitBranch}
            title="GitHub n'est pas configuré"
            description="Ajoutez GITHUB_TOKEN dans les variables d'environnement serveur pour charger la branche principale, les derniers commits et la dernière activité. Les associations déjà enregistrées restent visibles."
          />
        </Card>
      ) : null}

      {overview.items.length === 0 ? (
        <Card className="px-5">
          <EmptyState
            title="Aucun repository associé"
            description="Rattachez un dépôt GitHub depuis la fiche d'un projet. VersaTech n'en crée aucun automatiquement."
            action={
              <Link href="/projets" className="text-meta text-primary hover:text-primary-hover">
                Ouvrir les projets
              </Link>
            }
          />
        </Card>
      ) : (
        <ul className="space-y-4">
          {overview.items.map((item) => (
            <li key={item.id}>
              <GithubOverviewCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GithubOverviewCard({ item }: { item: GitHubOverviewItem }) {
  return (
    <Card className="p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-meta text-muted">
            <Link href={`/projets/${item.project.id}`} className="text-primary hover:text-primary-hover">
              {item.project.name}
            </Link>
            <span className="text-faint"> · {item.project.companyName}</span>
          </p>
          <h2 className="mt-1 text-section text-foreground">
            {item.owner}/{item.name}
          </h2>
        </div>
        <LiveLabel live={item.live} />
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InfoItem label="Propriétaire">{item.owner}</InfoItem>
        <InfoItem label="Nom">{item.name}</InfoItem>
        <InfoItem label="Branche principale">{item.defaultBranch || "—"}</InfoItem>
        <InfoItem label="Dernière activité">
          {item.lastActivityAt ? formatDateTime(item.lastActivityAt) : "—"}
        </InfoItem>
      </dl>

      <p className="mt-3 text-body">
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="text-primary hover:text-primary-hover break-all"
        >
          {item.url}
        </a>
      </p>

      {item.errorMessage ? (
        <p className="mt-3 text-meta text-danger" role="alert">
          {item.errorMessage}
        </p>
      ) : null}

      <div className="mt-4 border-t border-border pt-4">
        <h3 className="text-meta font-medium tracking-[0.08em] text-muted uppercase">
          Derniers commits
        </h3>
        {item.commits.length === 0 ? (
          <p className="mt-2 text-meta text-muted">
            {item.live === "unconfigured"
              ? "Les commits apparaîtront lorsque GitHub sera configuré."
              : item.live === "error"
                ? "Impossible de charger les commits."
                : "Aucun commit récent."}
          </p>
        ) : (
          <ol className="mt-2 space-y-2">
            {item.commits.slice(0, 5).map((commit) => (
              <li
                key={commit.sha}
                className="flex flex-col gap-1 rounded-xl border border-border bg-background/60 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between"
              >
                <div className="min-w-0">
                  <a
                    href={commit.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-body text-foreground hover:text-primary"
                  >
                    {commit.message}
                  </a>
                  <p className="mt-1 font-mono text-meta text-muted">
                    {commit.shortSha}
                    {commit.author ? ` · ${commit.author}` : ""}
                  </p>
                </div>
                <p className="font-mono text-meta text-faint">
                  {formatDateTime(commit.committedAt)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
}

function LiveLabel({ live }: { live: GitHubOverviewItem["live"] }) {
  const styles = {
    ok: "border-success/30 bg-success/10 text-success",
    unconfigured: "border-faint/40 bg-surface-high text-muted",
    error: "border-danger/30 bg-danger/10 text-danger",
  } as const;
  const labels = {
    ok: "Live",
    unconfigured: "Hors API",
    error: "Erreur",
  } as const;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-badge font-semibold tracking-wide uppercase ${styles[live]}`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {labels[live]}
    </span>
  );
}

function InfoItem({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="text-meta text-faint">{label}</dt>
      <dd className="mt-0.5 text-body text-foreground">{children}</dd>
    </div>
  );
}
