import { cn } from "@/lib/cn";
import { WEBSITE_STATUS_LABELS, type WebsiteStatusCode } from "@/lib/website/status";

const websiteStatusClassName: Record<WebsiteStatusCode, string> = {
  NO_WEBSITE: "border-faint/40 bg-surface-high text-faint",
  IN_DEVELOPMENT: "border-cyan/30 bg-cyan/10 text-cyan",
  LIVE: "border-success/30 bg-success/10 text-success",
  MAINTENANCE: "border-primary/30 bg-primary/10 text-primary",
  INACTIVE: "border-faint/40 bg-surface-high text-muted",
};

export function WebsiteStatusBadge({ status }: { status: WebsiteStatusCode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-badge font-semibold tracking-wide uppercase",
        websiteStatusClassName[status],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {WEBSITE_STATUS_LABELS[status]}
    </span>
  );
}
