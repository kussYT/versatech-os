import { MAINTENANCE_STATUS_LABELS } from "@/lib/crm/constants";
import { cn } from "@/lib/cn";
import type { MaintenanceStatus } from "@/generated/prisma/client";

const maintenanceStatusClassName: Record<MaintenanceStatus, string> = {
  ACTIVE: "border-success/30 bg-success/10 text-emerald-700",
  PAUSED: "border-warning/30 bg-warning/10 text-amber-700",
  ENDED: "border-white/70 bg-white/60 text-muted",
  CANCELED: "border-danger/30 bg-danger/10 text-red-600",
};

export function MaintenanceStatusBadge({ status }: { status: MaintenanceStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-badge backdrop-blur-sm font-semibold tracking-wide uppercase",
        maintenanceStatusClassName[status],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {MAINTENANCE_STATUS_LABELS[status]}
    </span>
  );
}
