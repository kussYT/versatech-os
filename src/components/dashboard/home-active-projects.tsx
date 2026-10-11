import Link from "next/link";
import { PROJECT_STATUS_LABELS } from "@/lib/crm/constants";
import type { DashboardActiveProject } from "@/lib/queries/dashboard-home";
import { cn } from "@/lib/cn";

type HomeActiveProjectsProps = {
  projects: DashboardActiveProject[];
};

function statusTone(status: DashboardActiveProject["status"]) {
  switch (status) {
    case "ACTIVE":
      return "bg-primary/12 text-primary";
    case "WAITING_CLIENT":
      return "bg-warning/15 text-warning";
    case "REVIEW":
      return "bg-purple/15 text-purple";
    default:
      return "bg-surface-high text-muted";
  }
}

function barTone(status: DashboardActiveProject["status"]) {
  switch (status) {
    case "WAITING_CLIENT":
      return "bg-warning";
    case "REVIEW":
      return "bg-purple";
    default:
      return "bg-primary";
  }
}

export function HomeActiveProjects({ projects }: HomeActiveProjectsProps) {
  return (
    <section className="glass-card flex h-full flex-col p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-section text-foreground">Projets en cours</h2>
        <Link href="/projets" className="text-meta font-medium text-primary hover:text-primary-hover">
          Voir tout →
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="mt-6 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-white/40 px-3 py-8 text-center">
          <p className="text-body font-medium text-foreground">Aucun projet actif</p>
          <p className="mt-1 text-meta text-muted">Les projets en production apparaîtront ici.</p>
        </div>
      ) : (
        <ul className="mt-4 flex-1 space-y-3">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projets/${project.id}`}
                className="block rounded-2xl px-1.5 py-2 transition-colors duration-hover hover:bg-white/55"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-body font-medium text-foreground">
                      {project.company.name}
                    </p>
                    <p className="truncate text-meta text-muted">{project.name}</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-badge font-semibold tracking-normal normal-case",
                      statusTone(project.status),
                    )}
                  >
                    {PROJECT_STATUS_LABELS[project.status]}
                  </span>
                </div>
                {project.progress > 0 ? (
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/5">
                      <div
                        className={cn("h-full rounded-full", barTone(project.status))}
                        style={{ width: `${Math.min(100, project.progress)}%` }}
                      />
                    </div>
                    <span className="text-meta tabular-nums text-muted">{project.progress} %</span>
                  </div>
                ) : (
                  <p className="mt-2 text-meta text-faint">Progression non disponible (aucune tâche)</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
