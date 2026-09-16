import { cva, type VariantProps } from "class-variance-authority";
import type { CompanyLifecycle } from "@/generated/prisma/client";
import { COMPANY_LIFECYCLE_LABELS } from "@/lib/crm/constants";
import { cn } from "@/lib/cn";

const lifecycleBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-badge font-semibold tracking-wide uppercase",
  {
    variants: {
      status: {
        LEAD: "border-primary/30 bg-primary/10 text-primary",
        CONTACTED: "border-purple/30 bg-purple/10 text-purple",
        QUALIFIED: "border-warning/30 bg-warning/10 text-warning",
        OPPORTUNITY: "border-cyan/30 bg-cyan/10 text-cyan",
        CLIENT: "border-success/30 bg-success/10 text-success",
        INACTIVE: "border-faint/40 bg-surface-high text-faint",
        LOST: "border-danger/30 bg-danger/10 text-danger",
      } satisfies Record<CompanyLifecycle, string>,
    },
  },
);

type LifecycleBadgeProps = {
  status: CompanyLifecycle;
  className?: string;
} & VariantProps<typeof lifecycleBadgeVariants>;

export function LifecycleBadge({ status, className }: LifecycleBadgeProps) {
  return (
    <span className={cn(lifecycleBadgeVariants({ status }), className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {COMPANY_LIFECYCLE_LABELS[status]}
    </span>
  );
}
