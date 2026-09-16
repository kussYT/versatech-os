"use client";

import { useMemo, useState } from "react";
import { Field, controlClassName } from "@/components/ui/field";
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES } from "@/lib/crm/constants";
import type {
  DocumentAssociationOption,
  DocumentProjectOption,
} from "@/lib/queries/documents";

export type DocumentFormValues = {
  name?: string;
  type?: string;
  url?: string;
  companyId?: string | null;
  projectId?: string | null;
};

type DocumentFieldsProps = {
  pending: boolean;
  firstError: (key: string) => string | undefined;
  companies: DocumentAssociationOption[];
  projects: DocumentProjectOption[];
  defaults?: DocumentFormValues;
  lockCompany?: boolean;
  lockProject?: boolean;
};

export function DocumentFields({
  pending,
  firstError,
  companies,
  projects,
  defaults,
  lockCompany = false,
  lockProject = false,
}: DocumentFieldsProps) {
  const [companyId, setCompanyId] = useState(defaults?.companyId ?? "");
  const [projectId, setProjectId] = useState(defaults?.projectId ?? "");

  const visibleProjects = useMemo(() => {
    if (!companyId) {
      return projects;
    }
    return projects.filter((project) => project.companyId === companyId);
  }, [companyId, projects]);

  return (
    <>
      <Field label="Nom" htmlFor="document-name" error={firstError("name")}>
        <input
          id="document-name"
          name="name"
          required
          defaultValue={defaults?.name ?? ""}
          disabled={pending}
          placeholder="Devis signé, contrat, maquette…"
          className={controlClassName}
        />
      </Field>

      <Field label="Type" htmlFor="document-type" error={firstError("type")}>
        <select
          id="document-type"
          name="type"
          required
          disabled={pending}
          defaultValue={defaults?.type ?? "OTHER"}
          className={controlClassName}
        >
          {DOCUMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {DOCUMENT_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="URL externe"
        htmlFor="document-url"
        hint="Lien vers la ressource (Drive, PDF, page web…). Aucun fichier n'est stocké ici."
        error={firstError("url")}
      >
        <input
          id="document-url"
          name="url"
          required
          defaultValue={defaults?.url ?? ""}
          disabled={pending}
          placeholder="https://"
          className={controlClassName}
        />
      </Field>

      {lockCompany ? (
        <input type="hidden" name="companyId" value={companyId} />
      ) : (
        <Field label="Entreprise" htmlFor="document-company" error={firstError("companyId")}>
          <select
            id="document-company"
            name="companyId"
            disabled={pending}
            value={companyId}
            onChange={(event) => {
              const nextCompanyId = event.target.value;
              setCompanyId(nextCompanyId);
              const currentProject = projects.find((project) => project.id === projectId);
              if (currentProject && nextCompanyId && currentProject.companyId !== nextCompanyId) {
                setProjectId("");
              }
            }}
            className={controlClassName}
          >
            <option value="">Aucune</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      {lockProject ? (
        <input type="hidden" name="projectId" value={projectId} />
      ) : (
        <Field label="Projet" htmlFor="document-project" error={firstError("projectId")}>
          <select
            id="document-project"
            name="projectId"
            disabled={pending}
            value={projectId}
            onChange={(event) => {
              const nextProjectId = event.target.value;
              setProjectId(nextProjectId);
              const project = projects.find((item) => item.id === nextProjectId);
              if (project) {
                setCompanyId(project.companyId);
              }
            }}
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
      )}
    </>
  );
}
