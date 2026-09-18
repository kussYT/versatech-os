import { cva, type VariantProps } from "class-variance-authority";
import { calendarItemLabel } from "@/lib/calendar/labels";
import type { CalendarItem } from "@/lib/calendar/types";
import { cn } from "@/lib/cn";

const kindBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-badge font-semibold tracking-wide uppercase",
  {
    variants: {
      tone: {
        event: "border-orange/30 bg-orange/10 text-orange",
        call: "border-primary/30 bg-primary/10 text-primary",
        follow_up: "border-cyan/30 bg-cyan/10 text-cyan",
        task: "border-primary/30 bg-primary/10 text-primary",
        project: "border-warning/30 bg-warning/10 text-warning",
        milestone: "border-purple/30 bg-purple/10 text-purple",
        terrain: "border-cyan/40 bg-cyan/15 text-cyan",
        admin: "border-faint/40 bg-surface-high text-faint",
      },
    },
    defaultVariants: {
      tone: "event",
    },
  },
);

function toneFor(item: CalendarItem): NonNullable<VariantProps<typeof kindBadgeVariants>["tone"]> {
  if (item.kind === "follow_up") {
    return "follow_up";
  }
  if (item.kind === "task") {
    return "task";
  }
  if (item.kind === "project") {
    return "project";
  }
  if (item.kind === "milestone") {
    return "milestone";
  }
  if (item.kind === "terrain_visit") {
    return "terrain";
  }

  switch (item.eventType) {
    case "CALL":
      return "call";
    case "FOLLOW_UP":
      return "follow_up";
    case "TASK":
      return "task";
    case "DEADLINE":
      return "project";
    case "DELIVERY":
      return "milestone";
    case "MAINTENANCE":
      return "follow_up";
    case "ADMINISTRATIVE":
      return "admin";
    default:
      return "event";
  }
}

type CalendarKindBadgeProps = {
  item: CalendarItem;
  className?: string;
};

export function CalendarKindBadge({ item, className }: CalendarKindBadgeProps) {
  return (
    <span className={cn(kindBadgeVariants({ tone: toneFor(item) }), className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {calendarItemLabel(item)}
    </span>
  );
}

export function calendarChipClass(item: CalendarItem) {
  return kindBadgeVariants({ tone: toneFor(item) });
}
