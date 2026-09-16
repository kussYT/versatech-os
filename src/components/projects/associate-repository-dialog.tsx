"use client";

import { useActionState, useEffect } from "react";
import { associateGitHubRepository } from "@/actions/repositories";
import { AppDialog } from "@/components/ui/app-dialog";
import { Button } from "@/components/ui/button";
import { Field, controlClassName } from "@/components/ui/field";
import { idleActionResult } from "@/lib/crm/action-result";

type AssociateRepositoryDialogProps = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  githubConfigured: boolean;
};

export function AssociateRepositoryDialog({
  open,
  onClose,
  projectId,
  githubConfigured,
}: AssociateRepositoryDialogProps) {
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title="Associer un repository GitHub"
      description="Lecture seule — le dépôt est rattaché au projet, sans création GitHub."
    >
      {open ? (
        <AssociateRepositoryForm
          projectId={projectId}
          githubConfigured={githubConfigured}
          onClose={onClose}
        />
      ) : null}
    </AppDialog>
  );
}

function AssociateRepositoryForm({
  projectId,
  githubConfigured,
  onClose,
}: {
  projectId: string;
  githubConfigured: boolean;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    associateGitHubRepository,
    idleActionResult,
  );
  const firstError = (key: string) => state.fieldErrors?.[key]?.[0];

  useEffect(() => {
    if (state.ok) {
      onClose();
    }
  }, [onClose, state]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="projectId" value={projectId} />
      {state.message && !state.ok ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-meta text-danger" role="alert">
          {state.message}
        </p>
      ) : null}

      <Field
        label="Repository"
        htmlFor="github-repository"
        hint="owner/nom ou URL github.com"
        error={firstError("repository")}
      >
        <input
          id="github-repository"
          name="repository"
          required
          disabled={pending}
          placeholder="versatech/site-client"
          className={controlClassName}
        />
      </Field>

      {!githubConfigured ? (
        <p className="rounded-xl border border-border bg-background/60 px-3 py-2 text-meta text-muted">
          GitHub n&apos;est pas configuré. L&apos;association sera enregistrée localement, sans
          vérification ni activité live.
        </p>
      ) : (
        <p className="text-meta text-faint">
          Le dépôt sera vérifié via l&apos;API GitHub, puis associé à ce projet.
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Association…" : "Associer"}
        </Button>
      </div>
    </form>
  );
}
