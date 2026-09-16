import { QUOTE_STATUS_LABELS } from "@/lib/crm/constants";
import { cn } from "@/lib/cn";
import type { QuoteStatus } from "@/generated/prisma/client";

const quoteStatusClassName: Record<QuoteStatus, string> = {
  DRAFT: "border-faint/40 bg-surface-high text-faint",
  SENT: "border-primary/30 bg-primary/10 text-primary",
  VIEWED: "border-cyan/30 bg-cyan/10 text-cyan",
  ACCEPTED: "border-success/30 bg-success/10 text-success",
  REJECTED: "border-danger/30 bg-danger/10 text-danger",
  EXPIRED: "border-warning/30 bg-warning/10 text-warning",
};

type QuoteStatusBadgeProps = {
  status: QuoteStatus;
  className?: string;
};

export function QuoteStatusBadge({ status, className }: QuoteStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-badge font-semibold tracking-wide uppercase",
        quoteStatusClassName[status],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {QUOTE_STATUS_LABELS[status]}
    </span>
  );
}
