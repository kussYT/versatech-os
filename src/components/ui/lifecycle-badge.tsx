import { cva, type VariantProps } from "class-variance-authority";
import type { CompanyLifecycle } from "@/generated/prisma/client";
import { COMPANY_LIFECYCLE_LABELS } from "@/lib/crm/constants";
import { cn } from "@/lib/cn";

const lifecycleBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-badge backdrop-blur-sm font-semibold tracking-wide uppercase",
  {
    variants: {
      status: {
        LEAD: "border-primary/30 bg-primary/10 text-primary",
        CONTACTED: "border-purple/30 bg-purple/10 text-violet-700",
        QUALIFIED: "border-warning/30 bg-warning/10 text-amber-700",
        OPPORTUNITY: "border-cyan/30 bg-cyan/10 text-sky-700",
        CLIENT: "border-success/30 bg-success/10 text-emerald-700",
        INACTIVE: "border-white/70 bg-white/60 text-faint",
        LOST: "border-danger/30 bg-danger/10 text-red-600",
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
