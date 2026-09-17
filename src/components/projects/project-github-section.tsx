"use client";

import type { ReactNode } from "react";
import { useActionState, useState } from "react";
import { GitBranch, Plus } from "lucide-react";
import { unlinkGitHubRepository } from "@/actions/repositories";
import { AssociateRepositoryDialog } from "@/components/projects/associate-repository-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/crm/form-data";
import { idleActionResult } from "@/lib/crm/action-result";
import {
  SENSITIVE_ACTION_CONFIRMS,
  preventUnconfirmedSubmit,
} from "@/lib/crm/confirm-sensitive-action";
import type { GitHubProjectSnapshot, GitHubRepositorySnapshot } from "@/lib/queries/github";

type ProjectGithubSectionProps = {
  projectId: string;
  github: GitHubProjectSnapshot;
};

export function ProjectGithubSection({ projectId, github }: ProjectGithubSectionProps) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-section text-foreground">GitHub</h2>
          <p className="mt-1 text-meta text-muted">
            {github.configured
              ? "Activité technique liée au projet, en lecture seule."
              : "Association locale — l'API GitHub n'est pas configurée."}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Associer
        </Button>
      </div>

      {!github.configured ? (
        <p className="mt-4 rounded-xl border border-border bg-background/60 px-4 py-3 text-meta text-muted">
          Définissez <span className="font-mono text-foreground">GITHUB_TOKEN</span> côté serveur
          pour afficher la branche principale, les derniers commits et la dernière activité.
        </p>
      ) : null}

      {github.repositories.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="Aucun repository associé"
          description="Rattachez un dépôt GitHub existant à ce projet. Aucun repository n'est créé automatiquement."
          action={
            <Button size="sm" onClick={() => setOpen(true)}>
              Associer un repository
            </Button>
          }
        />
      ) : (
        <ul className="mt-4 space-y-4">
          {github.repositories.map((repository) => (
            <li key={repository.id}>
              <RepositoryCard repository={repository} />
            </li>
          ))}
        </ul>
      )}

      <AssociateRepositoryDialog
        open={open}
        onClose={() => setOpen(false)}
        projectId={projectId}
        githubConfigured={github.configured}
      />
    </Card>
  );
}

function RepositoryCard({ repository }: { repository: GitHubRepositorySnapshot }) {
  return (
    <article className="rounded-xl border border-border bg-background/60 px-4 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-body font-medium text-foreground">
              {repository.owner}/{repository.name}
            </p>
            <LiveBadge live={repository.live} />
          </div>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <InfoItem label="Propriétaire">{repository.owner}</InfoItem>
            <InfoItem label="Nom">{repository.name}</InfoItem>
            <InfoItem label="URL">
              <a
                href={repository.url}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:text-primary-hover break-all"
              >
                {repository.url}
              </a>
            </InfoItem>
            <InfoItem label="Branche principale">
              {repository.defaultBranch || "—"}
            </InfoItem>
            <InfoItem label="Dernière activité">
              {repository.lastActivityAt ? formatDateTime(repository.lastActivityAt) : "—"}
            </InfoItem>
          </dl>
          {repository.errorMessage ? (
            <p className="mt-3 text-meta text-danger" role="alert">
              {repository.errorMessage}
            </p>
          ) : null}
        </div>
        <UnlinkRepositoryButton
          repositoryId={repository.id}
          repoLabel={`${repository.owner}/${repository.name}`}
        />
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <h3 className="text-meta font-medium tracking-[0.08em] text-muted uppercase">
          Derniers commits
        </h3>
        {repository.commits.length === 0 ? (
          <p className="mt-2 text-meta text-muted">
            {repository.live === "unconfigured"
              ? "Les commits apparaîtront lorsque GitHub sera configuré."
              : repository.live === "error"
                ? "Impossible de charger les commits."
                : "Aucun commit récent."}
          </p>
        ) : (
          <ol className="mt-2 space-y-2">
            {repository.commits.map((commit) => (
              <li
                key={commit.sha}
                className="flex flex-col gap-1 rounded-lg border border-border/70 bg-surface/50 px-3 py-2 sm:flex-row sm:items-baseline sm:justify-between"
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
                  <p className="mt-0.5 text-meta text-muted">
                    <span className="font-mono">{commit.shortSha}</span>
                    {commit.author ? ` · ${commit.author}` : null}
                  </p>
                </div>
                <p className="shrink-0 font-mono text-meta text-faint">
                  {formatDateTime(commit.committedAt)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </article>
  );
}

function UnlinkRepositoryButton({
  repositoryId,
  repoLabel,
}: {
  repositoryId: string;
  repoLabel: string;
}) {
  const [state, formAction, pending] = useActionState(
    unlinkGitHubRepository,
    idleActionResult,
  );

  return (
    <form
      action={formAction}
      className="shrink-0"
      onSubmit={preventUnconfirmedSubmit(SENSITIVE_ACTION_CONFIRMS.unlinkGithub(repoLabel))}
    >
      <input type="hidden" name="repositoryId" value={repositoryId} />
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>
        {pending ? "Retrait…" : "Retirer"}
      </Button>
      {state.message && !state.ok ? (
        <p className="mt-1 text-meta text-danger" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function LiveBadge({ live }: { live: GitHubRepositorySnapshot["live"] }) {
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
