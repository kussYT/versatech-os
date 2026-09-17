"use client";

import { useMemo, useState } from "react";
import { Field, controlClassName } from "@/components/ui/field";
import { toDateInputValue } from "@/lib/crm/form-data";
import type {
  MaintenanceCompanyOption,
  MaintenanceProjectOption,
} from "@/lib/queries/maintenance";

export type MaintenanceFormValues = {
  companyId?: string;
  projectId?: string | null;
  monthlyAmount?: string;
  startDate?: string;
  endDate?: string | null;
  description?: string | null;
};

type MaintenanceFieldsProps = {
  pending: boolean;
  firstError: (key: string) => string | undefined;
  companies: MaintenanceCompanyOption[];
  projects: MaintenanceProjectOption[];
  defaults?: MaintenanceFormValues;
  lockCompany?: boolean;
};

export function MaintenanceFields({
  pending,
  firstError,
  companies,
  projects,
  defaults,
  lockCompany = false,
}: MaintenanceFieldsProps) {
  const [companyId, setCompanyId] = useState(defaults?.companyId ?? "");
  const [projectId, setProjectId] = useState(defaults?.projectId ?? "");

  const visibleProjects = useMemo(() => {
    if (!companyId) {
      return [];
    }
    return projects.filter((project) => project.companyId === companyId);
  }, [companyId, projects]);

  return (
    <>
      {lockCompany ? (
        <input type="hidden" name="companyId" value={companyId} />
      ) : (
        <Field label="Entreprise" htmlFor="maintenance-company" error={firstError("companyId")}>
          <select
            id="maintenance-company"
            name="companyId"
            required
            disabled={pending}
            value={companyId}
            onChange={(event) => {
              const nextCompanyId = event.target.value;
              setCompanyId(nextCompanyId);
              const currentProject = projects.find((project) => project.id === projectId);
              if (currentProject && currentProject.companyId !== nextCompanyId) {
                setProjectId("");
              }
            }}
            className={controlClassName}
          >
            <option value="">Sélectionner…</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field
        label="Projet"
        htmlFor="maintenance-project"
        hint="Optionnel"
        error={firstError("projectId")}
      >
        <select
          id="maintenance-project"
          name="projectId"
          disabled={pending || !companyId}
          value={projectId ?? ""}
          onChange={(event) => setProjectId(event.target.value)}
          className={controlClassName}
        >
          <option value="">Aucun</option>
          {visibleProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Montant mensuel"
        htmlFor="maintenance-amount"
        hint="En euros"
        error={firstError("monthlyAmount")}
      >
        <input
          id="maintenance-amount"
          name="monthlyAmount"
          inputMode="decimal"
          required
          disabled={pending}
          defaultValue={defaults?.monthlyAmount ?? ""}
          placeholder="89.00"
          className={controlClassName}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date de début" htmlFor="maintenance-start" error={firstError("startDate")}>
          <input
            id="maintenance-start"
            name="startDate"
            type="date"
            required
            disabled={pending}
            defaultValue={defaults?.startDate ? toDateInputValue(defaults.startDate) : ""}
            className={controlClassName}
          />
        </Field>
        <Field
          label="Date de fin"
          htmlFor="maintenance-end"
          hint="Optionnel"
          error={firstError("endDate")}
        >
          <input
            id="maintenance-end"
            name="endDate"
            type="date"
            disabled={pending}
            defaultValue={defaults?.endDate ? toDateInputValue(defaults.endDate) : ""}
            className={controlClassName}
          />
        </Field>
      </div>

      <Field label="Description" htmlFor="maintenance-description" error={firstError("description")}>
        <textarea
          id="maintenance-description"
          name="description"
          rows={3}
          disabled={pending}
          defaultValue={defaults?.description ?? ""}
          placeholder="Hébergement, sauvegardes, petites évolutions…"
          className={controlClassName}
        />
      </Field>
    </>
  );
}
