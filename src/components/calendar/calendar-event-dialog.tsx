"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { createCalendarEvent, updateCalendarEvent } from "@/actions/calendar-events";
import { AppDialog } from "@/components/ui/app-dialog";
import { Button } from "@/components/ui/button";
import { Field, controlClassName } from "@/components/ui/field";
import { atHour } from "@/lib/calendar/dates";
import type { CalendarCompanyOption, CalendarItem, CalendarProjectOption } from "@/lib/calendar/types";
import { idleActionResult } from "@/lib/crm/action-result";
import { CALENDAR_EVENT_TYPE_LABELS, CALENDAR_EVENT_TYPES } from "@/lib/crm/constants";
import { toDateInputValue, toDateTimeLocalValue } from "@/lib/crm/form-data";

type CalendarEventDialogProps = {
  open: boolean;
  onClose: () => void;
  selectedDay: string;
  item?: CalendarItem | null;
  companies: CalendarCompanyOption[];
  projects: CalendarProjectOption[];
};

export function CalendarEventDialog({
  open,
  onClose,
  selectedDay,
  item,
  companies,
  projects,
}: CalendarEventDialogProps) {
  const editing = Boolean(item && item.kind === "event");

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={editing ? "Modifier l'événement" : "Nouvel événement"}
      description="Événement manuel interne — les relances, tâches et jalons restent sur leur objet métier."
    >
      {open ? (
        <CalendarEventForm
          selectedDay={selectedDay}
          item={editing ? item : null}
          companies={companies}
          projects={projects}
          onClose={onClose}
        />
      ) : null}
    </AppDialog>
  );
}

function CalendarEventForm({
  selectedDay,
  item,
  companies,
  projects,
  onClose,
}: {
  selectedDay: string;
  item?: CalendarItem | null;
  companies: CalendarCompanyOption[];
  projects: CalendarProjectOption[];
  onClose: () => void;
}) {
  const editing = Boolean(item);
  const action = editing ? updateCalendarEvent : createCalendarEvent;
  const [state, formAction, pending] = useActionState(action, idleActionResult);
  const [allDay, setAllDay] = useState(item?.allDay ?? false);
  const [companyId, setCompanyId] = useState(item?.company?.id ?? "");
  const [projectId, setProjectId] = useState(item?.project?.id ?? "");

  useEffect(() => {
    if (state.ok) {
      onClose();
    }
  }, [onClose, state]);

  const firstError = (key: string) => state.fieldErrors?.[key]?.[0];

  const startDefault = useMemo(() => {
    if (item) {
      const date = new Date(item.startsAt);
      return allDay ? toDateInputValue(date) : toDateTimeLocalValue(date);
    }
    return allDay
      ? selectedDay
      : toDateTimeLocalValue(atHour(selectedDay, 9));
  }, [allDay, item, selectedDay]);

  const endDefault = useMemo(() => {
    if (item) {
      const date = new Date(item.endsAt);
      return allDay ? toDateInputValue(date) : toDateTimeLocalValue(date);
    }
    return allDay
      ? selectedDay
      : toDateTimeLocalValue(atHour(selectedDay, 10));
  }, [allDay, item, selectedDay]);

  const visibleProjects = useMemo(() => {
    if (!companyId) {
      return projects;
    }
    return projects.filter((project) => project.companyId === companyId);
  }, [companyId, projects]);

  return (
    <form action={formAction} className="space-y-4">
      {item ? <input type="hidden" name="id" value={item.entityId} /> : null}
      {state.message && !state.ok ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-meta text-danger" role="alert">
          {state.message}
        </p>
      ) : null}

      <Field label="Titre" htmlFor="calendar-title" error={firstError("title")}>
        <input
          id="calendar-title"
          name="title"
          required
          defaultValue={item?.title ?? ""}
          disabled={pending}
          className={controlClassName}
        />
      </Field>

      <Field label="Type" htmlFor="calendar-type" error={firstError("type")}>
        <select
          id="calendar-type"
          name="type"
          required
          disabled={pending}
          defaultValue={item?.eventType ?? "MEETING"}
          className={controlClassName}
        >
          {CALENDAR_EVENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {CALENDAR_EVENT_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </Field>

      <input type="hidden" name="allDay" value={allDay ? "on" : ""} />
      <label className="flex items-center gap-2 text-meta text-muted">
        <input
          type="checkbox"
          checked={allDay}
          onChange={(event) => setAllDay(event.target.checked)}
          disabled={pending}
          className="size-4 rounded border-border bg-background accent-primary"
        />
        Journée entière
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Début" htmlFor="calendar-start" error={firstError("startsAt")}>
          <input
            key={`start-${allDay}-${startDefault}`}
            id="calendar-start"
            name="startsAt"
            type={allDay ? "date" : "datetime-local"}
            required
            defaultValue={startDefault}
            disabled={pending}
            className={controlClassName}
          />
        </Field>
        <Field label="Fin" htmlFor="calendar-end" error={firstError("endsAt")}>
          <input
            key={`end-${allDay}-${endDefault}`}
            id="calendar-end"
            name="endsAt"
            type={allDay ? "date" : "datetime-local"}
            required
            defaultValue={endDefault}
            disabled={pending}
            className={controlClassName}
          />
        </Field>
      </div>

      <Field label="Entreprise" htmlFor="calendar-company" hint="Optionnel" error={firstError("companyId")}>
        <select
          id="calendar-company"
          name="companyId"
          disabled={pending}
          value={companyId}
          onChange={(event) => {
            const next = event.target.value;
            setCompanyId(next);
            const currentProject = projects.find((project) => project.id === projectId);
            if (currentProject && next && currentProject.companyId !== next) {
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

      <Field label="Projet" htmlFor="calendar-project" hint="Optionnel" error={firstError("projectId")}>
        <select
          id="calendar-project"
          name="projectId"
          disabled={pending}
          value={projectId}
          onChange={(event) => {
            const next = event.target.value;
            setProjectId(next);
            const project = projects.find((entry) => entry.id === next);
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

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? (editing ? "Enregistrement…" : "Création…") : editing ? "Enregistrer" : "Créer"}
        </Button>
      </div>
    </form>
  );
}
