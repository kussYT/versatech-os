import type { CalendarEventType } from "@/generated/prisma/client";

export const CALENDAR_ITEM_KINDS = [
  "event",
  "follow_up",
  "task",
  "project",
  "milestone",
  "terrain_visit",
] as const;

export type CalendarItemKind = (typeof CALENDAR_ITEM_KINDS)[number];

export type CalendarLink = {
  id: string;
  name: string;
};

export type CalendarItem = {
  id: string;
  kind: CalendarItemKind;
  entityId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  eventType: CalendarEventType | null;
  href: string | null;
  company: CalendarLink | null;
  project: CalendarLink | null;
  editable: boolean;
  overdue: boolean;
  visitOrder?: number | null;
  visitStatus?: "pending" | "visited" | null;
  secondaryHref?: string | null;
};

export type CalendarCompanyOption = CalendarLink;

export type CalendarProjectOption = CalendarLink & {
  companyId: string;
};
