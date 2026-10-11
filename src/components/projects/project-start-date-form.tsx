"use client";

import { useActionState } from "react";
import { updateProjectStartDate } from "@/actions/projects";
import { Button } from "@/components/ui/button";
import { idleActionResult } from "@/lib/crm/action-result";
import { controlClassName } from "@/components/ui/field";
import { parisDateKey } from "@/lib/dates";

type ProjectStartDateFormProps = {
  projectId: string;
  startDate: string | null;
};

export function ProjectStartDateForm({ projectId, startDate }: ProjectStartDateFormProps) {
  const [state, action, pending] = useActionState(updateProjectStartDate, idleActionResult);
  const value = startDate ? parisDateKey(startDate) : "";

  return (
    <form action={action} className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
      <input type="hidden" name="projectId" value={projectId} />
      <label className="block min-w-0 flex-1 text-meta text-muted">
        Modifier la date
        <input
          type="date"
          name="startDate"
          required
          defaultValue={value}
          className={`${controlClassName} mt-1 min-h-12`}
        />
      </label>
      <Button type="submit" variant="secondary" className="min-h-12" disabled={pending}>
        Enregistrer
      </Button>
      {state.message ? (
        <p className={`w-full text-meta ${state.ok ? "text-muted" : "text-danger"}`} role={state.ok ? "status" : "alert"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
