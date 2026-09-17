"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { CreateMilestoneDialog } from "@/components/projects/create-milestone-dialog";
import { CreateTaskDialog } from "@/components/projects/create-task-dialog";
import { MilestoneStatusActions } from "@/components/projects/milestone-status-actions";
import { DocumentSection } from "@/components/documents/document-section";
import { FinanceSection } from "@/components/finances/finance-section";
import { ProjectGithubSection } from "@/components/projects/project-github-section";
import { ProjectStatusActions } from "@/components/projects/project-status-actions";
import { ProjectProgress } from "@/components/projects/project-progress";
import {
  MilestoneStatusBadge,
  ProjectStatusBadge,
  TaskStatusBadge,
} from "@/components/projects/project-status-badge";
import { TaskStatusActions } from "@/components/projects/task-status-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { PageHeader } from "@/components/layout/page-header";
import type { ReactNode } from "react";
import { PRIORITY_LABELS, TASK_STATUS_LABELS, TASK_STATUSES } from "@/lib/crm/constants";
import { formatDate, formatDateTime, formatMoney } from "@/lib/crm/form-data";
import type { GitHubProjectSnapshot } from "@/lib/queries/github";
import type { PaymentFormOptions } from "@/lib/queries/payments";
import { ACTIVITY_LABELS } from "@/lib/crm/activity-labels";
import type { ProjectDetail } from "@/lib/queries/projects";
import type { TaskStatus } from "@/generated/prisma/client";

type ProjectHubProps = {
  project: ProjectDetail;
  github: GitHubProjectSnapshot;
  paymentOptions: PaymentFormOptions;
};

export function ProjectHub({ project, github, paymentOptions }: ProjectHubProps) {
  const [taskOpen, setTaskOpen] = useState(false);
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const openTasks = project.tasks.filter(
    (task) => task.status === "TODO" || task.status === "IN_PROGRESS",
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        meta="Fiche projet"
        title={project.name}
        description={
          [
            project.company.name,
            project.dueDate ? `Deadline ${formatDate(project.dueDate)}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setTaskOpen(true)}>
              <Plus className="size-4" aria-hidden="true" />
              Créer une tâche
            </Button>
            <Button variant="secondary" onClick={() => setMilestoneOpen(true)}>
              <Plus className="size-4" aria-hidden="true" />
              Créer un jalon
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <ProjectStatusBadge status={project.status} />
        <ProjectStatusActions projectId={project.id} status={project.status} />
        <Link
          href={`/entreprises/${project.company.id}`}
          className="text-meta text-primary hover:text-primary-hover"
        >
          {project.company.name}
        </Link>
      </div>

      <Card className="p-5">
        <h2 className="text-section text-foreground">Vue d&apos;ensemble</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <InfoItem label="Progression">
            <ProjectProgress value={project.progress} />
          </InfoItem>
          <InfoItem label="Tâches ouvertes">{openTasks}</InfoItem>
          <InfoItem label="Début">
            {project.startDate ? formatDate(project.startDate) : "—"}
          </InfoItem>
          <InfoItem label="Montant">
            {project.amount ? formatMoney(project.amount) : "—"}
          </InfoItem>
          <InfoItem label="CA signé">{formatMoney(project.finance.signed)}</InfoItem>
          <InfoItem label="Encaissé">{formatMoney(project.finance.collected)}</InfoItem>
        </dl>
        {project.description ? (
          <p className="mt-4 whitespace-pre-wrap border-t border-border pt-4 text-body text-muted">
            {project.description}
          </p>
        ) : null}
      </Card>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-section text-foreground">Tâches</h2>
          <Button size="sm" variant="secondary" onClick={() => setTaskOpen(true)}>
            Ajouter
          </Button>
        </div>
        {project.tasks.length === 0 ? (
          <EmptyState
            title="Aucune tâche"
            description="Ajoutez des tâches pour suivre la production et calculer la progression."
            action={
              <Button size="sm" onClick={() => setTaskOpen(true)}>
                Créer une tâche
              </Button>
            }
          />
        ) : (
          <div className="mt-4 space-y-4">
            {TASK_STATUSES.map((status) => (
              <TaskGroup
                key={status}
                status={status}
                tasks={project.tasks.filter((task) => task.status === status)}
              />
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-section text-foreground">Jalons</h2>
          <Button size="sm" variant="secondary" onClick={() => setMilestoneOpen(true)}>
            Ajouter
          </Button>
        </div>
        {project.milestones.length === 0 ? (
          <EmptyState
            title="Aucun jalon"
            description="Ajoutez les étapes clés du projet, sans modèle imposé."
            action={
              <Button size="sm" onClick={() => setMilestoneOpen(true)}>
                Créer un jalon
              </Button>
            }
          />
        ) : (
          <ul className="mt-4 space-y-2">
            {project.milestones.map((milestone) => (
              <li
                key={milestone.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-background/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-body font-medium text-foreground">{milestone.name}</p>
                    <MilestoneStatusBadge status={milestone.status} />
                  </div>
                  <p className="mt-1 font-mono text-meta text-muted">
                    {milestone.dueAt ? formatDate(milestone.dueAt) : "Sans date"}
                  </p>
                </div>
                <MilestoneStatusActions milestoneId={milestone.id} status={milestone.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ProjectGithubSection projectId={project.id} github={github} />

      <DocumentSection
        documents={project.documents}
        companies={[{ id: project.company.id, name: project.company.name }]}
        projects={[
          {
            id: project.id,
            name: project.name,
            companyId: project.company.id,
          },
        ]}
        defaultCompanyId={project.company.id}
        defaultProjectId={project.id}
      />

      <FinanceSection
        totals={project.finance}
        payments={project.payments}
        options={paymentOptions}
        defaultCompanyId={project.company.id}
        defaultProjectId={project.id}
        hideCompany
      />

      <Card className="p-5">
        <h2 className="text-section text-foreground">Activité</h2>
        {project.activity.length === 0 ? (
          <EmptyState title="Aucune activité" description="Les créations et changements de statut apparaîtront ici." />
        ) : (
          <ol className="mt-4 space-y-2">
            {project.activity.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-border bg-background/60 px-4 py-3"
              >
                <p className="text-body text-foreground">
                  {ACTIVITY_LABELS[item.action] ?? item.action}
                </p>
                <p className="font-mono text-meta text-faint">
                  {formatDateTime(item.createdAt)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <CreateTaskDialog
        open={taskOpen}
        onClose={() => setTaskOpen(false)}
        projectId={project.id}
      />
      <CreateMilestoneDialog
        open={milestoneOpen}
        onClose={() => setMilestoneOpen(false)}
        projectId={project.id}
      />
    </div>
  );
}

function TaskGroup({
  status,
  tasks,
}: {
  status: TaskStatus;
  tasks: ProjectDetail["tasks"];
}) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <section>
      <h3 className="mb-2 text-meta font-medium tracking-[0.08em] text-muted uppercase">
        {TASK_STATUS_LABELS[status]}
      </h3>
      <ul className="space-y-2">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="rounded-xl border border-border bg-background/60 px-4 py-3"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-body font-medium text-foreground">{task.title}</p>
                  <TaskStatusBadge status={task.status} />
                  <PriorityBadge
                    priority={task.priority.toLowerCase() as "low" | "normal" | "medium" | "high" | "urgent"}
                    label={PRIORITY_LABELS[task.priority]}
                  />
                </div>
                {task.dueAt ? (
                  <p className="mt-1 font-mono text-meta text-muted">
                    {formatDateTime(task.dueAt)}
                  </p>
                ) : null}
                {task.description ? (
                  <p className="mt-2 text-body text-muted">{task.description}</p>
                ) : null}
              </div>
              <TaskStatusActions taskId={task.id} status={task.status} />
            </div>
          </li>
        ))}
      </ul>
    </section>
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
