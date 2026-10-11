import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const priorityBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-badge backdrop-blur-sm font-semibold tracking-wide uppercase",
  {
    variants: {
      priority: {
        urgent: "border-danger/30 bg-danger/10 text-red-600",
        high: "border-orange/30 bg-orange/10 text-orange-700",
        medium: "border-warning/30 bg-warning/10 text-amber-700",
        normal: "border-primary/30 bg-primary/10 text-primary",
        low: "border-white/70 bg-white/60 text-faint",
      },
    },
  },
);

const priorityLabels = {
  urgent: "Urgent",
  high: "Haute",
  medium: "Moyenne",
  normal: "Normale",
  low: "Basse",
} as const;

type PriorityBadgeProps = VariantProps<typeof priorityBadgeVariants> & {
  className?: string;
  label?: string;
};

export function PriorityBadge({
  priority,
  className,
  label,
}: PriorityBadgeProps) {
  if (!priority) {
    return null;
  }

  return (
    <span className={cn(priorityBadgeVariants({ priority }), className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {label ?? priorityLabels[priority]}
    </span>
  );
}
