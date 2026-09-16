"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { ProjectProgress } from "@/components/projects/project-progress";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { controlClassName } from "@/components/ui/field";
import { PROJECT_STATUS_LABELS, PROJECT_STATUSES } from "@/lib/crm/constants";
import { formatDate } from "@/lib/crm/form-data";
import type { ProjectListItem } from "@/lib/queries/projects";
import { cn } from "@/lib/cn";

type ProjectExplorerProps = {
  projects: ProjectListItem[];
};

export function ProjectExplorer({ projects }: ProjectExplorerProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [clientId, setClientId] = useState("all");

  const clients = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of projects) {
      map.set(project.company.id, project.company.name);
    }
    return [...map.entries()].sort((left, right) =>
      left[1].localeCompare(right[1], "fr"),
    );
  }, [projects]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return projects.filter((project) => {
      if (status !== "all" && project.status !== status) {
        return false;
      }
      if (clientId !== "all" && project.company.id !== clientId) {
        return false;
      }
      if (!needle) {
        return true;
      }
      const haystack = [project.name, project.company.name].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [clientId, projects, query, status]);

  if (projects.length === 0) {
    return (
      <Card className="px-5">
        <EmptyState
          title="Aucun projet"
          description="Créez un projet depuis la fiche d'un client."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))]">
          <label className="relative block">
            <span className="sr-only">Rechercher</span>
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Projet, client"
              className={cn(controlClassName, "pl-9")}
            />
          </label>
          <label className="block">
            <span className="sr-only">Statut</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className={controlClassName}
            >
              <option value="all">Statut · tous</option>
              {PROJECT_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {PROJECT_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Client</span>
            <select
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              className={controlClassName}
            >
              <option value="all">Client · tous</option>
              {clients.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="px-5">
          <EmptyState title="Aucun résultat" description="Aucun projet ne correspond aux filtres." />
        </Card>
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {filtered.map((project) => (
              <Link
                key={project.id}
                href={`/projets/${project.id}`}
                className="foil-subtle rounded-card card-sheen border border-border bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="truncate font-medium text-foreground">{project.name}</p>
                  <ProjectStatusBadge status={project.status} />
                </div>
                <p className="mt-1 text-meta text-muted">{project.company.name}</p>
                <div className="mt-3">
                  <ProjectProgress value={project.progress} />
                </div>
              </Link>
            ))}
          </div>

          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[56rem] text-left text-body">
                <thead className="border-b border-border bg-surface-high/60 text-meta tracking-[0.08em] text-muted uppercase">
                  <tr>
                    <th className="px-4 py-3 font-medium">Projet</th>
                    <th className="px-4 py-3 font-medium">Client</th>
                    <th className="px-4 py-3 font-medium">Statut</th>
                    <th className="px-4 py-3 font-medium">Deadline</th>
                    <th className="px-4 py-3 font-medium">Progression</th>
                    <th className="px-4 py-3 font-medium">Tâches ouvertes</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((project) => (
                    <tr
                      key={project.id}
                      className="relative border-b border-border/70 last:border-0 hover:bg-surface-high/40"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/projets/${project.id}`}
                          className="font-medium text-foreground after:absolute after:inset-0"
                        >
                          {project.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted">{project.company.name}</td>
                      <td className="px-4 py-3">
                        <ProjectStatusBadge status={project.status} />
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {project.dueDate ? formatDate(project.dueDate) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <ProjectProgress value={project.progress} />
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-muted">
                        {project.openTaskCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
